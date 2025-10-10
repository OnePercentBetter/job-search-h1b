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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Applications</h1>

        {isLoading && <p>Loading applications...</p>}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            Unable to load applications right now.
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <p className="text-gray-600">{data.count} applications tracked</p>
            {data.applications.map((app: any) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
        )}

        {data && data.count === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600">No applications yet. Start saving jobs from the dashboard!</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
