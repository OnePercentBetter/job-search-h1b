import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { extractBearerToken, verifySupabaseAccessToken } from '../lib/auth'
import { ensureUser } from '../services/user-service'

export const attachUser = createMiddleware<AppEnv>(async (c, next) => {
  const rawHeader = c.req.header('authorization')
  const token = extractBearerToken(rawHeader)
  if (!token) {
    return next()
  }

  try {
    const payload = verifySupabaseAccessToken(token)
    const userRecord = await ensureUser(payload.sub, payload.email)
    c.set('user', {
      id: userRecord.id,
      authId: userRecord.authId,
      email: userRecord.email,
      userRecord,
    })
    c.set('authError', undefined)
  } catch (error) {
    console.error('Auth verification failed:', error)
    c.set('authError', 'Invalid or expired token')
  }

  await next()
})

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const authError = c.get('authError')
  if (authError) {
    return c.json({ error: authError }, 401)
  }

  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  await next()
})
