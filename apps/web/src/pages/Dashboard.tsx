import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { SearchBar } from '../components/SearchBar'
import { Filters } from '../components/Filters'
import { useAuth } from '../providers/AuthProvider'
import {
  Bookmark,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react'

interface Job {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  url: string
  isRemote: boolean | null
  jobType: string | null
  source: string | null
  scrapedAt: string | null
  visaStatus?: string
  sponsorshipConfidence?: number
  visaNotes?: string | null
  postedAt?: string | null
  similarity?: number
  matchScore?: number
  scoreDetails?: {
    similarity: number
    recency: number
    sponsorship: number
  }
  matchReasons?: string[]
  visaSponsor?: {
    id: string
    companyName: string
    sponsorshipConfidence: number | null
    lastYearSponsored: number | null
    visaTypes?: string[] | null
    latestUpdate?: { summary: string; occurredAt?: string } | null
    totalFilings?: number | null
    source?: string | null
  } | null
}

const FALLBACK_LOCATION = 'Location unavailable'

interface JobsResponse {
  jobs: Job[]
  total: number
  hasMore?: boolean
}

interface ApplicationsResponse {
  applications: Array<{
    id: string
    status?: string | null
    job?: { id?: string | null } | null
    jobId?: string | null
  }>
  count?: number
}

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [markingApplied, setMarkingApplied] = useState<Record<string, boolean>>({})
  const [filters, setFilters] = useState({
    jobType: 'all',
    isRemote: undefined as boolean | undefined,
    location: '',
    visaStatus: undefined as string | undefined,
    minConfidence: undefined as number | undefined,
    requiresVerifiedSponsor: undefined as boolean | undefined,
  })
  const { session, getAccessToken } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setFiltersOpen(true)
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, filters])

  const PAGE_SIZE = 30

  const { data, error, isLoading, isFetching } = useQuery<JobsResponse>({
    queryKey: ['jobs', session?.user?.id, debouncedSearch, filters, currentPage],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication token unavailable')
      }

      const params = new URLSearchParams({
        ...(debouncedSearch && { description: debouncedSearch }),
        ...(filters.jobType !== 'all' && { jobType: filters.jobType }),
        ...(filters.isRemote !== undefined && { isRemote: String(filters.isRemote) }),
        ...(filters.location && { location: filters.location }),
        ...(filters.visaStatus && { visaStatus: filters.visaStatus }),
        ...(filters.minConfidence !== undefined && {
          minSponsorshipConfidence: String(filters.minConfidence),
        }),
        ...(filters.requiresVerifiedSponsor && { requiresVerifiedSponsor: 'true' }),
        limit: String(PAGE_SIZE),
        offset: String((currentPage - 1) * PAGE_SIZE),
      })

      const response = await fetch(`/api/jobs/search?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch jobs')
      return response.json()
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    placeholderData: (previousData) => previousData,
  })

  const { data: applicationsData, refetch: refetchApplications } = useQuery<ApplicationsResponse>({
    queryKey: ['applications', session?.user?.id],
    enabled: !!session,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication token unavailable')
      }
      const response = await fetch('/api/applications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch applications')
      return response.json()
    },
    staleTime: 1000 * 60 * 2,
  })

  const appliedJobIds = useMemo(() => {
    if (!applicationsData?.applications) return new Set<string>()
    const ids = applicationsData.applications
      .filter((application) => application.status === 'applied')
      .map((application) => {
        if (application.job?.id) return application.job.id
        if (application.jobId) return application.jobId
        return null
      })
      .filter((id): id is string => Boolean(id))
    return new Set(ids)
  }, [applicationsData])

  const totalJobs = data?.total ?? 0
  const totalPages = totalJobs > 0 ? Math.ceil(totalJobs / PAGE_SIZE) : 0
  const jobs: Job[] = data?.jobs ?? []
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!jobs.length) {
      setSelectedJobId(null)
      return
    }
    if (!selectedJobId || !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(jobs[0].id)
    }
  }, [jobs, selectedJobId])

  const handleMarkApplied = useCallback(
    async (jobId: string) => {
      if (!jobId || appliedJobIds.has(jobId)) return

      setMarkingApplied((prev) => ({ ...prev, [jobId]: true }))
      try {
        const token = await getAccessToken()
        if (!token) {
          throw new Error('Authentication required')
        }
        await fetch('/api/applications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ jobId, status: 'applied' }),
        })
        await refetchApplications()
      } catch (applyError) {
        console.error('Failed to mark job as applied', applyError)
      } finally {
        setMarkingApplied((prev) => {
          const updated = { ...prev }
          delete updated[jobId]
          return updated
        })
      }
    },
    [getAccessToken, appliedJobIds, refetchApplications]
  )

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-10 xl:px-12 py-10 space-y-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Your Visa-Friendly Feed</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
            Curated matches based on your profile
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Dial in your preferences and let the AI surface the most relevant roles. Save favorites or quick apply when something stands out.
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-sky-300 hover:text-sky-600 hover:shadow"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {filtersOpen ? 'Hide filters' : 'Show filters'}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm p-6 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Filter your feed</p>
                <p className="text-xs text-slate-500">
                  Combine location, visa backing, and role specifics to narrow matches.
                </p>
              </div>
              <button
                onClick={() => setFiltersOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                <X className="w-3 h-3" />
                Collapse
              </button>
            </div>
            <Filters filters={filters} onChange={setFilters} withContainer={false} className="pt-2" />
          </div>
        )}

        <div className="grid gap-6 items-start xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <section className="space-y-5">
            <div className="rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 to-slate-50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white shadow-sm p-2">
                    <Sparkles className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Smart matching is live</p>
                    <p className="text-xs text-slate-500">
                      Scores blend profile fit, recency, and visa confidence. Update your profile to steer the feed.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Showing {jobs.length} of {totalJobs} matches</p>
              </div>
            </div>

            {isLoading && !data && (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm"
                  >
                    <div className="h-4 w-3/5 bg-slate-200 rounded-full" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded-full" />
                    <div className="h-3 w-full bg-slate-200 rounded-full" />
                    <div className="h-3 w-4/5 bg-slate-200 rounded-full" />
                    <div className="h-2 w-full bg-slate-200 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
                <p className="text-sm font-semibold text-rose-700">Unable to load jobs right now.</p>
                <p className="text-xs text-rose-500 mt-1">Try adjusting your filters or refreshing the page.</p>
              </div>
            )}

            {isFetching && !isLoading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                Updating results…
              </div>
            )}

            {!isLoading && jobs.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No matches just yet</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Try broadening your filters or enrich your profile with more specifics so we can personalize the feed better.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {jobs.map((job) => (
                <JobListItem
                  key={job.id}
                  job={job}
                  isActive={job.id === selectedJobId}
                  onSelect={() => setSelectedJobId(job.id)}
                  isApplied={appliedJobIds.has(job.id)}
                  isMarkingApplied={Boolean(markingApplied[job.id])}
                  onMarkApplied={handleMarkApplied}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                isFetching={isFetching}
              />
            )}
          </section>

          <JobDetailPanel
            job={selectedJob}
            isApplied={selectedJob ? appliedJobIds.has(selectedJob.id) : false}
            isMarkingApplied={selectedJob ? Boolean(markingApplied[selectedJob.id]) : false}
            onMarkApplied={handleMarkApplied}
          />
        </div>
      </div>
    </Layout>
  )
}

function JobListItem({
  job,
  isActive,
  onSelect,
  isApplied,
  isMarkingApplied,
  onMarkApplied,
}: {
  job: Job
  isActive: boolean
  onSelect: () => void
  isApplied: boolean
  isMarkingApplied: boolean
  onMarkApplied: (jobId: string) => void
}) {
  const matchScore = Math.round((job.matchScore ?? 0) * 100)
  const { primaryLocation, extraCount } = parseLocation(job)
  const relativePosted = formatRelativeDate(job.postedAt)
  const badgeLabel =
    job.visaSponsor?.sponsorshipConfidence && job.visaSponsor.sponsorshipConfidence >= 75
      ? 'Verified sponsor'
      : job.visaSponsor
        ? 'Visa friendly'
        : job.visaStatus === 'sponsor_verified'
          ? 'Sponsor verified'
          : null

  return (
    <button
      onClick={onSelect}
      className={`group w-full rounded-3xl border p-6 text-left transition-all ${
        isActive
          ? 'border-sky-400 bg-white shadow-xl shadow-sky-100/60'
          : 'border-slate-200 bg-white/80 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md hover:shadow-sky-100/50'
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {job.jobType === 'internship' ? 'Internship' : 'New Grad'}
            </p>
            <h3 className="text-lg md:text-xl font-semibold text-slate-900 leading-snug">
              {job.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>🏢</span>
                <span className="font-medium text-slate-600">{job.company}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>📍</span>
                <span>
                  {primaryLocation}
                  {extraCount > 0 && (
                    <span className="text-xs text-slate-400"> • +{extraCount} more</span>
                  )}
                </span>
              </span>
              {relativePosted && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>⏰</span>
                  <span>{relativePosted}</span>
                </span>
              )}
            </div>
          </div>
          <div className="w-full max-w-[160px] ml-auto">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
              <span>Match</span>
              <span className="font-semibold text-slate-600">{matchScore}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-sky-400 transition-all"
                style={{ width: `${matchScore}%` }}
              />
            </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <label className="inline-flex items-center gap-2 font-medium text-slate-600">
          <input
            type="checkbox"
            checked={isApplied}
            onChange={() => {
              if (!isApplied) {
                onMarkApplied(job.id)
              }
            }}
            disabled={isApplied || isMarkingApplied}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          {isApplied ? 'Applied' : isMarkingApplied ? 'Marking…' : 'Mark as applied'}
        </label>
      </div>

      {job.description && (
        <p className="text-sm text-slate-600 line-clamp-2">
          {job.description}
        </p>
      )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {badgeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
              <ShieldCheck className="w-3 h-3" />
              {badgeLabel}
            </span>
          )}
          {(job.matchReasons ?? []).slice(0, 2).map((reason, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

function JobDetailPanel({
  job,
  isApplied,
  isMarkingApplied,
  onMarkApplied,
}: {
  job: Job | null
  isApplied: boolean
  isMarkingApplied: boolean
  onMarkApplied: (jobId: string) => void
}) {
  const { getAccessToken } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const handleSave = useCallback(async () => {
    if (!job) return
    setIsSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }
      await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      })
    } catch (error) {
      console.error('Failed to save job', error)
    } finally {
      setIsSaving(false)
    }
  }, [getAccessToken, job])

  const handleQuickApply = useCallback(async () => {
    if (!job) return
    setIsApplying(true)
    try {
      const token = await getAccessToken()
      if (token) {
        await fetch('/api/applications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ jobId: job.id }),
        })
      }
    } catch (error) {
      console.error('Failed to quick apply', error)
    } finally {
      setIsApplying(false)
      window.open(job.url, '_blank', 'noopener')
    }
  }, [getAccessToken, job])

  if (!job) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Select a role to preview details</h2>
        <p className="mt-2 text-sm text-slate-500">
          Pick any job from the list to see why it surfaced, review the description, and quick apply or save it for later.
        </p>
      </div>
    )
  }

  const matchScore = Math.round((job.matchScore ?? 0) * 100)
  const { primaryLocation } = parseLocation(job)
  const relativePosted = formatRelativeDate(job.postedAt)

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-sky-100/60 space-y-6 self-start h-fit">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Match #{matchScore}</p>
        <h2 className="text-2xl font-semibold text-slate-900 leading-snug">{job.title}</h2>
        <div className="text-sm text-slate-500 space-y-1">
          <p>
            <span className="font-medium text-slate-700">{job.company}</span> • {primaryLocation}
          </p>
          {relativePosted && <p>Posted {relativePosted}</p>}
        </div>
      </div>

      {job.scoreDetails && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Match breakdown
          </p>
          <MatchMeter label="Profile fit" value={job.scoreDetails.similarity} accent="from-sky-500 to-blue-500" />
          <MatchMeter label="Recency" value={job.scoreDetails.recency} accent="from-amber-400 to-orange-500" />
          <MatchMeter label="Visa confidence" value={job.scoreDetails.sponsorship} accent="from-emerald-400 to-emerald-500" />
        </div>
      )}

      {!!(job.matchReasons && job.matchReasons.length) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500" />
            Why we surfaced this
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {job.matchReasons.map((reason, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Role snapshot</h3>
        <p className="text-sm text-slate-600 whitespace-pre-line">
          {job.description || 'No description provided by the employer.'}
        </p>
      </div>

      {job.visaSponsor && (
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Visa sponsorship insights
          </h3>
          <ul className="space-y-2 text-sm text-emerald-700/90">
            <li>
              <span className="font-medium">{job.visaSponsor.companyName}</span>
              {job.visaSponsor.lastYearSponsored && (
                <span className="ml-1 text-xs text-emerald-600">
                  (last sponsored in {job.visaSponsor.lastYearSponsored})
                </span>
              )}
            </li>
            {job.visaSponsor.sponsorshipConfidence !== null && (
              <li>Confidence score: {job.visaSponsor.sponsorshipConfidence}%</li>
            )}
            {job.visaSponsor.visaTypes && job.visaSponsor.visaTypes.length > 0 && (
              <li>Supports: {job.visaSponsor.visaTypes.join(', ')}</li>
            )}
            {job.visaSponsor.latestUpdate?.summary && (
              <li className="text-xs text-emerald-600">
                {job.visaSponsor.latestUpdate.summary}
                {job.visaSponsor.latestUpdate.occurredAt && (
                  <span className="block text-[11px]">
                    {new Date(job.visaSponsor.latestUpdate.occurredAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={isApplied}
            onChange={() => {
              if (job && !isApplied) {
                onMarkApplied(job.id)
              }
            }}
            disabled={isApplied || isMarkingApplied}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          {isApplied ? 'Applied' : isMarkingApplied ? 'Marking…' : 'Mark as applied'}
        </label>
        <button
          onClick={handleQuickApply}
          disabled={isApplying}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ExternalLink className="w-4 h-4" />
          {isApplying ? 'Opening...' : 'Quick apply'}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Bookmark className="w-4 h-4" />
          {isSaving ? 'Saving…' : 'Save for later'}
        </button>
      </div>
    </aside>
  )
}

function MatchMeter({ label, value, accent }: { label: string; value: number; accent: string }) {
  const percentage = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-600">{percentage}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accent} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function parseLocation(job: Job) {
  if (job.isRemote) {
    return { primaryLocation: 'Remote', extraCount: 0 }
  }
  if (!job.location) {
    return { primaryLocation: FALLBACK_LOCATION, extraCount: 0 }
  }

  const parts = job.location
    .split(/[,|\/|•]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!parts.length) {
    return { primaryLocation: job.location, extraCount: 0 }
  }

  return { primaryLocation: parts[0], extraCount: Math.max(parts.length - 1, 0) }
}

function formatRelativeDate(date: string | null | undefined) {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null

  const diffMs = Date.now() - parsed.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isFetching,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  isFetching: boolean
}) {
  if (totalPages <= 1) return null

  const visible = 5
  const half = Math.floor(visible / 2)
  let start = Math.max(currentPage - half, 1)
  let end = start + visible - 1
  if (end > totalPages) {
    end = totalPages
    start = Math.max(end - visible + 1, 1)
  }

  const pages = []
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-all hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Previous
      </button>
      <div className="flex items-center gap-2">
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
              page === currentPage
                ? 'bg-sky-500 text-white shadow-sm'
                : 'border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600'
            }`}
          >
            {page}
          </button>
        ))}
        {end < totalPages && (
          <span className="text-sm text-slate-400">… {totalPages}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-all hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Next
      </button>
      {isFetching && (
        <span className="text-xs text-slate-400">Refreshing…</span>
      )}
    </nav>
  )
}
