interface FiltersProps {
  filters: {
    jobType: string
    isRemote?: boolean
    location: string
    visaStatus?: string
    minConfidence?: number
    requiresVerifiedSponsor?: boolean
  }
  onChange: (filters: any) => void
}

export function Filters({ filters, onChange }: FiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Type
          </label>
          <select
            value={filters.jobType}
            onChange={(e) => onChange({ ...filters, jobType: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All</option>
            <option value="new_grad">New Grad</option>
            <option value="internship">Internship</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            placeholder="e.g., NYC, San Francisco"
            value={filters.location}
            onChange={(e) => onChange({ ...filters, location: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remote
          </label>
          <select
            value={filters.isRemote === undefined ? 'all' : String(filters.isRemote)}
            onChange={(e) =>
              onChange({
                ...filters,
                isRemote: e.target.value === 'all' ? undefined : e.target.value === 'true',
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All</option>
            <option value="true">Remote Only</option>
            <option value="false">On-site</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Visa Status
          </label>
          <select
            value={filters.visaStatus || 'all'}
            onChange={(e) =>
              onChange({
                ...filters,
                visaStatus: e.target.value === 'all' ? undefined : e.target.value,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All</option>
            <option value="sponsor_verified">Sponsor Verified</option>
            <option value="likely_sponsor">Likely Sponsor</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Confidence
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={filters.minConfidence ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                minConfidence: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            placeholder="0-100"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex items-center mt-6">
          <input
            id="requiresSponsor"
            type="checkbox"
            checked={filters.requiresVerifiedSponsor ?? false}
            onChange={(e) =>
              onChange({
                ...filters,
                requiresVerifiedSponsor: e.target.checked || undefined,
                visaStatus: e.target.checked ? 'sponsor_verified' : filters.visaStatus,
              })
            }
            className="h-4 w-4 text-primary-600 border-gray-300 rounded"
          />
          <label htmlFor="requiresSponsor" className="ml-2 text-sm text-gray-700">
            Verified sponsors only
          </label>
        </div>
      </div>
    </div>
  )
}

