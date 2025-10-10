import { db } from '../db'
import { applications, jobs } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function getUserApplications(userId: string) {
  const apps = await db
    .select({
      id: applications.id,
      status: applications.status,
      appliedAt: applications.appliedAt,
      notes: applications.notes,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        url: jobs.url,
        visaStatus: jobs.visaStatus,
        sponsorshipConfidence: jobs.sponsorshipConfidence,
      },
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.appliedAt))
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

export async function updateApplicationStatus(id: string, userId: string, data: UpdateStatusData) {
  const [updated] = await db
    .update(applications)
    .set({
      status: data.status,
      notes: data.notes,
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning()
  
  return updated || null
}

 
