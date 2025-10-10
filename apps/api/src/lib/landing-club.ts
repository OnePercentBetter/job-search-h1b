import { normalizeCompanyName } from './normalize'

interface LandingClubUpdate {
  summary: string
  occurredAt?: string
}

export interface LandingClubSponsor {
  id: string
  name: string
  normalizedName: string
  visaTypes?: string[]
  sponsorshipConfidence?: number
  lastYearSponsored?: number
  totalFilings?: number
  latestUpdate?: LandingClubUpdate | null
  updatedAt?: string
  raw?: unknown
}

const DEFAULT_BASE_URL = 'https://api.landing.club/v1'

export function isLandingClubConfigured() {
  return Boolean(process.env.LANDING_CLUB_API_KEY)
}

function getConfig() {
  const baseUrl = process.env.LANDING_CLUB_API_BASE_URL || DEFAULT_BASE_URL
  const apiKey = process.env.LANDING_CLUB_API_KEY

  if (!apiKey) {
    throw new Error('LANDING_CLUB_API_KEY environment variable is required to access Landing Club API')
  }

  return { baseUrl, apiKey }
}

async function landingClubRequest<T>(path: string, init?: RequestInit) {
  const { baseUrl, apiKey } = getConfig()
  const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Landing Club API request failed (${response.status}): ${body}`)
  }

  return (await response.json()) as T
}

function mapSponsorEntry(entry: any): LandingClubSponsor | null {
  if (!entry) return null

  const companyName =
    entry.companyName ||
    entry.name ||
    entry.company ||
    entry.organization ||
    entry.title

  if (!companyName || typeof companyName !== 'string') {
    return null
  }

  const normalizedName =
    entry.normalizedName ||
    entry.normalized_name ||
    normalizeCompanyName(companyName)

  const sponsorshipConfidence =
    entry.sponsorshipConfidence ??
    entry.visaSuccessScore ??
    entry.sponsorship_score ??
    entry.score ??
    null

  const lastYear =
    entry.lastYearSponsored ??
    entry.last_year_sponsored ??
    entry.latest_filing_year ??
    entry.h1b_last_year ??
    null

  const totalFilings =
    entry.totalFilings ??
    entry.total_filings ??
    entry.totalFilingsLast5Years ??
    null

  const updates =
    entry.recentUpdates ??
    entry.updates ??
    entry.latest_updates ??
    entry.news ??
    null

  let latestUpdate: LandingClubUpdate | null = null
  if (Array.isArray(updates) && updates.length > 0) {
    const rawUpdate = updates[0]
    const summary =
      rawUpdate.summary ||
      rawUpdate.description ||
      rawUpdate.title ||
      rawUpdate.headline ||
      ''
    const occurredAt =
      rawUpdate.occurredAt ||
      rawUpdate.date ||
      rawUpdate.updated_at ||
      rawUpdate.timestamp ||
      undefined
    latestUpdate = summary
      ? {
          summary,
          occurredAt,
        }
      : null
  }

  const visaTypes =
    entry.visaTypes ||
    entry.visa_types ||
    entry.supportedVisas ||
    entry.sponsorshipTypes ||
    entry.sponsorship_types ||
    null

  return {
    id: entry.id || entry.companyId || entry.slug || normalizedName,
    name: companyName,
    normalizedName: typeof normalizedName === 'string' ? normalizedName : normalizeCompanyName(companyName),
    visaTypes: Array.isArray(visaTypes) ? visaTypes : undefined,
    sponsorshipConfidence: typeof sponsorshipConfidence === 'number' ? Math.round(sponsorshipConfidence) : undefined,
    lastYearSponsored: typeof lastYear === 'number' ? lastYear : undefined,
    totalFilings: typeof totalFilings === 'number' ? totalFilings : undefined,
    latestUpdate,
    updatedAt: entry.updatedAt || entry.updated_at || entry.last_updated_at,
    raw: entry,
  }
}

export async function searchLandingClubSponsors(company: string) {
  if (!company) return []

  const data = await landingClubRequest<any>(
    `companies/search?query=${encodeURIComponent(company)}&limit=5`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // Provide query params through URL for clarity
    }
  )

  const candidates: any[] =
    Array.isArray((data as any)?.results) ? (data as any).results :
    Array.isArray((data as any)?.companies) ? (data as any).companies :
    Array.isArray(data) ? data :
    []

  return candidates
    .map(mapSponsorEntry)
    .filter((entry): entry is LandingClubSponsor => !!entry)
    .map((entry) => ({
      ...entry,
      normalizedName: normalizeCompanyName(entry.normalizedName || entry.name),
    }))
}

export async function getLandingClubSponsor(company: string) {
  const normalizedQuery = normalizeCompanyName(company)
  const results = await searchLandingClubSponsors(normalizedQuery)
  if (!results.length) return null

  const exactMatch = results.find((result) => normalizeCompanyName(result.name) === normalizedQuery)
  return exactMatch ?? results[0]
}
