import { useState, useEffect, useCallback } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { JobCard } from '../components/JobCard'
import { SearchBar } from '../components/SearchBar'
import { Filters } from '../components/Filters'

interface Job {
  id: string
  title: string
  company: string
  location: string
  description: string
  url: string
  isRemote: boolean
  jobType: string
  source: string
  scrapedAt: string
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

  // Debounce search query - wait 500ms after user stops typing
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
    queryKey: ['jobs', debouncedSearch, filters],
    queryFn: async ({ pageParam = 0 }) => {
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
        limit: '50', // Load 50 jobs at a time
        offset: String(pageParam),
      })
      
      const response = await fetch(`/api/jobs/search?${params}`, {
        headers: {
          'x-user-id': 'fd09d910-ed35-4f74-9db2-769c1a85c49a' // Use the profile ID we created
        }
      })
      if (!response.ok) throw new Error('Failed to fetch jobs')
      return response.json()
    },
    getNextPageParam: (lastPage, pages) => {
      // If there are more jobs, return the next offset
      if (lastPage.hasMore) {
        return pages.length * 50 // 50 jobs per page
      }
      return undefined
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  })

  // Flatten all pages into a single array of jobs
  const allJobs = data?.pages.flatMap(page => page.jobs) ?? []
  const totalJobs = data?.pages[0]?.total ?? 0

  // Infinite scroll: Load more when user scrolls near bottom
  const loadMoreRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingNextPage) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )
    
    if (node) observer.observe(node)
    
    return () => observer.disconnect()
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage])

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Perfect Role
          </h1>
          <p className="text-gray-600">
            Discover new grad positions and internships tailored to your preferences
          </p>
        </div>

        <div className="space-y-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <Filters filters={filters} onChange={setFilters} />

          {/* Show loading spinner only on initial load */}
          {isLoading && !data && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading jobs...</p>
            </div>
          )}

          {/* Show subtle indicator when re-fetching */}
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

          {allJobs.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Showing {allJobs.length} of {totalJobs} jobs
                {totalJobs > allJobs.length && (
                  <span className="text-primary-600 ml-2">
                    • Scroll down or click "Load More" to see more
                  </span>
                )}
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allJobs.map((job: Job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
              
              {/* Infinite scroll trigger */}
              {hasNextPage && (
                <div ref={loadMoreRef} className="text-center mt-8">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isFetchingNextPage ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Loading more jobs...
                      </span>
                    ) : (
                      `Load More Jobs (${totalJobs - allJobs.length} remaining)`
                    )}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    Or scroll down to auto-load more jobs
                  </p>
                </div>
              )}
              
              {/* All jobs loaded indicator */}
              {!hasNextPage && allJobs.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">
                    🎉 You've seen all {totalJobs} jobs! 
                    {totalJobs > 50 && " Try adjusting your filters to find more specific opportunities."}
                  </p>
                </div>
              )}
            </div>
          )}

          {allJobs.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                No jobs found. Try adjusting your search or filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

