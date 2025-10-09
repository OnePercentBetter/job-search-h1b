import { Hono } from 'hono'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { 
  getUserApplications, 
  createApplication, 
  updateApplicationStatus 
} from '../services/application-service'

const applications = new Hono()

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
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || uuidv4()
    
    const apps = await getUserApplications(userId)
    
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
    
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || uuidv4()
    
    const application = await createApplication(userId, data)
    
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
    
    const application = await updateApplicationStatus(id, data)
    
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

