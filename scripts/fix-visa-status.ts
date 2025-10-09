import { config } from 'dotenv'
import { db } from '../apps/api/src/db'
import { jobs } from '../apps/api/src/db/schema'
import { sql } from 'drizzle-orm'

// Load environment variables
config({ path: '../.env' })

async function fixVisaStatus() {
  console.log('🔧 Fixing visa status based on sponsorship confidence...')
  
  try {
    // Update jobs with high confidence (>=70) to sponsor_verified
    const highConfidence = await db
      .update(jobs)
      .set({ visaStatus: 'sponsor_verified' })
      .where(sql`${jobs.sponsorshipConfidence} >= 70`)
      .returning({ id: jobs.id, company: jobs.company, confidence: jobs.sponsorshipConfidence })
    
    console.log(`✅ Updated ${highConfidence.length} jobs to 'sponsor_verified' (confidence >= 70)`)
    
    // Update jobs with medium confidence (30-69) to likely_sponsor
    const mediumConfidence = await db
      .update(jobs)
      .set({ visaStatus: 'likely_sponsor' })
      .where(sql`${jobs.sponsorshipConfidence} >= 30 AND ${jobs.sponsorshipConfidence} < 70`)
      .returning({ id: jobs.id, company: jobs.company, confidence: jobs.sponsorshipConfidence })
    
    console.log(`✅ Updated ${mediumConfidence.length} jobs to 'likely_sponsor' (confidence 30-69)`)
    
    // Update jobs with low confidence (<30) to unknown
    const lowConfidence = await db
      .update(jobs)
      .set({ visaStatus: 'unknown' })
      .where(sql`${jobs.sponsorshipConfidence} < 30`)
      .returning({ id: jobs.id, company: jobs.company, confidence: jobs.sponsorshipConfidence })
    
    console.log(`✅ Updated ${lowConfidence.length} jobs to 'unknown' (confidence < 30)`)
    
    // Show summary
    const summary = await db
      .select({ 
        visaStatus: jobs.visaStatus, 
        count: sql<number>`count(*)` 
      })
      .from(jobs)
      .groupBy(jobs.visaStatus)
    
    console.log('\n📊 Visa Status Summary:')
    summary.forEach(row => {
      console.log(`  ${row.visaStatus}: ${row.count} jobs`)
    })
    
    console.log('\n🎉 Visa status fix completed!')
    
  } catch (error) {
    console.error('❌ Error fixing visa status:', error)
    process.exit(1)
  }
}

fixVisaStatus()
