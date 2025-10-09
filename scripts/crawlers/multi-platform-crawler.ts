/**
 * Multi-Platform Job Crawler
 * Crawls jobs from multiple sources: GitHub, Lever, Greenhouse, etc.
 */

import 'dotenv/config'
import { db } from '../../apps/api/src/db'
import { jobs, visaSponsors } from '../../apps/api/src/db/schema'
import { generateEmbedding } from '../../apps/api/src/lib/openai'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { z } from 'zod'

const client = postgres(process.env.DATABASE_URL!)
const dbConnection = drizzle(client, { schema: { jobs, visaSponsors } })

interface JobSource {
  name: string
  platform: 'github' | 'lever' | 'greenhouse' | 'workday' | 'bamboohr'
  url: string
  location?: string
  industry?: string
}

const GITHUB_SOURCES = [
  {
    name: 'SimplifyJobs New Grad',
    platform: 'github' as const,
    url: 'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/master/README.md',
    location: 'Various',
    industry: 'Technology'
  },
  {
    name: 'SimplifyJobs Internships',
    platform: 'github' as const,
    url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2024-Internships/master/README.md',
    location: 'Various',
    industry: 'Technology'
  },
  {
    name: 'Pitt CS Internships',
    platform: 'github' as const,
    url: 'https://raw.githubusercontent.com/Pitt-CSC/NewGrad-2024/master/README.md',
    location: 'Various',
    industry: 'Technology'
  }
]

const LEVER_COMPANIES = [
  'stripe', 'airbnb', 'uber', 'lyft', 'doordash', 'instacart',
  'square', 'shopify', 'twilio', 'plaid', 'brex', 'ramp',
  'mercury', 'retool', 'superhuman', 'notion', 'coursera',
  'udemy', 'edx', 'canva', 'figma', 'linear', 'vercel',
  'netlify', 'supabase', 'planetscale', 'railway', 'render'
]

const GREENHOUSE_COMPANIES = [
  'stripe', 'airbnb', 'uber', 'lyft', 'doordash', 'instacart',
  'square', 'shopify', 'twilio', 'plaid', 'brex', 'ramp',
  'mercury', 'retool', 'superhuman', 'notion', 'coursera',
  'udemy', 'edx', 'canva', 'figma', 'linear', 'vercel',
  'netlify', 'supabase', 'planetscale', 'railway', 'render'
]

interface ParsedJob {
  title: string
  company: string
  location: string
  url: string
  description: string
  postedAt?: Date
}

interface SponsorMatch {
  id: string
  companyName: string
  sponsorshipConfidence: number
  sponsorshipTypes?: string[]
  lastYearSponsored?: number
}

async function loadSponsors() {
  const rows = await dbConnection
    .select({
      id: visaSponsors.id,
      companyName: visaSponsors.companyName,
      normalizedName: visaSponsors.normalizedName,
      sponsorshipConfidence: visaSponsors.sponsorshipConfidence,
      sponsorshipTypes: visaSponsors.sponsorshipTypes,
      lastYearSponsored: visaSponsors.lastYearSponsored,
      aliases: visaSponsors.aliases
    })
    .from(visaSponsors)

  const sponsors: SponsorMatch[] = []
  const aliasMap = new Map<string, SponsorMatch>()

  for (const row of rows) {
    const sponsor: SponsorMatch = {
      id: row.id,
      companyName: row.companyName,
      sponsorshipConfidence: row.sponsorshipConfidence ?? 0,
      sponsorshipTypes: row.sponsorshipTypes ?? [],
      lastYearSponsored: row.lastYearSponsored ?? undefined,
    }

    sponsors.push(sponsor)

    const normalized = row.normalizedName ? normalizeCompanyName(row.normalizedName) : normalizeCompanyName(row.companyName)
    aliasMap.set(normalized, sponsor)

    if (row.aliases) {
      for (const alias of row.aliases) {
        aliasMap.set(normalizeCompanyName(alias), sponsor)
      }
    }
  }

  return { sponsors, aliasMap }
}

function normalizeCompanyName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function mapToSponsor(company: string, aliasMap: Map<string, SponsorMatch>) {
  const normalized = normalizeCompanyName(company)
  
  // First try exact match
  let sponsor = aliasMap.get(normalized)
  if (sponsor) return sponsor
  
  // Try partial matching for common company name variations
  const companyWords = normalized.split(' ').filter(word => word.length > 2)
  
  for (const [key, value] of aliasMap.entries()) {
    const keyWords = key.split(' ').filter(word => word.length > 2)
    
    // Check if any significant words match
    const matchingWords = companyWords.filter(word => 
      keyWords.some(keyWord => 
        keyWord.includes(word) || word.includes(keyWord)
      )
    )
    
    // If at least 50% of significant words match, consider it a match
    if (matchingWords.length > 0 && matchingWords.length >= Math.ceil(companyWords.length * 0.5)) {
      return value
    }
  }
  
  return null
}

async function crawlGitHubJobs() {
  console.log('🕷️  Crawling GitHub job sources...')
  
  const { aliasMap } = await loadSponsors()
  let totalSaved = 0

  for (const source of GITHUB_SOURCES) {
    try {
      console.log(`📥 Fetching ${source.name}...`)
      const response = await fetch(source.url)
      
      if (!response.ok) {
        console.log(`⚠️  Failed to fetch ${source.name}: ${response.status}`)
        continue
      }

      const content = await response.text()
      const jobs = parseGitHubContent(content, source.name)
      
      console.log(`   Found ${jobs.length} jobs`)

      for (const job of jobs) {
        try {
          const sponsor = mapToSponsor(job.company, aliasMap)
          await upsertJob(job, sponsor, source.name)
          totalSaved++
        } catch (error) {
          console.error(`❌ Failed to save job: ${error}`)
        }
      }
    } catch (error) {
      console.error(`❌ Error crawling ${source.name}:`, error)
    }
  }

  console.log(`✅ Saved ${totalSaved} jobs from GitHub sources`)
  return totalSaved
}

async function crawlLeverJobs() {
  console.log('🕷️  Crawling Lever API...')
  
  const { aliasMap } = await loadSponsors()
  let totalSaved = 0

  for (const company of LEVER_COMPANIES) {
    try {
      const url = `https://api.lever.co/v0/postings/${company}`
      const response = await fetch(url)

      if (!response.ok) {
        console.log(`⚠️  Skipping ${company} (API unavailable)`)
        continue
      }

      const leverJobs = await response.json()
      console.log(`   Found ${leverJobs.length} jobs from ${company}`)

      for (const leverJob of leverJobs) {
        // Filter for new grad / entry level roles
        const title = leverJob.text.toLowerCase()
        const isNewGrad =
          title.includes('new grad') ||
          title.includes('university grad') ||
          title.includes('entry level') ||
          title.includes('early career') ||
          title.includes('junior') ||
          title.includes('associate')

        if (!isNewGrad) continue

        const location = leverJob.categories?.location || 'Not specified'
        const isRemote =
          location.toLowerCase().includes('remote') ||
          location.toLowerCase().includes('anywhere')

        const job: ParsedJob = {
          title: leverJob.text,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location,
          url: leverJob.hostedUrl,
          description: leverJob.description || '',
          postedAt: leverJob.createdAt ? new Date(leverJob.createdAt) : undefined
        }

        const sponsor = mapToSponsor(job.company, aliasMap)
        await upsertJob(job, sponsor, `lever_${company}`)
        totalSaved++
      }
    } catch (error) {
      console.error(`❌ Error crawling ${company}:`, error)
    }
  }

  console.log(`✅ Saved ${totalSaved} jobs from Lever`)
  return totalSaved
}

async function crawlGreenhouseJobs() {
  console.log('🕷️  Crawling Greenhouse API...')
  
  const { aliasMap } = await loadSponsors()
  let totalSaved = 0

  for (const company of GREENHOUSE_COMPANIES) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`
      const response = await fetch(url)

      if (!response.ok) {
        console.log(`⚠️  Skipping ${company} (API unavailable)`)
        continue
      }

      const data = await response.json()
      const greenhouseJobs = data.jobs || []
      console.log(`   Found ${greenhouseJobs.length} jobs from ${company}`)

      for (const greenhouseJob of greenhouseJobs) {
        // Filter for new grad / entry level roles
        const title = greenhouseJob.title.toLowerCase()
        const isNewGrad =
          title.includes('new grad') ||
          title.includes('university grad') ||
          title.includes('entry level') ||
          title.includes('early career') ||
          title.includes('junior') ||
          title.includes('associate')

        if (!isNewGrad) continue

        const location = greenhouseJob.location?.name || 'Not specified'
        const isRemote =
          location.toLowerCase().includes('remote') ||
          location.toLowerCase().includes('anywhere')

        const job: ParsedJob = {
          title: greenhouseJob.title,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location,
          url: greenhouseJob.absolute_url,
          description: greenhouseJob.content || '',
          postedAt: greenhouseJob.updated_at ? new Date(greenhouseJob.updated_at) : undefined
        }

        const sponsor = mapToSponsor(job.company, aliasMap)
        await upsertJob(job, sponsor, `greenhouse_${company}`)
        totalSaved++
      }
    } catch (error) {
      console.error(`❌ Error crawling ${company}:`, error)
    }
  }

  console.log(`✅ Saved ${totalSaved} jobs from Greenhouse`)
  return totalSaved
}

function parseGitHubContent(content: string, sourceName: string): ParsedJob[] {
  // This is a simplified version - you'd want to implement proper parsing
  // based on the specific format of each GitHub source
  const jobs: ParsedJob[] = []
  
  // Basic parsing logic - would need to be customized per source
  const lines = content.split('\n')
  let currentJob: Partial<ParsedJob> = {}
  
  for (const line of lines) {
    if (line.includes('|') && line.includes('Company')) {
      // Skip header
      continue
    }
    
    if (line.includes('|') && line.trim()) {
      const parts = line.split('|').map(p => p.trim())
      if (parts.length >= 4) {
        jobs.push({
          title: parts[0] || 'Unknown Title',
          company: parts[1] || 'Unknown Company',
          location: parts[2] || 'Not specified',
          url: parts[3] || '',
          description: '',
          postedAt: undefined
        })
      }
    }
  }
  
  return jobs
}

async function upsertJob(job: ParsedJob, sponsor: SponsorMatch | null, source: string) {
  const embeddingText = `${job.title} ${job.company} ${job.description}`
  const embedding = await generateEmbedding(embeddingText)

  // Determine visa status based on sponsorship confidence
  let visaStatus = 'unknown'
  if (sponsor) {
    if (sponsor.sponsorshipConfidence >= 80) {
      visaStatus = 'sponsor_verified'
    } else if (sponsor.sponsorshipConfidence >= 50) {
      visaStatus = 'likely_sponsor'
    } else {
      visaStatus = 'unknown'
    }
  }

  const now = new Date()

  await dbConnection
    .insert(jobs)
    .values({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      postedAt: job.postedAt,
      lastSeenAt: now,
      isActive: true,
      isRemote: job.location.toLowerCase().includes('remote'),
      jobType: 'new_grad',
      source,
      embedding,
      visaStatus,
      sponsorshipConfidence: sponsor?.sponsorshipConfidence ?? 0,
      visaNotes: sponsor ? `Matched to ${sponsor.companyName}` : null,
      visaSponsorId: sponsor?.id ?? null,
    })
    .onConflictDoUpdate({
      target: jobs.url,
      set: {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        postedAt: job.postedAt,
        lastSeenAt: now,
        isActive: true,
        isRemote: job.location.toLowerCase().includes('remote'),
        jobType: 'new_grad',
        source,
        embedding,
        visaStatus,
        sponsorshipConfidence: sponsor?.sponsorshipConfidence ?? 0,
        visaNotes: sponsor ? `Matched to ${sponsor.companyName}` : null,
        visaSponsorId: sponsor?.id ?? null,
      }
    })
}

async function crawlAllPlatforms() {
  console.log('🚀 Starting multi-platform job crawler...')
  
  const [githubCount, leverCount, greenhouseCount] = await Promise.all([
    crawlGitHubJobs(),
    crawlLeverJobs(),
    crawlGreenhouseJobs()
  ])
  
  const totalJobs = githubCount + leverCount + greenhouseCount
  
  console.log(`\n🎉 Crawling complete!`)
  console.log(`  GitHub: ${githubCount} jobs`)
  console.log(`  Lever: ${leverCount} jobs`)
  console.log(`  Greenhouse: ${greenhouseCount} jobs`)
  console.log(`  Total: ${totalJobs} jobs`)
  
  process.exit(0)
}

crawlAllPlatforms().catch(console.error)
