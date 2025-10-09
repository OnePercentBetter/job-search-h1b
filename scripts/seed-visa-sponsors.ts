import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { visaSponsors } from '../apps/api/src/db/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required to seed visa sponsors')
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client, { schema: { visaSponsors } })

const SponsorRecordSchema = z.object({
  companyName: z.string(),
  aliases: z.array(z.string()).optional(),
  sponsorshipTypes: z.array(z.string()).optional(),
  lastYearSponsored: z.number().optional(),
  sponsorshipConfidence: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

type SponsorRecord = z.infer<typeof SponsorRecordSchema>

function normalizeCompanyName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

async function loadSponsors(): Promise<SponsorRecord[]> {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const dataPath = path.resolve(__dirname, '../data/visa-sponsors.curated.json')
  const json = await fs.readFile(dataPath, 'utf8')
  const records = JSON.parse(json)

  if (!Array.isArray(records)) {
    throw new Error('visa-sponsors.json must contain an array of sponsor records')
  }

  return records.map((record, index) => {
    const parsed = SponsorRecordSchema.safeParse(record)
    if (!parsed.success) {
      throw new Error(
        `Invalid sponsor record at index ${index}: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`
      )
    }
    return parsed.data
  })
}

async function seed() {
  console.log('🌍 Seeding visa sponsors...')
  const sponsors = await loadSponsors()

  let inserted = 0
  let updated = 0

  for (const sponsor of sponsors) {
    const normalizedName = normalizeCompanyName(sponsor.companyName)
    const aliases = sponsor.aliases?.map(normalizeCompanyName) ?? []
    const sponsorshipTypes = sponsor.sponsorshipTypes?.map((type) => type.toUpperCase()) ?? []

    const result = await db
      .insert(visaSponsors)
      .values({
        companyName: sponsor.companyName,
        normalizedName,
        aliases,
        sponsorshipTypes,
        lastYearSponsored: sponsor.lastYearSponsored,
        sponsorshipConfidence: sponsor.sponsorshipConfidence ?? 50,
        notes: sponsor.notes,
        source: sponsor.source,
        metadata: sponsor.metadata,
      })
      .onConflictDoUpdate({
        target: visaSponsors.normalizedName,
        set: {
          companyName: sponsor.companyName,
          aliases,
          sponsorshipTypes,
          lastYearSponsored: sponsor.lastYearSponsored,
          sponsorshipConfidence: sponsor.sponsorshipConfidence ?? 50,
          notes: sponsor.notes,
          source: sponsor.source,
          metadata: sponsor.metadata,
          updatedAt: new Date(),
        },
      })

    if (result?.length) {
      inserted += 1
    } else {
      updated += 1
    }
  }

  console.log(`✅ Completed seeding ${inserted} sponsors (updated ${updated}).`)
  await client.end()
}

seed().catch(async (error) => {
  console.error('❌ Failed to seed visa sponsors:', error)
  await client.end()
  process.exit(1)
})
