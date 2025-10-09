import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { ApplicationCard } from '../components/ApplicationCard'

export function Applications() {
  const { data, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await fetch('/api/applications')
      if (!response.ok) throw new Error('Failed to fetch applications')
      return response.json()
    },
  })

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Applications</h1>

        {isLoading && <p>Loading applications...</p>}

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

