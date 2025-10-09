import { MapPin, Building2, ExternalLink, Bookmark, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

interface JobCardProps {
  job: {
    id: string
    title: string
    company: string
    location: string
    description: string
    url: string
    isRemote: boolean
    jobType: string
    visaStatus?: string
    sponsorshipConfidence?: number
    visaNotes?: string | null
  }
}

export function JobCard({ job }: JobCardProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      alert('Job saved!')
    } catch (error) {
      alert('Failed to save job')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.title}</h3>
          <div className="flex items-center text-gray-600 text-sm space-x-3">
            <span className="flex items-center">
              <Building2 className="w-4 h-4 mr-1" />
              {job.company}
            </span>
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {job.isRemote ? 'Remote' : job.location}
            </span>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-gray-400 hover:text-primary-600 transition-colors"
        >
          <Bookmark className="w-5 h-5" />
        </button>
      </div>

      <p className="text-gray-700 text-sm mb-4 line-clamp-3">
        {job.description || 'No description available'}
      </p>

      <div className="flex justify-between items-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
          {job.jobType === 'new_grad' ? 'New Grad' : 'Internship'}
        </span>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {job.visaStatus === 'sponsor_verified' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <ShieldCheck className="w-3 h-3 mr-1" /> Visa Sponsor
            </span>
          )}
          {typeof job.sponsorshipConfidence === 'number' && (
            <span>Confidence: {job.sponsorshipConfidence}%</span>
          )}
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          Apply
          <ExternalLink className="w-4 h-4 ml-1" />
        </a>
      </div>
    </div>
  )
}

