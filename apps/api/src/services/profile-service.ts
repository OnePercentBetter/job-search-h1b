import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { generateEmbedding } from '../lib/openai'
import { ensureUser } from './user-service'

export async function getUserProfile(authId: string) {
  const [user] = await db.select().from(users).where(eq(users.authId, authId)).limit(1)
  return user || null
}

export async function updateUserProfile(authId: string, email: string | undefined, description: string) {
  const userRecord = await ensureUser(authId, email)
  // Generate embedding for the user's job preferences
  const embedding = await generateEmbedding(description)
  
  const [updated] = await db
    .update(users)
    .set({
      profileDescription: description,
      profileEmbedding: embedding,
    })
    .where(eq(users.id, userRecord.id))
    .returning()
  
  if (updated) {
    return updated
  }
  
  // Fallback in the unlikely event the record was removed between ensureUser and update
  const [newUser] = await db
    .insert(users)
    .values({
      id: authId,
      authId,
      email: email ?? `${authId}@placeholder.supabase.local`,
      profileDescription: description,
      profileEmbedding: embedding,
    })
    .returning()

  return newUser
}
