import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  vector,
  index,
  integer,
  jsonb
} from 'drizzle-orm/pg-core'

export const visaSponsors = pgTable(
  'visa_sponsors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyName: text('company_name').notNull(),
    normalizedName: text('normalized_name').notNull().unique(),
    aliases: text('aliases').array(),
    sponsorshipTypes: text('sponsorship_types').array(),
    lastYearSponsored: integer('last_year_sponsored'),
    sponsorshipConfidence: integer('sponsorship_confidence').default(50),
    notes: text('notes'),
    source: text('source'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('visaSponsorsNormalizedIdx').on(table.normalizedName)]
)

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  authId: text('auth_id').notNull().unique(), // Supabase Auth ID
  profileDescription: text('profile_description'),
  profileEmbedding: vector('profile_embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location'),
    description: text('description'),
    requirements: text('requirements'),
    url: text('url').notNull().unique(),
    salaryRange: text('salary_range'),
    isRemote: boolean('is_remote').default(false),
    jobType: text('job_type'), // 'new_grad' | 'internship'
    source: text('source'), // 'github', 'greenhouse', etc.
    embedding: vector('embedding', { dimensions: 1536 }),
    scrapedAt: timestamp('scraped_at').defaultNow(),
    isActive: boolean('is_active').default(true),
    postedAt: timestamp('posted_at'),
    lastSeenAt: timestamp('last_seen_at').defaultNow(),
    linkCheckedAt: timestamp('link_checked_at'),
    isLinkActive: boolean('is_link_active').default(true),
    visaStatus: text('visa_status'),
    sponsorshipConfidence: integer('sponsorship_confidence').default(0),
    visaNotes: text('visa_notes'),
    visaSponsorId: uuid('visa_sponsor_id').references(() => visaSponsors.id),
    visaRequirements: text('visa_requirements'),
    salaryCurrency: text('salary_currency'),
    expiresAt: timestamp('expires_at'),
    manualReview: boolean('manual_review').default(false),
    visaPriorityScore: integer('visa_priority_score'),
  },
  (table) => [
    index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('jobsVisaStatusIdx').on(table.visaStatus),
    index('jobsLastSeenIdx').on(table.lastSeenAt),
  ]
)

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  status: text('status').default('saved'), // 'saved' | 'applied' | 'interviewing' | 'rejected' | 'offer'
  appliedAt: timestamp('applied_at').defaultNow(),
  notes: text('notes'),
})

// Type exports
export type User = typeof users.$inferSelect
export type Job = typeof jobs.$inferSelect
export type Application = typeof applications.$inferSelect
export type VisaSponsor = typeof visaSponsors.$inferSelect
