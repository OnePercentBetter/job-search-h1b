/**
 * Dynamic Company Discovery
 * Discovers companies by finding recent job postings instead of hardcoded lists
 */

import 'dotenv/config'
import { db } from '../../apps/api/src/db'
import { visaSponsors } from '../../apps/api/src/db/schema'
import { sql } from 'drizzle-orm'

interface DiscoveredCompany {
  name: string
  platform: 'lever' | 'greenhouse' | 'workday' | 'bamboohr'
  url: string
  location?: string
  industry?: string
  lastSeen: Date
  jobCount: number
}

async function discoverFromRecentJobs() {
  console.log('🔍 Discovering companies from recent job postings...')
  
  const discovered: DiscoveredCompany[] = []
  
  // Strategy 1: Try common company name patterns
  const patterns = [
    // Tech companies
    'stripe', 'airbnb', 'uber', 'lyft', 'doordash', 'instacart',
    'square', 'shopify', 'twilio', 'plaid', 'brex', 'ramp',
    'mercury', 'retool', 'superhuman', 'notion', 'coursera',
    'udemy', 'edx', 'canva', 'figma', 'linear', 'vercel',
    'netlify', 'supabase', 'planetscale', 'railway', 'render',
    
    // Finance
    'goldman', 'morgan', 'jpmorgan', 'citadel', 'blackrock', 'fidelity',
    'vanguard', 'schwab', 'wells', 'bankofamerica', 'chase',
    
    // Healthcare
    'pfizer', 'moderna', 'johnson', 'merck', 'abbott', 'medtronic',
    'boston', 'scientific', 'baxter', 'cardinal', 'health',
    
    // Enterprise
    'microsoft', 'oracle', 'salesforce', 'adobe', 'intuit', 'workday',
    'servicenow', 'snowflake', 'databricks', 'palantir', 'splunk',
    
    // Gaming/Media
    'roblox', 'unity', 'epic', 'activision', 'electronic', 'arts',
    'netflix', 'spotify', 'pinterest', 'snapchat', 'tiktok',
    
    // Automotive
    'tesla', 'ford', 'gm', 'chrysler', 'honda', 'toyota',
    'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen',
    
    // Retail/E-commerce
    'amazon', 'walmart', 'target', 'costco', 'home', 'depot',
    'lowes', 'best', 'buy', 'macys', 'nordstrom', 'gap',
    
    // Consulting
    'mckinsey', 'bain', 'bcg', 'deloitte', 'pwc', 'ey',
    'kpmg', 'accenture', 'capgemini', 'cognizant', 'infosys',
    
    // Startups (common patterns)
    'get', 'go', 'make', 'build', 'create', 'start', 'launch',
    'scale', 'grow', 'boost', 'lift', 'rise', 'climb', 'jump'
  ]
  
  // Strategy 2: Try variations of known companies
  const knownCompanies = [
    'microsoft', 'google', 'apple', 'amazon', 'meta', 'netflix',
    'tesla', 'nvidia', 'salesforce', 'adobe', 'oracle', 'intel'
  ]
  
  const variations = knownCompanies.flatMap(company => [
    company,
    `${company}inc`,
    `${company}corp`,
    `${company}llc`,
    `${company}technologies`,
    `${company}systems`,
    `${company}labs`,
    `${company}studios`,
    `${company}ventures`,
    `${company}capital`
  ])
  
  // Strategy 3: Try random combinations (for discovering new companies)
  const prefixes = ['new', 'next', 'future', 'smart', 'bright', 'quick', 'fast', 'rapid']
  const suffixes = ['tech', 'labs', 'works', 'systems', 'solutions', 'ventures', 'capital', 'group']
  const randomCombos = []
  
  for (let i = 0; i < 50; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
    randomCombos.push(`${prefix}${suffix}`)
  }
  
  const allPatterns = [...patterns, ...variations, ...randomCombos]
  
  console.log(`🔍 Testing ${allPatterns.length} company patterns...`)
  
  // Test each pattern against different platforms
  for (const pattern of allPatterns) {
    const platforms = [
      { name: 'lever', url: `https://api.lever.co/v0/postings/${pattern}` },
      { name: 'greenhouse', url: `https://boards-api.greenhouse.io/v1/boards/${pattern}/jobs` }
    ]
    
    for (const platform of platforms) {
      try {
        const response = await fetch(platform.url, {
          method: 'HEAD', // Just check if it exists
          signal: AbortSignal.timeout(2000) // 2 second timeout
        })
        
        if (response.ok) {
          // If HEAD works, try to get actual job data
          const jobResponse = await fetch(platform.url, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
          })
          
          if (jobResponse.ok) {
            const data = await jobResponse.json()
            const jobs = data.jobs || data // Handle different response formats
            const jobCount = Array.isArray(jobs) ? jobs.length : 0
            
            if (jobCount > 0) {
              // Filter for recent jobs (last 30 days)
              const recentJobs = jobs.filter((job: any) => {
                const postedDate = new Date(job.createdAt || job.updated_at || job.posted_at || 0)
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                return postedDate > thirtyDaysAgo
              })
              
              if (recentJobs.length > 0) {
                discovered.push({
                  name: pattern,
                  platform: platform.name as any,
                  url: platform.name === 'lever' 
                    ? `https://jobs.lever.co/${pattern}`
                    : `https://boards.greenhouse.io/${pattern}`,
                  location: 'Various',
                  industry: 'Technology',
                  lastSeen: new Date(),
                  jobCount: recentJobs.length
                })
                
                console.log(`✅ Found ${platform.name}: ${pattern} (${recentJobs.length} recent jobs)`)
              }
            }
          }
        }
      } catch (error) {
        // Company doesn't exist or API is down - this is expected
      }
    }
  }
  
  return discovered
}

async function discoverFromVisaSponsors() {
  console.log('🔍 Discovering companies from visa sponsors database...')
  
  // Get companies from visa sponsors that might use these platforms
  const sponsors = await db
    .select({
      companyName: visaSponsors.companyName,
      normalizedName: visaSponsors.normalizedName,
      sponsorshipConfidence: visaSponsors.sponsorshipConfidence
    })
    .from(visaSponsors)
    .where(sql`${visaSponsors.sponsorshipConfidence} > 50`)
    .limit(200) // Get more companies
  
  const discovered: DiscoveredCompany[] = []
  
  for (const sponsor of sponsors) {
    const normalizedName = sponsor.normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // Try different platform name variations
    const platformNames = [
      normalizedName,
      normalizedName.replace(/\s+/g, ''),
      normalizedName.replace(/\s+/g, '-'),
      normalizedName.replace(/\s+/g, '_'),
      normalizedName.split(' ')[0], // Just first word
      normalizedName.split(' ').slice(0, 2).join('') // First two words
    ]
    
    for (const platformName of platformNames) {
      if (platformName.length < 3) continue // Skip too short names
      
      const platforms = [
        { name: 'lever', url: `https://api.lever.co/v0/postings/${platformName}` },
        { name: 'greenhouse', url: `https://boards-api.greenhouse.io/v1/boards/${platformName}/jobs` }
      ]
      
      for (const platform of platforms) {
        try {
          const response = await fetch(platform.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(2000)
          })
          
          if (response.ok) {
            discovered.push({
              name: platformName,
              platform: platform.name as any,
              url: platform.name === 'lever' 
                ? `https://jobs.lever.co/${platformName}`
                : `https://boards.greenhouse.io/${platformName}`,
              location: 'Various',
              industry: 'Technology',
              lastSeen: new Date(),
              jobCount: 0 // Will be filled when we actually crawl
            })
            
            console.log(`✅ Found ${platform.name}: ${platformName} (from visa sponsor: ${sponsor.companyName})`)
            break // Found one platform, no need to check others
          }
        } catch (error) {
          // Company doesn't exist on this platform
        }
      }
    }
  }
  
  return discovered
}

async function discoverCompanies() {
  console.log('🚀 Starting dynamic company discovery...')
  
  const [recentJobs, visaSponsorCompanies] = await Promise.all([
    discoverFromRecentJobs(),
    discoverFromVisaSponsors()
  ])
  
  const allCompanies = [...recentJobs, ...visaSponsorCompanies]
  
  // Remove duplicates
  const uniqueCompanies = allCompanies.filter((company, index, self) => 
    index === self.findIndex(c => c.name === company.name && c.platform === company.platform)
  )
  
  // Sort by job count and recency
  uniqueCompanies.sort((a, b) => {
    if (a.jobCount !== b.jobCount) {
      return b.jobCount - a.jobCount // More jobs first
    }
    return b.lastSeen.getTime() - a.lastSeen.getTime() // More recent first
  })
  
  console.log(`\n📊 Discovery Results:`)
  console.log(`  Recent Jobs: ${recentJobs.length} companies`)
  console.log(`  Visa Sponsors: ${visaSponsorCompanies.length} companies`)
  console.log(`  Total Unique: ${uniqueCompanies.length} companies`)
  
  // Show top companies
  console.log(`\n🏆 Top Companies by Recent Job Activity:`)
  uniqueCompanies.slice(0, 20).forEach((company, index) => {
    console.log(`  ${index + 1}. ${company.name} (${company.platform}) - ${company.jobCount} recent jobs`)
  })
  
  // Save to file for use by other crawlers
  const fs = await import('fs/promises')
  await fs.writeFile(
    'data/discovered-companies.json',
    JSON.stringify(uniqueCompanies, null, 2)
  )
  
  console.log('💾 Saved discovered companies to data/discovered-companies.json')
  
  return uniqueCompanies
}

discoverCompanies().catch(console.error)
