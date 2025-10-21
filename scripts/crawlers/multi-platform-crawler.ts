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
import { extractSmartRecruitersJobs } from './adapters/smartrecruiters'
import { extractWorkableJobs } from './adapters/workable'

const client = postgres(process.env.DATABASE_URL!)
const dbConnection = drizzle(client, { schema: { jobs, visaSponsors } })

const DEFAULT_RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

interface FetchRetryConfig {
  retries?: number
  backoffMs?: number
  retryOnStatuses?: Set<number>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  config: FetchRetryConfig = {}
) {
  const {
    retries = 2,
    backoffMs = 500,
    retryOnStatuses = DEFAULT_RETRYABLE_STATUSES,
  } = config

  let attempt = 0
  let lastError: unknown = null

  while (attempt <= retries) {
    try {
      const response = await fetch(url, init)

      if (response.ok) {
        return response
      }

      if (
        attempt === retries ||
        !retryOnStatuses.has(response.status)
      ) {
        return response
      }

      console.warn(
        `⏳ Retry ${attempt + 1}/${retries + 1} for ${url} (HTTP ${response.status} ${response.statusText})`
      )
    } catch (error) {
      lastError = error
      if (attempt === retries) {
        throw error
      }

      console.warn(
        `⚠️  Network error fetching ${url} (attempt ${attempt + 1}): ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    attempt++
    await sleep(backoffMs * attempt)
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${url} after ${retries + 1} attempts`)
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

const SMARTRECRUITERS_COMPANIES = [
  'ns1',
  'palantir',
  'affirm',
  'doordash',
  'pinterest',
  'spotify',
  'snowflake',
  'coinbase',
  'datadog',
  'instacart',
]

const WORKABLE_ACCOUNTS = [
  'scaleai',
  'brex',
  'ramp',
  'plaid',
  'retool',
  'figma',
  'canva',
  'vercel',
  'netlify',
  'linear',
]

interface ParsedJob {
  title: string
  company: string
  location: string
  url: string
  description: string
  postedAt?: Date
  jobType?: 'new_grad' | 'internship'
  isRemote?: boolean
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
      const response = await fetchWithRetry(source.url)
      
      if (!response.ok) {
        console.log(
          `⚠️  Failed to fetch ${source.name}: HTTP ${response.status} ${response.statusText}`
        )
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
      const response = await fetchWithRetry(url)

      if (!response.ok) {
        console.log(
          `⚠️  Skipping ${company} (Lever API HTTP ${response.status} ${response.statusText})`
        )
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
          postedAt: leverJob.createdAt ? new Date(leverJob.createdAt) : undefined,
          jobType: title.includes('intern') ? 'internship' : 'new_grad',
          isRemote,
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
      const response = await fetchWithRetry(url)

      if (!response.ok) {
        console.log(
          `⚠️  Skipping ${company} (Greenhouse API HTTP ${response.status} ${response.statusText})`
        )
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
          postedAt: greenhouseJob.updated_at ? new Date(greenhouseJob.updated_at) : undefined,
          jobType: title.includes('intern') ? 'internship' : 'new_grad',
          isRemote,
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

async function crawlSmartRecruitersJobs() {
  console.log('🕷️  Crawling SmartRecruiters API...')

  const { aliasMap } = await loadSponsors()
  let totalSaved = 0

  for (const company of SMARTRECRUITERS_COMPANIES) {
    try {
      const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings`
      const response = await fetchWithRetry(url)

      if (!response.ok) {
        console.log(
          `⚠️  Skipping ${company} (SmartRecruiters HTTP ${response.status} ${response.statusText})`
        )
        continue
      }

      const data = await response.json()
      const jobs = extractSmartRecruitersJobs(data, company)
      console.log(`   Found ${jobs.length} SmartRecruiters jobs for ${company}`)

      for (const job of jobs) {
        const sponsor = mapToSponsor(job.company, aliasMap)
        await upsertJob(job, sponsor, `smartrecruiters_${company}`)
        totalSaved++
      }
    } catch (error) {
      console.error(`❌ Error crawling SmartRecruiters company ${company}:`, error)
    }
  }

  console.log(`✅ Saved ${totalSaved} jobs from SmartRecruiters`)
  return totalSaved
}

async function crawlWorkableJobs() {
  console.log('🕷️  Crawling Workable API...')

  const { aliasMap } = await loadSponsors()
  let totalSaved = 0

  for (const account of WORKABLE_ACCOUNTS) {
    try {
      const listUrl = `https://apply.workable.com/api/v3/accounts/${account}/jobs?state=published`
      const response = await fetchWithRetry(listUrl, {}, { retries: 3, backoffMs: 800 })

      if (!response.ok) {
        console.log(
          `⚠️  Skipping ${account} (Workable HTTP ${response.status} ${response.statusText})`
        ) // continue to next account
        continue
      }

      const data = await response.json()
      const jobs = await extractWorkableJobs(data, account, async (job) => {
        if (!job.shortcode) return null
        try {
          const detailUrl = `https://apply.workable.com/api/v3/accounts/${account}/jobs/${job.shortcode}`
          const detailResponse = await fetchWithRetry(detailUrl, {}, { retries: 2, backoffMs: 700 })
          if (!detailResponse.ok) {
            console.warn(
              `⚠️  Workable detail unavailable for ${account} (${job.shortcode}): HTTP ${detailResponse.status} ${detailResponse.statusText}`
            )
            return null
          }
          return detailResponse.json()
        } catch (error) {
          console.warn(`⚠️  Failed to fetch Workable detail for ${job.id}`, error)
          return null
        }
      })

      console.log(`   Found ${jobs.length} Workable jobs for ${account}`)

      for (const job of jobs) {
        const sponsor = mapToSponsor(job.company, aliasMap)
        await upsertJob(job, sponsor, `workable_${account}`)
        totalSaved++
      }
    } catch (error) {
      console.error(`❌ Error crawling Workable account ${account}:`, error)
    }
  }

  console.log(`✅ Saved ${totalSaved} jobs from Workable`)
  return totalSaved
}

function parseGitHubContent(content: string, _sourceName: string): ParsedJob[] {
  const jobs: ParsedJob[] = []

  const lines = content.split('\n')

  for (const line of lines) {
    if (!line.includes('|') || !line.trim()) continue
    if (line.toLowerCase().includes('company') && line.toLowerCase().includes('role')) continue

    const parts = line.split('|').map((p) => p.trim())
    if (parts.length < 4) continue

    const [titleRaw, companyRaw, locationRaw, urlRaw] = parts
    const title = titleRaw || 'Unknown Title'
    const location = locationRaw || 'Not specified'

    jobs.push({
      title,
      company: companyRaw || 'Unknown Company',
      location,
      url: urlRaw || '',
      description: '',
      postedAt: undefined,
      jobType: title.toLowerCase().includes('intern') ? 'internship' : 'new_grad',
      isRemote: location.toLowerCase().includes('remote'),
    })
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
      isRemote: job.isRemote ?? job.location.toLowerCase().includes('remote'),
      jobType: job.jobType ?? 'new_grad',
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
        isRemote: job.isRemote ?? job.location.toLowerCase().includes('remote'),
        jobType: job.jobType ?? 'new_grad',
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
  
  const results = await Promise.allSettled([
    crawlGitHubJobs(),
    crawlLeverJobs(),
    crawlGreenhouseJobs(),
    crawlSmartRecruitersJobs(),
    crawlWorkableJobs(),
  ])

  const [
    githubResult,
    leverResult,
    greenhouseResult,
    smartRecruitersResult,
    workableResult,
  ] = results

  const toCount = (label: string, result: PromiseSettledResult<number>) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    console.error(`❌ ${label} crawl failed:`, result.reason)
    return 0
  }

  const githubCount = toCount('GitHub', githubResult)
  const leverCount = toCount('Lever', leverResult)
  const greenhouseCount = toCount('Greenhouse', greenhouseResult)
  const smartRecruitersCount = toCount('SmartRecruiters', smartRecruitersResult)
  const workableCount = toCount('Workable', workableResult)
  
  const totalJobs = githubCount + leverCount + greenhouseCount + smartRecruitersCount + workableCount
  
  console.log(`\n🎉 Crawling complete!`)
  console.log(`  GitHub: ${githubCount} jobs`)
  console.log(`  Lever: ${leverCount} jobs`)
  console.log(`  Greenhouse: ${greenhouseCount} jobs`)
  console.log(`  SmartRecruiters: ${smartRecruitersCount} jobs`)
  console.log(`  Workable: ${workableCount} jobs`)
  console.log(`  Total: ${totalJobs} jobs`)
  
  process.exit(0)
}

crawlAllPlatforms().catch(console.error)
