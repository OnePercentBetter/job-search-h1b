import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { requireUser } from '../middleware/auth'
import { generateLatexCollateral } from '../services/collateral-service'

const collateral = new Hono<AppEnv>()

collateral.use('*', requireUser)

const requestSchema = z.object({
  jobId: z.string().uuid('jobId must be a valid UUID'),
})

collateral.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request payload', details: parsed.error.flatten() }, 400)
    }

    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const collateralResult = await generateLatexCollateral(user, parsed.data.jobId)
    return c.json(collateralResult)
  } catch (error) {
    console.error('Collateral generation failed:', error)
    return c.json({ error: 'Failed to generate collateral' }, 500)
  }
})

export default collateral
