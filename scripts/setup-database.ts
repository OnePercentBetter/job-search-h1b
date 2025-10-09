/**
 * Database Setup Script
 * Run this to set up pgvector extension and create initial schema
 */

import 'dotenv/config'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_URL || ''

if (!connectionString) {
  console.error('❌ DATABASE_URL or SUPABASE_URL is required')
  process.exit(1)
}

async function setupDatabase() {
  console.log('🔧 Setting up database...')

  const dbUrl = connectionString.includes('supabase.co')
    ? connectionString.replace('https://', 'postgresql://postgres:') + '/postgres'
    : connectionString

  const sql = postgres(dbUrl)

  try {
    // Enable pgvector extension
    console.log('📦 Enabling pgvector extension...')
    await sql`CREATE EXTENSION IF NOT EXISTS vector`

    console.log('✅ pgvector enabled successfully')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Run: npm run db:generate')
    console.log('  2. Run: npm run db:push')
    console.log('  3. Start crawling: npm run crawl')
  } catch (error) {
    console.error('❌ Database setup failed:', error)
  } finally {
    await sql.end()
  }
}

setupDatabase()

