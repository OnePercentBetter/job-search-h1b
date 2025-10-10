import { MapPin, Building2, ExternalLink, Bookmark, ShieldCheck, CalendarDays, Info } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'

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
    visaSponsor?: {
      companyName: string
      sponsorshipConfidence: number | null
      lastYearSponsored: number | null
      visaTypes?: string[] | null
      latestUpdate?: { summary: string; occurredAt?: string } | null
      source?: string | null
    } | null
  }
}

export function JobCard({ job }: JobCardProps) {
  const [isSaving, setIsSaving] = useState(false)
  const { getAccessToken } = useAuth()
  const sponsorConfidence = job.visaSponsor?.sponsorshipConfidence ?? job.sponsorshipConfidence ?? null
  const visaBadgeLabel =
    job.visaSponsor?.sponsorshipConfidence && job.visaSponsor.sponsorshipConfidence >= 75
      ? 'Verified Sponsor'
      : job.visaSponsor?.sponsorshipConfidence
        ? 'Likely Sponsor'
        : 'Visa Friendly'
  const latestUpdateDate = job.visaSponsor?.latestUpdate?.occurredAt
  const formattedUpdateDate =
    latestUpdateDate && !Number.isNaN(new Date(latestUpdateDate).getTime())
      ? new Date(latestUpdateDate).toLocaleDateString()
      : null

  const handleSave = async () => {
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
          {job.visaSponsor && (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <ShieldCheck className="w-3 h-3 mr-1" /> {visaBadgeLabel}
            </span>
          )}
          {!job.visaSponsor && job.visaStatus === 'sponsor_verified' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <ShieldCheck className="w-3 h-3 mr-1" /> Visa Sponsor
            </span>
          )}
          {sponsorConfidence !== null && (
            <span>Confidence: {sponsorConfidence}%</span>
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

      {job.visaSponsor && (
        <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-600 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary-500" />
            <span>
              {job.visaSponsor.companyName}{' '}
              {job.visaSponsor.lastYearSponsored
                ? `(Last sponsored in ${job.visaSponsor.lastYearSponsored})`
                : ''}
            </span>
          </div>
          {job.visaSponsor.visaTypes && job.visaSponsor.visaTypes.length > 0 && (
            <div className="text-xs text-gray-500">
              Supports: {job.visaSponsor.visaTypes.join(', ')}
            </div>
          )}
          {job.visaSponsor.latestUpdate?.summary && (
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <CalendarDays className="w-4 h-4 mt-0.5 text-primary-400" />
              <p>
                {job.visaSponsor.latestUpdate.summary}
                {formattedUpdateDate && (
                  <span className="block text-[11px] text-gray-400 mt-1">
                    {formattedUpdateDate}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
