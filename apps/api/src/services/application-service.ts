import { db } from '../db'
import { applications } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export async function getUserApplications(userId: string) {
  const apps = await db.select().from(applications).where(eq(applications.userId, userId))
  return apps
}

interface CreateApplicationData {
  jobId: string
  status?: 'saved' | 'applied' | 'interviewing' | 'rejected' | 'offer'
  notes?: string
}

export async function createApplication(userId: string, data: CreateApplicationData) {
  const [application] = await db
    .insert(applications)
    .values({
      userId,
      jobId: data.jobId,
      status: data.status || 'saved',
      notes: data.notes,
    })
    .returning()
  
  return application
}

interface UpdateStatusData {
  status: 'saved' | 'applied' | 'interviewing' | 'rejected' | 'offer'
  notes?: string
}

export async function updateApplicationStatus(id: string, data: UpdateStatusData) {
  const [updated] = await db
    .update(applications)
    .set({
      status: data.status,
      notes: data.notes,
    })
    .where(eq(applications.id, id))
    .returning()
  
  return updated || null
}

 