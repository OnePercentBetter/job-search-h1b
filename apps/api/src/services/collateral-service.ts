import { getJobById } from './job-service'
import { getUserProfile } from './profile-service'
import type { AuthUserContext } from '../types'
import {
  buildLatexDocument,
  defaultHighlights,
  type CollateralHighlights,
} from './collateral-builder'
import { generateCollateralHighlights } from '../lib/openai'

export async function generateLatexCollateral(user: AuthUserContext, jobId: string) {
  const job = await getJobById(jobId)
  if (!job) {
    throw new Error('Job not found.')
  }

  const profile = await getUserProfile(user.authId)
  const profileDescription = profile?.profileDescription ?? null

  let highlights: CollateralHighlights
  try {
    highlights =
      (await generateCollateralHighlights({
        jobTitle: job.title,
        company: job.company,
        jobDescription: job.description ?? '',
        profileSummary: profileDescription ?? '',
      })) ?? defaultHighlights(profileDescription, job.title, job.company)
  } catch (error) {
    console.error('Failed to generate AI collateral highlights:', error)
    highlights = defaultHighlights(profileDescription, job.title, job.company)
  }

  const derivedVisaStatus =
    job.visaStatus ?? (job.visaSponsor?.sponsorshipConfidence ? 'sponsor_verified' : null)

  const latex = buildLatexDocument({
    jobTitle: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    profileSummary: profileDescription,
    highlights,
    visaStatus: derivedVisaStatus,
    sponsorshipConfidence: job.visaSponsor?.sponsorshipConfidence ?? job.sponsorshipConfidence,
    generatedAt: new Date(),
    userEmail: user.email ?? null,
  })

  return {
    latex,
    metadata: {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
    },
  }
}
