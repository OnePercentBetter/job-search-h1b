import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuth } from '../providers/AuthProvider'

interface ProfileResponse {
  profile: {
    id: string
    email?: string | null
    profileDescription?: string | null
    createdAt?: string | null
    visaSponsorId?: string | null
  }
}

export function Profile() {
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const { session, getAccessToken } = useAuth()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user?.id],
    enabled: !!session,
    queryFn: async (): Promise<ProfileResponse> => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Unable to load profile without an access token')
      }
      const response = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      return response.json()
    },
  })

  const profile = useMemo(() => profileQuery.data?.profile, [profileQuery.data])

  useEffect(() => {
    if (profile && !hasInitialized) {
      setDescription(profile.profileDescription ?? '')
      setHasInitialized(true)
    }
  }, [profile, hasInitialized])

  const handleSave = async () => {
    setIsSaving(true)
    setFeedback(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ description }),
      })
      if (!response.ok) throw new Error('Failed to save profile')
      const data: ProfileResponse = await response.json()
      setFeedback({ type: 'success', message: 'Profile updated successfully.' })
      setDescription(data.profile.profileDescription ?? '')
      profileQuery.refetch()
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    } catch (error) {
      console.error('Failed to save profile', error)
      setFeedback({ type: 'error', message: 'Failed to save profile. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
            <p className="text-gray-600">
              We use your preferences to personalize job matches and prioritize the right companies.
            </p>
          </div>
          {profile?.email && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {profile.email}
            </span>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          {feedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What are you looking for?
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Describe your ideal role, skills, interests, and preferences. Our AI will use this to find the best matches for you.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 min-h-[200px] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Example: I'm looking for a software engineering new grad role focused on backend development. I'm interested in fintech or healthcare startups, preferably in NYC or remote. I have experience with Python, Node.js, and PostgreSQL..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={profileQuery.isLoading}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {profile?.createdAt
                ? `Profile created ${new Date(profile.createdAt).toLocaleDateString()}`
                : 'Profile not saved yet'}
            </span>
            <span>{description.length}/2000 characters</span>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || description.length < 10}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
