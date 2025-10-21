import { NormalizedJob, isEarlyCareerRole } from './types'

interface SmartRecruitersLocation {
  city?: string
  region?: string
  country?: string
  remote?: boolean
}

interface SmartRecruitersJobAdSection {
  text?: string
}

interface SmartRecruitersJobAd {
  sections?: {
    jobDescription?: SmartRecruitersJobAdSection
    qualifications?: SmartRecruitersJobAdSection
  }
}

export interface SmartRecruitersPosting {
  id: string
  name: string
  refNumber?: string
  company?: {
    id?: string
    name?: string
  }
  location?: SmartRecruitersLocation
  postingUrl?: string
  applyUrl?: string
  jobAd?: SmartRecruitersJobAd
  publishedOn?: string
  createdOn?: string
  updatedOn?: string
  industry?: string
  jobLevel?: string
}

export interface SmartRecruitersResponse {
  totalFound?: number
  content?: SmartRecruitersPosting[]
}

function buildLocationString(location?: SmartRecruitersLocation) {
  if (!location) return 'Not specified'
  const parts = [location.city, location.region, location.country].filter(Boolean)
  if (!parts.length) {
    return location.remote ? 'Remote' : 'Not specified'
  }
  return parts.join(', ')
}

function coercePostedAt(posting: SmartRecruitersPosting) {
  const timestamp = posting.publishedOn || posting.updatedOn || posting.createdOn
  if (!timestamp) return undefined
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function extractSmartRecruitersJobs(
  response: SmartRecruitersResponse,
  fallbackCompanyName: string
): NormalizedJob[] {
  const postings = response.content ?? []
  const results: NormalizedJob[] = []

  for (const posting of postings) {
    const title = posting.name?.trim()
    if (!title || !isEarlyCareerRole(title)) {
      continue
    }

    const companyName =
      posting.company?.name?.trim() ||
      posting.company?.id?.trim() ||
      fallbackCompanyName

    const url = posting.applyUrl || posting.postingUrl
    if (!url) {
      continue
    }

    const description =
      posting.jobAd?.sections?.jobDescription?.text ||
      posting.jobAd?.sections?.qualifications?.text ||
      ''

    const location = buildLocationString(posting.location)
    const isRemote = Boolean(
      posting.location?.remote ||
        title.toLowerCase().includes('remote') ||
        location.toLowerCase().includes('remote')
    )

    results.push({
      title,
      company: companyName,
      location,
      url,
      description,
      jobType: title.toLowerCase().includes('intern') ? 'internship' : 'new_grad',
      isRemote,
      postedAt: coercePostedAt(posting),
    })
  }

  return results
}
