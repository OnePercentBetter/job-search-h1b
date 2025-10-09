/**
 * GitHub Job Crawler
 * Scrapes curated GitHub new grad repositories, extracts structured roles,
 * cross references visa sponsorship data, and persists fresh postings.
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { z } from 'zod'
import { load } from 'cheerio'
import isURL from 'validator/lib/isURL'
import { parseISO } from 'date-fns'
import { and, eq, lt, notInArray, sql } from 'drizzle-orm'
import { jobs, visaSponsors } from '../../apps/api/src/db/schema'
import { generateEmbedding } from '../../apps/api/src/lib/openai'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for the GitHub crawler')
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client, { schema: { jobs, visaSponsors } })

const REPOS = [
  {
    url: 'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/master/README.md',
    source: 'github_simplify_new_grad',
  }
]

const SponsorMatchSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  sponsorshipConfidence: z.number().int().min(0).max(100),
  sponsorshipTypes: z.array(z.string()).optional(),
  lastYearSponsored: z.number().optional(),
})

type SponsorMatch = z.infer<typeof SponsorMatchSchema>

interface SponsorLookup {
  sponsors: SponsorMatch[]
  aliasMap: Map<string, SponsorMatch>
}

interface ParsedJob {
  title: string
  company: string
  location: string
  url: string
  postedAt?: Date
  description?: string
  jobType?: 'new_grad' | 'internship'
  isRemote?: boolean
}

function normalizeCompanyName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

async function loadSponsors(): Promise<SponsorLookup> {
  const rows = await db
    .select({
      id: visaSponsors.id,
      companyName: visaSponsors.companyName,
      sponsorshipConfidence: visaSponsors.sponsorshipConfidence,
      sponsorshipTypes: visaSponsors.sponsorshipTypes,
      lastYearSponsored: visaSponsors.lastYearSponsored,
      aliases: visaSponsors.aliases,
      normalizedName: visaSponsors.normalizedName,
    })
    .from(visaSponsors)

  const sponsors: SponsorMatch[] = []
  const aliasMap = new Map<string, SponsorMatch>()

  for (const row of rows) {
    const sponsor = SponsorMatchSchema.parse({
      id: row.id,
      companyName: row.companyName,
      sponsorshipConfidence: row.sponsorshipConfidence ?? 0,
      sponsorshipTypes: row.sponsorshipTypes ?? [],
      lastYearSponsored: row.lastYearSponsored ?? undefined,
    })

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

function parseTable(table: string): ParsedJob[] {
  const jobs: ParsedJob[] = []
  
  // Check if it's HTML table
  if (table.includes('<table')) {
    return parseHtmlTable(table)
  }
  
  // Otherwise treat as markdown table
  return parseMarkdownTable(table)
}

function parseHtmlTable(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = []
  const $ = load(html)
  
  const rows = $('tbody tr')
  if (rows.length === 0) return jobs

  // Find column indices by looking at header
  const headerCells = $('thead th').map((_, el) => $(el).text().trim().toLowerCase()).get()
  const companyIdx = headerCells.findIndex((cell) => cell.includes('company'))
  const roleIdx = headerCells.findIndex((cell) => cell.includes('role') || cell.includes('position'))
  const locationIdx = headerCells.findIndex((cell) => cell.includes('location'))
  const dateIdx = headerCells.findIndex((cell) => cell.includes('age') || cell.includes('date'))

  rows.each((_, row) => {
    const cells = $(row).find('td').map((_, el) => $(el).text().trim()).get()
    if (cells.length <= Math.max(companyIdx, roleIdx, locationIdx)) return

    // Extract company name (remove emoji and bold formatting)
    const company = cells[companyIdx]?.replace(/[🔥⭐💼]/g, '').replace(/\*\*/g, '').trim() || ''
    const role = cells[roleIdx] || ''
    const location = cells[locationIdx] || 'Not specified'
    
    // Extract URL from the application link (it's in the Application column, not Role)
    const linkEl = $(row).find('td').eq(3).find('a') // Application column is index 3
    const url = linkEl.attr('href') || ''
    
    if (!url || !isURL(url, { require_protocol: true })) {
      return
    }

    // Parse age (e.g., "0d", "5d", "1w")
    const ageText = cells[dateIdx] || ''
    const postedAt = parseAgeToDate(ageText)

    jobs.push({
      title: role,
      company,
      location,
      url,
      jobType: inferJobType(role),
      isRemote: location.toLowerCase().includes('remote'),
      postedAt,
    })
  })

  return jobs
}

function parseAgeToDate(ageText: string): Date | undefined {
  if (!ageText) return undefined
  
  const now = new Date()
  const match = ageText.match(/(\d+)([dw])/)
  if (!match) return undefined
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  if (unit === 'd') {
    return new Date(now.getTime() - value * 24 * 60 * 60 * 1000)
  } else if (unit === 'w') {
    return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000)
  }
  
  return undefined
}

function parseMarkdownTable(markdown: string): ParsedJob[] {
  const jobs: ParsedJob[] = []
  const rows = markdown.split('\n').filter((line) => line.startsWith('|'))

  if (rows.length < 3) return jobs

  const header = rows[0].split('|').map((cell) => cell.trim().toLowerCase())
  const companyIdx = header.findIndex((cell) => cell.includes('company'))
  const roleIdx = header.findIndex((cell) => cell.includes('role') || cell.includes('position'))
  const locationIdx = header.findIndex((cell) => cell.includes('location'))
  const dateIdx = header.findIndex((cell) => cell.includes('date'))

  for (let i = 2; i < rows.length; i++) {
    const cells = rows[i].split('|').map((cell) => cell.trim())
    if (cells.length <= Math.max(companyIdx, roleIdx, locationIdx)) continue

    const rawRole = cells[roleIdx]
    const linkMatch = rawRole.match(/\[(.*?)\]\((.*?)\)/)

    const title = linkMatch ? linkMatch[1] : rawRole
    const url = linkMatch ? linkMatch[2] : ''
    if (!url || !isURL(url, { require_protocol: true })) {
      continue
    }
    const location = cells[locationIdx] || 'Not specified'
    const postedAt = dateIdx >= 0 ? parseDate(cells[dateIdx]) : undefined

    jobs.push({
      title,
      company: cells[companyIdx],
      location,
      url,
      jobType: inferJobType(title),
      isRemote: location.toLowerCase().includes('remote'),
      postedAt,
    })
  }

  return jobs
}

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const iso = parseISO(trimmed)
  if (!isNaN(iso.getTime())) {
    return iso
  }

  const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
  }

  return undefined
}

function inferJobType(title: string): 'new_grad' | 'internship' | undefined {
  const lower = title.toLowerCase()
  if (lower.includes('intern')) return 'internship'
  if (lower.includes('new grad') || lower.includes('graduate') || lower.includes('entry')) {
    return 'new_grad'
  }
  return undefined
}

async function fetchGitHubContent(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

function extractTables(markdown: string): string[] {
  const tables: string[] = []
  const lines = markdown.split('\n')
  let buffer: string[] = []
  let inHtmlTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    
    // Check for HTML table start/end
    if (trimmed.startsWith('<table')) {
      inHtmlTable = true
      buffer = [line]
    } else if (inHtmlTable) {
      buffer.push(line)
      if (trimmed.startsWith('</table>')) {
        tables.push(buffer.join('\n'))
        buffer = []
        inHtmlTable = false
      }
    }
    // Check for markdown table
    else if (line.startsWith('|')) {
      buffer.push(line)
    } else if (buffer.length > 0 && !inHtmlTable) {
      tables.push(buffer.join('\n'))
      buffer = []
    }
  }

  if (buffer.length > 0) {
    tables.push(buffer.join('\n'))
  }

  return tables
}

interface EnrichedPage {
  description?: string
  linkActive: boolean
}

async function enrichFromJobPage(url: string): Promise<EnrichedPage> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { description: undefined, linkActive: false }
    }

    const html = await response.text()
    const $ = load(html)
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')

    if (description && description.length > 16) {
      return { description, linkActive: true }
    }

    const paragraphText = $('p').slice(0, 3).map((_, el) => $(el).text()).get().join('\n')
    return { description: paragraphText || undefined, linkActive: true }
  } catch (error) {
    console.warn(`Failed to fetch job page ${url}:`, error instanceof Error ? error.message : error)
    return { description: undefined, linkActive: false }
  }
}

async function upsertJob(job: ParsedJob, sponsor: SponsorMatch | null, source: string) {
  const enrichment = job.url ? await enrichFromJobPage(job.url) : { description: job.description, linkActive: true }
  const description = job.description ?? enrichment.description ?? ''
  const embeddingText = `${job.title} ${job.company} ${description}`
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
  const locationLower = (job.location || '').toLowerCase()

      await db
        .insert(jobs)
        .values({
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
      description,
      postedAt: job.postedAt,
      lastSeenAt: now,
      linkCheckedAt: now,
      isLinkActive: enrichment.linkActive,
          jobType: job.jobType,
      isRemote: job.isRemote ?? locationLower.includes('remote'),
      source,
          embedding,
      visaSponsorId: sponsor?.id ?? null,
      visaStatus,
      sponsorshipConfidence: sponsor?.sponsorshipConfidence ?? 0,
      visaNotes: sponsor ? `Matched to ${sponsor.companyName}` : null,
    })
    .onConflictDoUpdate({
      target: jobs.url,
      set: {
        title: job.title,
        company: job.company,
        location: job.location,
        description,
        postedAt: job.postedAt,
        lastSeenAt: now,
        linkCheckedAt: now,
        isLinkActive: enrichment.linkActive,
        jobType: job.jobType,
        isRemote: job.isRemote ?? locationLower.includes('remote'),
        source,
        visaSponsorId: sponsor?.id ?? null,
        visaStatus,
        sponsorshipConfidence: sponsor?.sponsorshipConfidence ?? 0,
        visaNotes: sponsor ? `Matched to ${sponsor.companyName}` : null,
        updatedAt: sql`now()`,
      },
    })
}

async function markMissingJobs(source: string, seenUrls: Set<string>) {
  const now = new Date()
  const staleThreshold = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30) // 30 days

  if (seenUrls.size === 0) {
    return
  }

  await db
    .update(jobs)
    .set({
      isActive: false,
      isLinkActive: false,
      lastSeenAt: now,
    })
    .where(
      and(
        eq(jobs.source, source),
        notInArray(jobs.url, Array.from(seenUrls)),
        lt(jobs.lastSeenAt, staleThreshold)
      )
    )
}

async function crawl() {
  console.log('🕷️  Starting GitHub job crawler...')
  const { aliasMap } = await loadSponsors()

  let totalSaved = 0
  let totalErrors = 0

  for (const repo of REPOS) {
    console.log(`\n📥 Fetching ${repo.url}`)

    try {
      const markdown = await fetchGitHubContent(repo.url)
      const tables = extractTables(markdown)
      console.log(`   Found ${tables.length} tables`)
      const seenUrls = new Set<string>()

      for (const table of tables) {
        const parsedJobs = parseTable(table)
        for (const job of parsedJobs) {
          if (!job.url) continue
          seenUrls.add(job.url)

          try {
            const sponsor = mapToSponsor(job.company, aliasMap)
            await upsertJob(job, sponsor, repo.source)
            totalSaved++
          } catch (error) {
            totalErrors++
            console.error(`❌ Failed to upsert ${job.company} – ${job.title}:`, error instanceof Error ? error.message : error)
          }
        }
      }

      await markMissingJobs(repo.source, seenUrls)
    } catch (error) {
      totalErrors++
      console.error(`❌ Failed processing repo ${repo.url}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log('\n📊 Crawl Summary:')
  console.log(`   Jobs processed: ${totalSaved}`)
  console.log(`   Errors: ${totalErrors}`)

  await client.end()
  process.exit(0)
}

crawl().catch(async (error) => {
  console.error('Unhandled crawler error:', error)
  await client.end()
  process.exit(1)
})

