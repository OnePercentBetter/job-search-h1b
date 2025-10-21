import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { ApplicationCard } from '../components/ApplicationCard'
import { useAuth } from '../providers/AuthProvider'

export function Applications() {
  const { session, getAccessToken } = useAuth()

  const { data, isLoading, isError } = useQuery({
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
  })

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto px-6 lg:px-10 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Application Tracker</p>
          <h1 className="text-3xl font-semibold text-slate-900">Saved vs applied roles at a glance</h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Keep tabs on what still needs attention and what&apos;s already in motion.
          </p>
        </header>

        {isLoading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading applications...
          </div>
        )}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            Unable to load applications right now.
          </div>
        )}

        {data && data.count > 0 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">
              Tracking {data.count} {data.count === 1 ? 'role' : 'roles'} across your pipeline.
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Saved for later</h2>
                    <p className="text-xs text-slate-500">
                      Roles you&apos;ve bookmarked but haven&apos;t acted on yet.
                    </p>
                  </div>
                  <span className="text-sm font-medium text-sky-600">
                    {
                      data.applications.filter(
                        (application: { status?: string }) => application.status === 'saved'
                      ).length
                    }
                  </span>
                </div>
                <div className="space-y-4">
                  {data.applications
                    .filter((application: { status?: string }) => application.status === 'saved')
                    .map((application: any) => (
                      <ApplicationCard key={application.id} application={application} />
                    ))}
                  {data.applications.every((application: { status?: string }) => application.status !== 'saved') && (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
                      Nothing saved right now. Head back to the dashboard to star interesting roles.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-emerald-700">Applied &amp; in progress</h2>
                    <p className="text-xs text-emerald-700/80">
                      Everything that&apos;s moved beyond just being saved, including interviews and offers.
                    </p>
                  </div>
                  <span className="text-sm font-medium text-emerald-700">
                    {
                      data.applications.filter(
                        (application: { status?: string }) => application.status !== 'saved'
                      ).length
                    }
                  </span>
                </div>
                <div className="space-y-4">
                  {data.applications
                    .filter((application: { status?: string }) => application.status !== 'saved')
                    .map((application: any) => (
                      <ApplicationCard key={application.id} application={application} />
                    ))}
                  {data.applications.every((application: { status?: string }) => application.status === 'saved') && (
                    <p className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 px-4 py-6 text-sm text-emerald-700/80">
                      You haven&apos;t applied to any roles yet. Check off jobs from the dashboard when you take action.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {data && data.count === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-left shadow-sm">
            <p className="text-sm text-slate-600">
              You haven&apos;t saved or applied to any jobs yet. Explore the dashboard and start tracking opportunities that matter.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
