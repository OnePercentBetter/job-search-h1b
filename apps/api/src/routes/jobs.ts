import { Hono } from 'hono'
import { z } from 'zod'
import { searchJobs, getJobById, getTotalJobCount } from '../services/job-service'

const jobs = new Hono()

const searchSchema = z.object({
  description: z.string().optional(),
  jobType: z.enum(['new_grad', 'internship', 'all']).optional(),
  isRemote: z.boolean().optional(),
  location: z.string().optional(),
  visaStatus: z.enum(['sponsor_verified', 'likely_sponsor', 'unknown']).optional(),
  minSponsorshipConfidence: z.coerce.number().min(0).max(100).optional(),
  requiresVerifiedSponsor: z.boolean().optional(),
  postedAfter: z.string().optional(),
  postedBefore: z.string().optional(),
  includeInactive: z.boolean().optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional(),
  userId: z.string().optional(),
})

// GET /api/jobs/search - Vector similarity search
jobs.get('/search', async (c) => {
  try {
    const query = c.req.query()
    
    const params = searchSchema.parse({
      description: query.description,
      jobType: query.jobType as any,
      isRemote: query.isRemote !== undefined ? query.isRemote === 'true' : undefined,
      location: query.location,
      visaStatus: query.visaStatus as any,
      minSponsorshipConfidence: query.minSponsorshipConfidence,
      requiresVerifiedSponsor: query.requiresVerifiedSponsor === 'true',
      postedAfter: query.postedAfter,
      postedBefore: query.postedBefore,
      includeInactive: query.includeInactive === 'true',
      limit: query.limit,
      offset: query.offset,
      userId: query.userId || c.req.header('x-user-id'),
    })

    const [results, totalCount] = await Promise.all([
      searchJobs(params),
      getTotalJobCount(params)
    ])
    
    return c.json({ 
      jobs: results, 
      count: results.length,
      total: totalCount,
      hasMore: (params.offset || 0) + results.length < totalCount
    })
  } catch (error) {
    console.error('Search error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid parameters', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to search jobs' }, 500)
  }
})

// GET /api/jobs/:id - Get single job
jobs.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const job = await getJobById(id)
    
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }
    
    return c.json({ job })
  } catch (error) {
    console.error('Get job error:', error)
    return c.json({ error: 'Failed to fetch job' }, 500)
  }
})

export default jobs

