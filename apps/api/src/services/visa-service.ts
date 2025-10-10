import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import { jobs, visaSponsors } from '../db/schema'
import { normalizeCompanyName } from '../lib/normalize'
import {
  getLandingClubSponsor,
  isLandingClubConfigured,
  LandingClubSponsor,
} from '../lib/landing-club'

const REMOTE_SYNC_LIMIT_PER_REQUEST = 5
const STALE_THRESHOLD_HOURS = 6

type VisaSponsorRecord = typeof visaSponsors.$inferSelect

interface SponsorMetadata {
  landingClub?: LandingClubSponsor
  landingClubSyncedAt?: string
  [key: string]: unknown
}

export interface SponsorEnrichment {
  sponsor: VisaSponsorRecord | null
  landingClub?: LandingClubSponsor | null
}

function isMetadata(value: unknown): value is SponsorMetadata {
  return !!value && typeof value === 'object'
}

function mergeStringArrays(...values: (string[] | null | undefined)[]) {
  const set = new Set<string>()
  for (const value of values) {
    if (!Array.isArray(value)) continue
    for (const entry of value) {
      if (entry) {
        set.add(entry)
      }
    }
  }
  return Array.from(set)
}

function extractMetadata(record: VisaSponsorRecord | null) {
  if (!record || !record.metadata) return null
  if (isMetadata(record.metadata)) {
    return record.metadata
  }
  return null
}

function isSponsorStale(record: VisaSponsorRecord | null) {
  if (!record) return true
  const metadata = extractMetadata(record)
  if (!metadata?.landingClubSyncedAt) return true
  const synced = new Date(metadata.landingClubSyncedAt)
  if (Number.isNaN(synced.getTime())) return true
  const ageHours = (Date.now() - synced.getTime()) / (1000 * 60 * 60)
  return ageHours > STALE_THRESHOLD_HOURS
}

async function findSponsorByNormalizedName(normalizedName: string) {
  const [directMatch] = await db
    .select()
    .from(visaSponsors)
    .where(eq(visaSponsors.normalizedName, normalizedName))
    .limit(1)

  if (directMatch) {
    return directMatch
  }

  const [aliasMatch] = await db
    .select()
    .from(visaSponsors)
    .where(
      sql`${visaSponsors.aliases} @> ARRAY[${normalizedName}]::text[]`
    )
    .limit(1)

  return aliasMatch ?? null
}

async function upsertSponsorFromLandingClub(companyName: string) {
  if (!isLandingClubConfigured()) {
    return null
  }

  const landingClub = await getLandingClubSponsor(companyName)
  if (!landingClub) {
    return null
  }

  const normalized = normalizeCompanyName(companyName)
  const existing = await findSponsorByNormalizedName(normalized)
  const existingMetadata = extractMetadata(existing) ?? {}

  const mergedMetadata: SponsorMetadata = {
    ...existingMetadata,
    landingClub,
    landingClubSyncedAt: new Date().toISOString(),
  }

  const mergedSponsorshipTypes = mergeStringArrays(
    landingClub.visaTypes,
    existing?.sponsorshipTypes
  )

  const [record] = await db
    .insert(visaSponsors)
    .values({
      companyName: landingClub.name,
      normalizedName: normalized,
      aliases: existing?.aliases ?? [],
      sponsorshipTypes: mergedSponsorshipTypes.length ? mergedSponsorshipTypes : null,
      lastYearSponsored:
        landingClub.lastYearSponsored ?? existing?.lastYearSponsored ?? null,
      sponsorshipConfidence:
        landingClub.sponsorshipConfidence ??
        existing?.sponsorshipConfidence ??
        50,
      notes: landingClub.latestUpdate?.summary ?? existing?.notes ?? null,
      source: 'landing_club',
      metadata: mergedMetadata,
    })
    .onConflictDoUpdate({
      target: visaSponsors.normalizedName,
      set: {
        companyName: landingClub.name,
        aliases: existing?.aliases ?? [],
        sponsorshipTypes: mergedSponsorshipTypes.length ? mergedSponsorshipTypes : null,
        lastYearSponsored:
          landingClub.lastYearSponsored ?? existing?.lastYearSponsored ?? null,
        sponsorshipConfidence:
          landingClub.sponsorshipConfidence ??
          existing?.sponsorshipConfidence ??
          50,
        notes: landingClub.latestUpdate?.summary ?? existing?.notes ?? null,
        source: 'landing_club',
        metadata: mergedMetadata,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!record) {
    return null
  }

  return {
    sponsor: record,
    landingClub,
  }
}

export async function getSponsorEnrichmentForCompany(companyName: string): Promise<SponsorEnrichment> {
  const normalized = normalizeCompanyName(companyName)
  let sponsorRecord = await findSponsorByNormalizedName(normalized)
  let metadata = extractMetadata(sponsorRecord)

  if (sponsorRecord && !isSponsorStale(sponsorRecord)) {
    return {
      sponsor: sponsorRecord,
      landingClub: metadata?.landingClub ?? null,
    }
  }

  if (sponsorRecord && metadata?.landingClub && !isLandingClubConfigured()) {
    return {
      sponsor: sponsorRecord,
      landingClub: metadata.landingClub,
    }
  }

  const synced = await upsertSponsorFromLandingClub(companyName)
  if (synced) {
    return synced
  }

  if (sponsorRecord) {
    return {
      sponsor: sponsorRecord,
      landingClub: metadata?.landingClub ?? null,
    }
  }

  return { sponsor: null, landingClub: null }
}

interface JobSearchRow {
  id: string
  company: string
  visaSponsorId?: string | null
}

export interface SponsorSummary {
  id: string
  companyName: string
  sponsorshipConfidence: number | null
  lastYearSponsored: number | null
  visaTypes?: string[] | null
  latestUpdate?: {
    summary: string
    occurredAt?: string
  } | null
  totalFilings?: number | null
  source?: string | null
}

function buildSponsorSummary(record: VisaSponsorRecord | null, landingClub?: LandingClubSponsor | null): SponsorSummary | null {
  if (!record && !landingClub) {
    return null
  }

  const metadata = extractMetadata(record)
  const lc = landingClub ?? metadata?.landingClub ?? null

  return {
    id: record?.id ?? lc?.id ?? normalizeCompanyName(lc?.name ?? ''),
    companyName: record?.companyName ?? lc?.name ?? '',
    sponsorshipConfidence:
      record?.sponsorshipConfidence ??
      lc?.sponsorshipConfidence ??
      null,
    lastYearSponsored:
      record?.lastYearSponsored ??
      lc?.lastYearSponsored ??
      null,
    visaTypes: record?.sponsorshipTypes ?? lc?.visaTypes ?? null,
    latestUpdate: lc?.latestUpdate ?? null,
    totalFilings: lc?.totalFilings ?? null,
    source: record?.source ?? (lc ? 'landing_club' : null),
  }
}

export async function enrichJobsWithSponsors<T extends JobSearchRow>(jobRows: T[]) {
  if (!jobRows.length) return jobRows

  const normalizedToJobs = new Map<string, T[]>()
  for (const job of jobRows) {
    if (!job.company) continue
    const normalized = normalizeCompanyName(job.company)
    if (!normalized) continue
    const existing = normalizedToJobs.get(normalized)
    if (existing) {
      existing.push(job)
    } else {
      normalizedToJobs.set(normalized, [job])
    }
  }

  const normalizedNames = Array.from(normalizedToJobs.keys())
  if (!normalizedNames.length) {
    return jobRows
  }

  const existingSponsors = await db
    .select()
    .from(visaSponsors)
    .where(inArray(visaSponsors.normalizedName, normalizedNames))

  const sponsorsByNormalized = new Map<string, VisaSponsorRecord>()
  for (const sponsor of existingSponsors) {
    sponsorsByNormalized.set(sponsor.normalizedName, sponsor)
  }

  let remoteCallsRemaining = REMOTE_SYNC_LIMIT_PER_REQUEST
  const sponsorByJobId = new Map<string, SponsorSummary | null>()

  for (const [normalized, jobsForCompany] of normalizedToJobs.entries()) {
    let sponsorRecord = sponsorsByNormalized.get(normalized) ?? null
    let metadata = extractMetadata(sponsorRecord)

    const needsRemote =
      (!sponsorRecord || isSponsorStale(sponsorRecord)) &&
      isLandingClubConfigured() &&
      remoteCallsRemaining > 0

    if (needsRemote) {
      const synced = await upsertSponsorFromLandingClub(jobsForCompany[0].company)
      remoteCallsRemaining -= 1
      if (synced?.sponsor) {
        sponsorRecord = synced.sponsor
        metadata = extractMetadata(sponsorRecord)
        sponsorsByNormalized.set(normalized, sponsorRecord)
      }
    }

    const sponsorSummary = buildSponsorSummary(
      sponsorRecord,
      metadata?.landingClub ?? null
    )

    for (const job of jobsForCompany) {
      sponsorByJobId.set(job.id, sponsorSummary)
    }
  }

  return jobRows.map((job) => {
    return {
      ...job,
      visaSponsor: sponsorByJobId.get(job.id) ?? null,
    }
  })
}

export async function linkJobToSponsor(jobId: string, companyName: string) {
  const enrichment = await getSponsorEnrichmentForCompany(companyName)
  if (!enrichment.sponsor) {
    return
  }

  await db
    .update(jobs)
    .set({
      visaSponsorId: enrichment.sponsor.id,
      sponsorshipConfidence: enrichment.sponsor.sponsorshipConfidence ?? null,
      visaStatus: enrichment.sponsor.sponsorshipConfidence
        ? enrichment.sponsor.sponsorshipConfidence >= 75
          ? 'sponsor_verified'
          : 'likely_sponsor'
        : 'unknown',
      visaNotes: enrichment.sponsor.notes ?? enrichment.landingClub?.latestUpdate?.summary ?? null,
    })
    .where(eq(jobs.id, jobId))
}

export async function getSponsorSummaryForCompany(companyName: string) {
  const enrichment = await getSponsorEnrichmentForCompany(companyName)
  return buildSponsorSummary(enrichment.sponsor, enrichment.landingClub ?? null)
}
