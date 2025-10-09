import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { generateEmbedding } from '../lib/openai'

export async function getUserProfile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return user || null
}

export async function updateUserProfile(userId: string, description: string) {
  // Generate embedding for the user's job preferences
  const embedding = await generateEmbedding(description)
  
  // Try to update first, if no rows affected, insert new user
  const [updated] = await db
    .update(users)
    .set({
      profileDescription: description,
      profileEmbedding: embedding,
    })
    .where(eq(users.id, userId))
    .returning()
  
  if (updated) {
    return updated
  }
  
  // User doesn't exist, create new user
  const [newUser] = await db
    .insert(users)
    .values({
      id: userId,
      email: `user-${userId}@example.com`, // Temporary email
      authId: userId,
      profileDescription: description,
      profileEmbedding: embedding,
    })
    .returning()
  
  return newUser
}

