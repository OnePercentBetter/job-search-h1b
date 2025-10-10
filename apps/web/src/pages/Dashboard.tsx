import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { SearchBar } from '../components/SearchBar'
import { Filters } from '../components/Filters'
import { useAuth } from '../providers/AuthProvider'
import {
  Building2,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Info,
  CalendarDays,
  Bookmark,
  Sparkles,
  Clock,
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

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({
    jobType: 'all',
    isRemote: undefined as boolean | undefined,
    location: '',
    visaStatus: undefined as string | undefined,
    minConfidence: undefined as number | undefined,
    requiresVerifiedSponsor: undefined as boolean | undefined,
  })
  const { session, getAccessToken } = useAuth()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['jobs', debouncedSearch, filters, session?.user?.id],
    queryFn: async ({ pageParam = 0 }) => {
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
        limit: '50',
        offset: String(pageParam),
      })

      const response = await fetch(`/api/jobs/search?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch jobs')
      return response.json()
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length * 50
      }
      return undefined
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  })

  const allJobs: Job[] = data?.pages.flatMap((page: { jobs: Job[] }) => page.jobs) ?? []
  const totalJobs = data?.pages[0]?.total ?? 0
  const selectedJob = useMemo(
    () => allJobs.find((job) => job.id === selectedJobId) ?? null,
    [allJobs, selectedJobId]
  )

  useEffect(() => {
    if (!allJobs.length) {
      setSelectedJobId(null)
      return
    }
    if (!selectedJobId || !allJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(allJobs[0].id)
    }
  }, [allJobs, selectedJobId])

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node || isLoading || isFetchingNextPage) {
        return
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage) {
            fetchNextPage()
          }
        },
        { threshold: 0.1 }
      )

      observerRef.current.observe(node)
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  )

  useEffect(
    () => () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    },
    []
  )

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Perfect Role</h1>
          <p className="text-gray-600">
            Discover new grad positions and internships tailored to your preferences
          </p>
        </div>

        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="space-y-4 lg:sticky lg:top-24 self-start">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-600" />
                Smart Match Tips
              </h2>
              <ul className="text-xs text-gray-600 space-y-2">
                <li>• Refine your profile description to guide the AI ranking.</li>
                <li>• Use filters to focus on visa-friendly companies.</li>
                <li>• Save roles to track and compare later.</li>
              </ul>
            </div>
            <Filters filters={filters} onChange={setFilters} />
          </aside>

          <div className="space-y-4">
            {isLoading && !data && (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 space-y-4"
                  >
                    <div className="h-4 w-3/5 bg-gray-200 rounded" />
                    <div className="h-3 w-2/5 bg-gray-200 rounded" />
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="flex gap-2">
                      <div className="h-6 w-20 bg-gray-200 rounded-full" />
                      <div className="h-6 w-24 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isFetching && data && !isFetchingNextPage && (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                Updating results...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Failed to load jobs. Please try again.</p>
              </div>
            )}

            {!isLoading && allJobs.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No matches yet</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Try adjusting your search terms or filters. Updating your profile with more details can also improve matches.
                </p>
              </div>
            )}

            {allJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    Showing {allJobs.length} of {totalJobs} matches
                  </span>
                  {totalJobs > allJobs.length && (
                    <span className="text-primary-600">Scroll or load more for additional roles</span>
                  )}
                </div>

                {allJobs.map((job) => {
                  const isActive = job.id === selectedJobId
                  const matchScore = Math.round((job.matchScore ?? 0) * 100)
                  const locationLabel = job.isRemote ? 'Remote' : job.location ?? 'Location unavailable'
                  const jobTypeLabel =
                    job.jobType === 'new_grad'
                      ? 'New Grad'
                      : job.jobType === 'internship'
                        ? 'Internship'
                        : 'Role'
                  return (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`w-full text-left rounded-xl border transition-all ${
                        isActive
                          ? 'border-primary-300 bg-primary-50/70 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-4 h-4" />
                                {job.company}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {locationLabel}
                              </span>
                              {job.postedAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {formatRelativeDate(job.postedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs uppercase text-gray-500">Match score</span>
                            <div className="text-2xl font-semibold text-primary-600">
                              {matchScore}
                              <span className="text-sm font-medium text-primary-500 ml-1">%</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 line-clamp-2">
                          {job.description || 'No description provided.'}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary-100 text-primary-800">
                            {jobTypeLabel}
                          </span>
                          {job.visaSponsor && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Visa friendly
                            </span>
                          )}
                          {!job.visaSponsor && job.visaStatus === 'sponsor_verified' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Sponsor verified
                            </span>
                          )}
                          {(job.matchReasons ?? []).slice(0, 2).map((reason, reasonIndex) => (
                            <span
                              key={reasonIndex}
                              className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}

                {hasNextPage && (
                  <div className="flex flex-col items-center gap-2 pt-4">
                    <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isFetchingNextPage
                        ? 'Loading more jobs...'
                        : `Load More Jobs (${Math.max(totalJobs - allJobs.length, 0)} remaining)`}
                    </button>
                    <div className="text-xs text-gray-400">Auto-load triggers as you scroll</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <section className="hidden xl:block lg:sticky lg:top-24 self-start">
            <JobDetailPanel job={selectedJob} />
          </section>
        </div>

        <div className="xl:hidden">
          <JobDetailPanel job={selectedJob} />
        </div>
      </div>
    </Layout>
  )
}

function formatRelativeDate(date: string | null | undefined) {
  if (!date) return 'Date unavailable'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'

  const diffMs = Date.now() - parsed.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Posted today'
  if (diffDays === 1) return 'Posted yesterday'
  if (diffDays < 7) return `Posted ${diffDays} days ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) return `Posted ${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  const diffMonths = Math.floor(diffDays / 30)
  return `Posted ${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
}

interface JobDetailPanelProps {
  job: Job | null
}

function JobDetailPanel({ job }: JobDetailPanelProps) {
  const { getAccessToken } = useAuth()
  const [isSaving, setIsSaving] = useState(false)

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
      alert('Job saved!')
    } catch (error) {
      console.error('Failed to save job', error)
      alert('Failed to save job')
    } finally {
      setIsSaving(false)
    }
  }, [getAccessToken, job])

  if (!job) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
        Select a role to see details and personalized match insights.
      </div>
    )
  }

  const matchScore = Math.round((job.matchScore ?? 0) * 100)
  const locationLabel = job.isRemote ? 'Remote' : job.location ?? 'Location unavailable'
  const jobTypeLabel =
    job.jobType === 'new_grad'
      ? 'New Grad'
      : job.jobType === 'internship'
        ? 'Internship'
        : 'Role'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{job.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {job.company}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {locationLabel}
            </span>
            {job.postedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatRelativeDate(job.postedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase text-gray-500">Match score</span>
          <div className="text-3xl font-semibold text-primary-600">
            {matchScore}
            <span className="text-sm font-medium text-primary-500 ml-1">%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary-100 text-primary-800">
          {jobTypeLabel}
        </span>
        {job.visaSponsor && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Visa friendly
          </span>
        )}
        {!job.visaSponsor && job.visaStatus === 'sponsor_verified' && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Sponsor verified
          </span>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-500" />
          Why this role stands out
        </h3>
        <div className="space-y-2">
          {(job.matchReasons ?? []).map((reason, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1 w-2 h-2 rounded-full bg-primary-400"></span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
        {job.scoreDetails && (
          <div className="space-y-2">
            <ScoreMeter label="Profile match" value={job.scoreDetails.similarity} />
            <ScoreMeter label="Recency" value={job.scoreDetails.recency} />
            <ScoreMeter label="Visa confidence" value={job.scoreDetails.sponsorship} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary-500" />
          Job overview
        </h3>
        <p className="text-sm text-gray-700 whitespace-pre-line">
          {job.description || 'No description provided.'}
        </p>
      </div>

      {job.visaSponsor && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Visa sponsorship insights
          </h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              {job.visaSponsor.companyName}{' '}
              {job.visaSponsor.lastYearSponsored
                ? `(Last sponsored in ${job.visaSponsor.lastYearSponsored})`
                : ''}
            </p>
            {job.visaSponsor.sponsorshipConfidence !== null && (
              <p>Confidence score: {job.visaSponsor.sponsorshipConfidence}%</p>
            )}
            {job.visaSponsor.visaTypes && job.visaSponsor.visaTypes.length > 0 && (
              <p>Supports: {job.visaSponsor.visaTypes.join(', ')}</p>
            )}
            {job.visaSponsor.latestUpdate?.summary && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <CalendarDays className="w-4 h-4 mt-0.5 text-primary-400" />
                <p>
                  {job.visaSponsor.latestUpdate.summary}
                  {job.visaSponsor.latestUpdate.occurredAt && (
                    <span className="block text-xs text-gray-400 mt-1">
                      {new Date(job.visaSponsor.latestUpdate.occurredAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:border-primary-300 hover:text-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Bookmark className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save to applications'}
        </button>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          Apply now
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
