import { db } from '../db'
import { jobs, users } from '../db/schema'
import {
  eq,
  desc,
  sql,
  cosineDistance,
  and,
  ilike,
  gte,
  lte,
  isNotNull
} from 'drizzle-orm'
import { generateEmbedding } from '../lib/openai'
import { enrichJobsWithSponsors, SponsorSummary, getSponsorSummaryForCompany } from './visa-service'

interface SearchParams {
  description?: string
  jobType?: 'new_grad' | 'internship' | 'all'
  isRemote?: boolean
  location?: string
  visaStatus?: 'sponsor_verified' | 'likely_sponsor' | 'unknown'
  minSponsorshipConfidence?: number
  requiresVerifiedSponsor?: boolean
  postedAfter?: string
  postedBefore?: string
  includeInactive?: boolean
  limit?: number
  offset?: number
  userId?: string
}

export interface JobSearchResult {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  url: string
  isRemote: boolean | null
  jobType: string | null
  source: string | null
  scrapedAt: Date | null
  postedAt: Date | null
  visaStatus?: string | null
  sponsorshipConfidence?: number | null
  visaNotes?: string | null
  similarity?: number
  visaSponsor?: SponsorSummary | null
  matchScore?: number
  scoreDetails?: {
    similarity: number
    recency: number
    sponsorship: number
  }
  matchReasons?: string[]
}

function computeRecencyScore(postedAt: Date | null): number {
  if (!postedAt) return 0
  const now = Date.now()
  const postedTime = postedAt.getTime()
  const diffInDays = (now - postedTime) / (1000 * 60 * 60 * 24)
  if (diffInDays <= 3) return 1
  if (diffInDays <= 7) return 0.8
  if (diffInDays <= 14) return 0.6
  if (diffInDays <= 30) return 0.4
  if (diffInDays <= 60) return 0.2
  return 0
}

function computeSponsorScore(job: {
  visaStatus?: string | null
  sponsorshipConfidence?: number | null
  visaSponsor?: SponsorSummary | null
}): number {
  const visaStatus = job.visaStatus ?? null
  const confidence =
    job.visaSponsor?.sponsorshipConfidence ?? job.sponsorshipConfidence ?? null

  if (visaStatus === 'sponsor_verified') return 1
  if (confidence !== null && confidence >= 80) return 0.9
  if (confidence !== null && confidence >= 60) return 0.6
  if (visaStatus === 'likely_sponsor') return 0.5
  if (confidence !== null && confidence >= 40) return 0.3
  return 0
}

function buildMatchReasons(job: JobSearchResult, scores: { similarity: number; recency: number; sponsorship: number }) {
  const reasons: string[] = []
  if (scores.similarity >= 0.75) {
    reasons.push('Strong alignment with your profile preferences')
  } else if (scores.similarity >= 0.5) {
    reasons.push('Good match to your stated interests')
  }

  if (scores.recency >= 0.6) {
    reasons.push('Recently posted opportunity')
  }

  if (scores.sponsorship >= 0.6) {
    if (job.visaStatus === 'sponsor_verified' || job.visaSponsor?.sponsorshipConfidence) {
      reasons.push('High confidence visa sponsorship')
    } else {
      reasons.push('Likely to sponsor work visas')
    }
  }

  if (!reasons.length) {
    reasons.push('Matches your filters')
  }

  return reasons
}

function applyScoring(results: JobSearchResult[]): JobSearchResult[] {
  return results
    .map((job) => {
      const similarityScore = typeof job.similarity === 'number' ? Math.max(0, Math.min(1, job.similarity)) : 0
      const postedAt = job.postedAt ? new Date(job.postedAt) : null
      const recencyScore = computeRecencyScore(postedAt)
      const sponsorshipScore = computeSponsorScore(job)

      // Weighted composite score
      const matchScore =
        similarityScore * 0.6 +
        recencyScore * 0.25 +
        sponsorshipScore * 0.15

      const scoreDetails = {
        similarity: Number(similarityScore.toFixed(3)),
        recency: Number(recencyScore.toFixed(3)),
        sponsorship: Number(sponsorshipScore.toFixed(3)),
      }

      const matchReasons = buildMatchReasons(job, scoreDetails)

      return {
        ...job,
        matchScore: Number(matchScore.toFixed(3)),
        scoreDetails,
        matchReasons,
      }
    })
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
}

export async function searchJobs(params: SearchParams): Promise<JobSearchResult[]> {
  const {
    description,
    jobType,
    isRemote,
    location,
    visaStatus,
    minSponsorshipConfidence,
    requiresVerifiedSponsor,
    postedAfter,
    postedBefore,
    includeInactive = false,
    limit = 50,
    offset = 0,
    userId,
  } = params

  const baseFilters = [] as any[]

  if (!includeInactive) {
    baseFilters.push(eq(jobs.isActive, true))
  }

  if (jobType && jobType !== 'all') {
    baseFilters.push(eq(jobs.jobType, jobType))
  }

  if (isRemote !== undefined) {
    baseFilters.push(eq(jobs.isRemote, isRemote))
  }

  if (location) {
    baseFilters.push(ilike(jobs.location, `%${location}%`))
  }

  if (visaStatus) {
    baseFilters.push(eq(jobs.visaStatus, visaStatus))
  }

  if (requiresVerifiedSponsor) {
    baseFilters.push(eq(jobs.visaStatus, 'sponsor_verified'))
    baseFilters.push(isNotNull(jobs.visaSponsorId))
  }

  if (minSponsorshipConfidence !== undefined) {
    baseFilters.push(gte(jobs.sponsorshipConfidence, minSponsorshipConfidence))
  }

  if (postedAfter) {
    baseFilters.push(gte(jobs.postedAt, sql`CAST(${postedAfter} AS timestamp)`))
  }

  if (postedBefore) {
    baseFilters.push(lte(jobs.postedAt, sql`CAST(${postedBefore} AS timestamp)`))
  }

  const whereClause = baseFilters.length ? and(...baseFilters) : undefined

  // Determine what to use for vector similarity search
  let searchEmbedding: number[] | null = null
  
  console.log('Search params - description:', description, 'userId:', userId)
  
  if (description) {
    // Use explicit search description
    console.log('Using description for search')
    searchEmbedding = await generateEmbedding(description)
  } else if (userId) {
    // Use user's profile for automatic ranking
    console.log('Looking up user profile for userId:', userId)
    try {
      console.log('Executing user lookup query...')
      const [userProfile] = await db
        .select({ profileEmbedding: users.profileEmbedding })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      
      console.log('User profile query result:', userProfile)
      if (userProfile?.profileEmbedding) {
        searchEmbedding = userProfile.profileEmbedding
        console.log('Using profile embedding for search, length:', searchEmbedding.length)
      } else {
        console.log('No profile embedding found in result:', userProfile)
      }
    } catch (error) {
      console.error('Error looking up user profile:', error)
    }
  }

  // If we have an embedding (either from description or profile), use vector similarity search
  if (searchEmbedding) {
    console.log('Using search embedding, length:', searchEmbedding.length)
    const similarity = sql<number>`1 - (${cosineDistance(jobs.embedding, searchEmbedding)})`
    
    const rawResults = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        description: jobs.description,
        url: jobs.url,
        isRemote: jobs.isRemote,
        jobType: jobs.jobType,
        source: jobs.source,
        scrapedAt: jobs.scrapedAt,
        postedAt: jobs.postedAt,
        visaStatus: jobs.visaStatus,
        sponsorshipConfidence: jobs.sponsorshipConfidence,
        visaNotes: jobs.visaNotes,
        similarity,
      })
      .from(jobs)
      .where(whereClause ?? sql`true`)
      .orderBy((t) => desc(t.similarity))
      .limit(limit)
      .offset(offset)

    console.log('Vector search results count:', rawResults.length)
    const enriched = await enrichJobsWithSponsors(rawResults)
    return applyScoring(enriched)
  } else {
    console.log('No search embedding available')
  }

  // Otherwise, just filter without vector search (fallback)
  const rawResults = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      description: jobs.description,
      url: jobs.url,
      isRemote: jobs.isRemote,
      jobType: jobs.jobType,
      source: jobs.source,
      scrapedAt: jobs.scrapedAt,
      postedAt: jobs.postedAt,
      visaStatus: jobs.visaStatus,
      sponsorshipConfidence: jobs.sponsorshipConfidence,
      visaNotes: jobs.visaNotes,
    })
    .from(jobs)
    .where(whereClause ?? sql`true`)
    .orderBy(desc(jobs.scrapedAt))
    .limit(limit)
    .offset(offset)
  
  const enriched = await enrichJobsWithSponsors(rawResults)
  return applyScoring(enriched)
}

export async function getJobById(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) {
    return null
  }
  const visaSponsor = job.company ? await getSponsorSummaryForCompany(job.company) : null
  return {
    ...job,
    visaSponsor,
  }
}

export async function getTotalJobCount(filters: Omit<SearchParams, 'limit' | 'offset'>) {
  const {
    jobType,
    isRemote,
    location,
    visaStatus,
    minSponsorshipConfidence,
    requiresVerifiedSponsor,
    postedAfter,
    postedBefore,
    includeInactive = false,
  } = filters

  const baseFilters = [] as any[]

  if (!includeInactive) {
    baseFilters.push(eq(jobs.isActive, true))
  }

  if (jobType && jobType !== 'all') {
    baseFilters.push(eq(jobs.jobType, jobType))
  }

  if (isRemote !== undefined) {
    baseFilters.push(eq(jobs.isRemote, isRemote))
  }

  if (location) {
    baseFilters.push(ilike(jobs.location, `%${location}%`))
  }

  if (visaStatus) {
    baseFilters.push(eq(jobs.visaStatus, visaStatus))
  }

  if (requiresVerifiedSponsor) {
    baseFilters.push(eq(jobs.visaStatus, 'sponsor_verified'))
    baseFilters.push(isNotNull(jobs.visaSponsorId))
  }

  if (minSponsorshipConfidence !== undefined) {
    baseFilters.push(gte(jobs.sponsorshipConfidence, minSponsorshipConfidence))
  }

  if (postedAfter) {
    baseFilters.push(gte(jobs.postedAt, sql`CAST(${postedAfter} AS timestamp)`))
  }

  if (postedBefore) {
    baseFilters.push(lte(jobs.postedAt, sql`CAST(${postedBefore} AS timestamp)`))
  }

  const whereClause = baseFilters.length ? and(...baseFilters) : undefined

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(whereClause ?? sql`true`)

  return result.count
}
