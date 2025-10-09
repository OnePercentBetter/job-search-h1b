import { useState } from 'react'
import { Layout } from '../components/Layout'

export function Profile() {
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      if (!response.ok) throw new Error('Failed to save')
      alert('Profile updated successfully!')
    } catch (error) {
      alert('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Profile</h1>

        <div className="bg-white rounded-lg shadow-sm p-6">
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
          />
          <div className="mt-4 flex justify-end">
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

