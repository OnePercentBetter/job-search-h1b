/**
 * Lever API Crawler
 * Many startups use Lever for job postings
 * API: https://api.lever.co/v0/postings/{company}
 */

import 'dotenv/config'
import { db } from '../../apps/api/src/db'
import { jobs } from '../../apps/api/src/db/schema'
import { generateEmbedding } from '../../apps/api/src/lib/openai'

// NYC-focused startups using Lever
const COMPANIES = [
  'brex',
  'ramp',
  'plaid',
  'mercury',
  'retool',
  'superhuman',
  'notion',
  'stripe',
  'square',
  'shopify',
  'twilio',
  'uber',
  'airbnb',
  'lyft',
  'doordash',
  'postmates',
  'lyft',
  'instacart',
  'coursera',
  'udemy',
  'edx',
  'coursera',
  'udemy',
  'edx',
  'coursera',
  'udemy',
  'edx',
  
]

interface LeverJob {
  id: string
  text: string
  hostedUrl: string
  categories: {
    commitment?: string
    team?: string
    location?: string
  }
  description: string
}

async function crawlLeverJobs() {
  console.log('🕷️  Starting Lever API crawler...')

  let savedCount = 0

  for (const company of COMPANIES) {
    try {
      const url = `https://api.lever.co/v0/postings/${company}`
      const response = await fetch(url)

      if (!response.ok) {
        console.log(`⚠️  Skipping ${company} (API unavailable)`)
        continue
      }

      const leverJobs: LeverJob[] = await response.json()

      for (const leverJob of leverJobs) {
        // Filter for new grad / entry level roles
        const title = leverJob.text.toLowerCase()
        const isNewGrad =
          title.includes('new grad') ||
          title.includes('university grad') ||
          title.includes('entry level') ||
          title.includes('early career')

        if (!isNewGrad) continue

        const location = leverJob.categories.location || 'Not specified'
        const isRemote =
          location.toLowerCase().includes('remote') ||
          location.toLowerCase().includes('anywhere')

        // Generate embedding
        const embeddingText = `${leverJob.text} ${company} ${leverJob.description}`
        const embedding = await generateEmbedding(embeddingText)

        await db
          .insert(jobs)
          .values({
            title: leverJob.text,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location,
            url: leverJob.hostedUrl,
            isRemote,
            jobType: 'new_grad',
            description: leverJob.description,
            source: 'lever',
            embedding,
          })
          .onConflictDoNothing({ target: jobs.url })

        savedCount++
        console.log(`✅ ${company}: ${leverJob.text}`)
      }
    } catch (error) {
      console.error(`❌ Error crawling ${company}:`, error)
    }
  }

  console.log(`\n✨ Saved ${savedCount} jobs from Lever`)
  process.exit(0)
}

crawlLeverJobs()

