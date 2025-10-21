import { describe, expect, it } from 'vitest'
import { extractSmartRecruitersJobs } from '../adapters/smartrecruiters'

describe('SmartRecruiters adapter', () => {
  it('filters to early career roles and normalizes fields', () => {
    const response = {
      content: [
        {
          id: '123',
          name: 'New Grad Software Engineer',
          company: { name: 'Acme Corp' },
          location: { city: 'New York', country: 'US' },
          applyUrl: 'https://jobs.smartrecruiters.com/Acme/123',
          jobAd: {
            sections: {
              jobDescription: { text: 'Build great things.' },
            },
          },
          publishedOn: '2024-03-01T00:00:00Z',
        },
        {
          id: '456',
          name: 'Principal Engineer',
          company: { name: 'Acme Corp' },
          applyUrl: 'https://jobs.smartrecruiters.com/Acme/456',
        },
        {
          id: '789',
          name: 'Software Engineering Intern',
          company: { name: 'Acme Corp' },
          location: { remote: true },
          applyUrl: 'https://jobs.smartrecruiters.com/Acme/789',
          jobAd: {
            sections: {
              qualifications: { text: 'Know TypeScript.' },
            },
          },
          updatedOn: '2024-02-15T00:00:00Z',
        },
      ],
    }

    const jobs = extractSmartRecruitersJobs(response, 'Fallback Inc')

    expect(jobs).toHaveLength(2)

    const [newGrad, intern] = jobs

    expect(newGrad.title).toBe('New Grad Software Engineer')
    expect(newGrad.company).toBe('Acme Corp')
    expect(newGrad.location).toBe('New York, US')
    expect(newGrad.jobType).toBe('new_grad')
    expect(newGrad.isRemote).toBe(false)
    expect(newGrad.description).toContain('Build great things')
    expect(newGrad.postedAt?.toISOString()).toBe('2024-03-01T00:00:00.000Z')

    expect(intern.jobType).toBe('internship')
    expect(intern.isRemote).toBe(true)
    expect(intern.description).toContain('Know TypeScript')
  })
})
