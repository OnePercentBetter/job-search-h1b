import { Hono } from 'hono'
import { z } from 'zod'
import {
  getUserApplications,
  createApplication,
  updateApplicationStatus
} from '../services/application-service'
import { requireUser } from '../middleware/auth'
import type { AppEnv } from '../types'

const applications = new Hono<AppEnv>()

applications.use('*', requireUser)

const createApplicationSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['saved', 'applied', 'interviewing', 'rejected', 'offer']).default('saved'),
  notes: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['saved', 'applied', 'interviewing', 'rejected', 'offer']),
  notes: z.string().optional(),
})

// GET /api/applications - Get user's applications
applications.get('/', async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const apps = await getUserApplications(user.id)

    return c.json({ applications: apps, count: apps.length })
  } catch (error) {
    console.error('Get applications error:', error)
    return c.json({ error: 'Failed to fetch applications' }, 500)
  }
})

// POST /api/applications - Create new application
applications.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const data = createApplicationSchema.parse(body)

    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const application = await createApplication(user.id, data)

    return c.json({ application }, 201)
  } catch (error) {
    console.error('Create application error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid data', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to create application' }, 500)
  }
})

// PATCH /api/applications/:id - Update application status
applications.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const data = updateStatusSchema.parse(body)

    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const application = await updateApplicationStatus(id, user.id, data)

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }
    
    return c.json({ application })
  } catch (error) {
    console.error('Update application error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid data', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to update application' }, 500)
  }
})

export default applications
