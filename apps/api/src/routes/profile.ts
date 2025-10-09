import { Hono } from 'hono'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { updateUserProfile, getUserProfile } from '../services/profile-service'

const profile = new Hono()

const updateProfileSchema = z.object({
  description: z.string().min(10).max(2000),
})

// GET /api/profile - Get user profile
profile.get('/', async (c) => {
  try {
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || uuidv4()
    
    const userProfile = await getUserProfile(userId)
    
    if (!userProfile) {
      return c.json({ error: 'Profile not found' }, 404)
    }
    
    return c.json({ profile: userProfile })
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
    
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || uuidv4()
    
    const userProfile = await updateUserProfile(userId, data.description)
    
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

