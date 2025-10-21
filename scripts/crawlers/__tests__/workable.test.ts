import { describe, expect, it } from 'vitest'
import { extractWorkableJobs, WorkableJob } from '../adapters/workable'

describe('Workable adapter', () => {
  it('normalizes jobs and enriches with detail payload', async () => {
    const response = {
      jobs: [
        {
          id: 'abc123',
          title: 'Software Engineer Intern',
          shortcode: 'SEI123',
          url: 'https://apply.workable.com/acme/j/abc123/',
          published: '2024-01-10T12:00:00Z',
          locations: [
            { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
          ],
        },
        {
          id: 'def456',
          title: 'Principal Engineer',
          shortcode: 'PE456',
          url: 'https://apply.workable.com/acme/j/def456/',
          locations: [
            { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
          ],
        },
        {
          id: 'ghi789',
          title: 'New Grad Product Manager',
          shortcode: 'NGPM789',
          url: 'https://apply.workable.com/acme/j/ghi789/',
          published: '2024-02-01T08:00:00Z',
          locations: [
            { remote: true },
          ],
        },
      ],
    }

    const details = new Map<string, { description: string }>([
      ['SEI123', { description: 'Build internal tooling.' }],
      ['NGPM789', { description: 'Coordinate product launches.' }],
    ])

    const jobs = await extractWorkableJobs(response, 'Acme', async (job: WorkableJob) => {
      if (!job.shortcode) return null
      return details.get(job.shortcode) ?? null
    })

    expect(jobs).toHaveLength(2)

    const engineer = jobs.find((job) => job.title.includes('Software Engineer'))!
    expect(engineer.jobType).toBe('internship')
    expect(engineer.location).toBe('San Francisco, CA, USA')
    expect(engineer.description).toContain('internal tooling')
    expect(engineer.isRemote).toBe(false)
    expect(engineer.postedAt?.toISOString()).toBe('2024-01-10T12:00:00.000Z')

    const productManager = jobs.find((job) => job.title.includes('Product Manager'))!
    expect(productManager.jobType).toBe('new_grad')
    expect(productManager.isRemote).toBe(true)
    expect(productManager.description).toContain('product launches')
  })
})
