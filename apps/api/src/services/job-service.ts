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

export async function searchJobs(params: SearchParams) {
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
    
    const results = await db
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

    console.log('Vector search results count:', results.length)
    return results
  } else {
    console.log('No search embedding available')
  }

  // Otherwise, just filter without vector search (fallback)
  const results = await db
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
  
  return results
}

export async function getJobById(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  return job || null
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

