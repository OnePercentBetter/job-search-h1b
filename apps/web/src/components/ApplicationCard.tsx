interface ApplicationCardProps {
  application: {
    id: string
    status: string
    appliedAt: string
    notes?: string
  }
}

export function ApplicationCard({ application }: ApplicationCardProps) {
  const statusColors = {
    saved: 'bg-gray-100 text-gray-800',
    applied: 'bg-blue-100 text-blue-800',
    interviewing: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
    offer: 'bg-green-100 text-green-800',
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-600">
            {new Date(application.appliedAt).toLocaleDateString()}
          </p>
          {application.notes && (
            <p className="text-sm text-gray-700 mt-2">{application.notes}</p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            statusColors[application.status as keyof typeof statusColors]
          }`}
        >
          {application.status}
        </span>
      </div>
    </div>
  )
}

