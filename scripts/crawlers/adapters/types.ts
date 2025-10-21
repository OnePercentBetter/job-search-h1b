export type JobCategory = 'new_grad' | 'internship'

export interface NormalizedJob {
  title: string
  company: string
  location: string
  url: string
  description: string
  jobType: JobCategory
  isRemote: boolean
  postedAt?: Date
}

export function isEarlyCareerRole(title: string) {
  const normalized = title.toLowerCase()
  return (
    normalized.includes('new grad') ||
    normalized.includes('new graduate') ||
    normalized.includes('university') ||
    normalized.includes('college') ||
    normalized.includes('entry level') ||
    normalized.includes('intern') ||
    normalized.includes('internship') ||
    normalized.includes('co-op') ||
    normalized.includes('junior') ||
    normalized.includes('associate') ||
    normalized.includes('graduate program') ||
    normalized.includes('early career')
  )
}
