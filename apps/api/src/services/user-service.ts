import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'

export async function findUserByAuthId(authId: string) {
  const [user] = await db.select().from(users).where(eq(users.authId, authId)).limit(1)
  return user ?? null
}

export async function ensureUser(authId: string, email?: string | null) {
  const existing = await findUserByAuthId(authId)
  if (existing) {
    // Update email if we learn about one later
    if (email && existing.email !== email) {
      const [updated] = await db
        .update(users)
        .set({ email })
        .where(eq(users.id, existing.id))
        .returning()
      return updated ?? existing
    }
    return existing
  }

  const safeEmail =
    email?.toLowerCase() ?? `${authId}@placeholder.supabase.local`

  const [created] = await db
    .insert(users)
    .values({
      id: authId,
      authId,
      email: safeEmail,
    })
    .returning()

  if (!created) {
    throw new Error('Failed to create user record')
  }
  return created
}
