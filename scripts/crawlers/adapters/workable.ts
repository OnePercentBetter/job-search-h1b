import { NormalizedJob, JobCategory, isEarlyCareerRole } from './types'

interface WorkableLocation {
  city?: string
  state?: string
  country?: string
  remote?: boolean
}

interface WorkableDepartment {
  name?: string
}

export interface WorkableJob {
  id: string
  title: string
  shortcode?: string
  url: string
  employment_type?: string
  state?: string
  department?: WorkableDepartment
  published?: string
  updated_at?: string
  locations?: WorkableLocation[]
  description?: string
  requirements?: string
  benefits?: string
}

export interface WorkableJobsResponse {
  jobs: WorkableJob[]
}

export interface WorkableJobDetail {
  description?: string
  requirements?: string
  benefits?: string
}

export type WorkableDetailFetcher = (job: WorkableJob) => Promise<WorkableJobDetail | null>

function buildLocationString(locations?: WorkableLocation[]) {
  if (!locations || !locations.length) {
    return 'Not specified'
  }

  const [primary] = locations
  const parts = [primary.city, primary.state, primary.country].filter(Boolean)
  if (!parts.length && primary.remote) {
    return 'Remote'
  }
  if (!parts.length) {
    return 'Not specified'
  }
  return parts.join(', ')
}

function resolveJobType(title: string): JobCategory {
  const lower = title.toLowerCase()
  if (lower.includes('intern')) return 'internship'
  return 'new_grad'
}

function toUtcDate(timestamp?: string) {
  if (!timestamp) return undefined
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export async function extractWorkableJobs(
  response: WorkableJobsResponse,
  companyName: string,
  detailFetcher?: WorkableDetailFetcher
): Promise<NormalizedJob[]> {
  const jobs = response.jobs ?? []
  const results: NormalizedJob[] = []

  for (const job of jobs) {
    const title = job.title?.trim()
    if (!title || !isEarlyCareerRole(title)) {
      continue
    }

    const detail = detailFetcher ? await detailFetcher(job) : null
    const description =
      detail?.description ??
      job.description ??
      [job.requirements, detail?.requirements, detail?.benefits, job.benefits]
        .filter(Boolean)
        .join('\n\n')

    const location = buildLocationString(job.locations)
    const isRemote =
      Boolean(job.locations?.some((loc) => loc.remote)) ||
      location.toLowerCase().includes('remote') ||
      title.toLowerCase().includes('remote')

    results.push({
      title,
      company: companyName,
      location,
      url: job.url,
      description,
      jobType: resolveJobType(title),
      isRemote,
      postedAt: toUtcDate(job.published ?? job.updated_at),
    })
  }

  return results
}
