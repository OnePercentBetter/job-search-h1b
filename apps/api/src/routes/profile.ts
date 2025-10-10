import { Hono } from 'hono'
import { z } from 'zod'
import { updateUserProfile, getUserProfile } from '../services/profile-service'
import { requireUser } from '../middleware/auth'
import type { AppEnv } from '../types'

const profile = new Hono<AppEnv>()

profile.use('*', requireUser)

const updateProfileSchema = z.object({
  description: z.string().min(10).max(2000),
})

// GET /api/profile - Get user profile
profile.get('/', async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const userProfile = await getUserProfile(user.authId)

    if (userProfile) {
      return c.json({
        profile: {
          ...userProfile,
          email: userProfile.email ?? user.email ?? null,
        },
      })
    }

    return c.json({
      profile: {
        id: user.id,
        authId: user.authId,
        email: user.email ?? null,
        profileDescription: null,
        profileEmbedding: null,
        createdAt: user.userRecord?.createdAt ?? null,
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return c.json({ error: 'Failed to fetch profile' }, 500)
  }
})

// PUT /api/profile - Update user profile and regenerate embedding
profile.put('/', async (c) => {
  try {
    const body = await c.req.json()
    const data = updateProfileSchema.parse(body)

    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const userProfile = await updateUserProfile(user.authId, user.email ?? undefined, data.description)

    return c.json({ profile: userProfile })
  } catch (error) {
    console.error('Update profile error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid data', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to update profile' }, 500)
  }
})

export default profile
