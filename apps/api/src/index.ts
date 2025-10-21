import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import jobsRouter from './routes/jobs'
import applicationsRouter from './routes/applications'
import profileRouter from './routes/profile'
import collateralRouter from './routes/collateral'
import type { AppEnv } from './types'
import { attachUser } from './middleware/auth'

const app = new Hono<AppEnv>()

// Middleware
app.use('/*', cors())
app.use('/*', logger())
app.use('/api/*', attachUser)

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.route('/api/jobs', jobsRouter)
app.route('/api/applications', applicationsRouter)
app.route('/api/profile', profileRouter)
app.route('/api/collateral', collateralRouter)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = parseInt(process.env.PORT || '3000')

console.log(`🚀 Server starting on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
