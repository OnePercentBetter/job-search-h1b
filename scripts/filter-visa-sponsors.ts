import fs from 'fs/promises'
import path from 'path'

interface Sponsor {
  companyName: string
  aliases?: string[]
  sponsorshipTypes?: string[]
  lastYearSponsored?: number
  sponsorshipConfidence?: number
  notes?: string
  source?: string
  metadata?: Record<string, unknown>
}

const GENERATED_FILE = path.resolve(process.cwd(), 'data/visa-sponsors.generated.json')
const CURATED_FILE = path.resolve(process.cwd(), 'data/visa-sponsors.json')
const OUTPUT_FILE = path.resolve(process.cwd(), 'data/visa-sponsors.curated.json')
const MERGED_FILE = path.resolve(process.cwd(), 'data/visa-sponsors.merged.json')

const PREFERRED_INDUSTRY_KEYWORDS = [
  'professional, scientific, and technical services',
  'finance',
  'insurance',
  'information',
  'software',
  'management of companies',
  'educational services',
  'health care',
  'manufacturing',
  'wholesale trade',
  'retail trade',
]

// More specific patterns to avoid false positives
const EXCLUDED_COMPANY_PATTERNS = [
  /staffing.*solutions/i,
  /tech.*staffing/i,
  /employment.*services/i,
  /workforce.*solutions/i,
  /it.*staffing/i,
  /recruitment.*services/i,
  /^(tata|infosys|wipro|cognizant).*consultancy/i,
]

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function hasPreferredIndustry(industry?: unknown) {
  if (!industry || typeof industry !== 'string') return false
  const lower = industry.toLowerCase()
  return PREFERRED_INDUSTRY_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function looksLikeStaffingAgency(companyName: string) {
  return EXCLUDED_COMPANY_PATTERNS.some((pattern) => pattern.test(companyName))
}

async function loadJson(filePath: string): Promise<Sponsor[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error(`${filePath} must contain an array of sponsors`)
    }
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`⚠️  File not found: ${filePath}`)
      return []
    }
    throw error
  }
}

async function saveJson(filePath: string, data: Sponsor[]) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function sanitizeNumeric(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

async function filterSponsors() {
  const [generated, curated] = await Promise.all([loadJson(GENERATED_FILE), loadJson(CURATED_FILE)])

  console.log(`📥 Loaded ${generated.length} generated sponsors and ${curated.length} curated sponsors`)

  const generatedMap = new Map<string, Sponsor>()
  let filteredByFilings = 0
  let filteredByStaffing = 0
  let kept = 0

  for (const sponsor of generated) {
    const normalized = normalizeName(sponsor.companyName)
    const filings = sanitizeNumeric((sponsor.metadata as any)?.filings) ?? 0
    const approvals = sanitizeNumeric((sponsor.metadata as any)?.approvals) ?? 0
    const denials = sanitizeNumeric((sponsor.metadata as any)?.denials) ?? 0
    const industry = (sponsor.metadata as any)?.industry
    const lastYear = sanitizeNumeric(sponsor.lastYearSponsored) ?? 2024

    // More lenient filtering - only minimum filings and staffing agency check
    if (filings < 3) {
      filteredByFilings++
      continue
    }

    if (looksLikeStaffingAgency(sponsor.companyName)) {
      filteredByStaffing++
      continue
    }

    // Boost confidence if in preferred industry
    const industryBonus = hasPreferredIndustry(industry) ? 5 : 0
    let baseConfidence = sponsor.sponsorshipConfidence ?? 70

    if (filings >= 100) baseConfidence = 90
    else if (filings >= 50) baseConfidence = 85
    else if (filings >= 25) baseConfidence = 80
    else if (filings >= 10) baseConfidence = 75
    else if (filings >= 5) baseConfidence = 70
    else baseConfidence = 65

    const confidence = Math.min(95, baseConfidence + industryBonus)

    generatedMap.set(normalized, {
      ...sponsor,
      lastYearSponsored: typeof sponsor.lastYearSponsored === 'number' ? sponsor.lastYearSponsored : lastYear,
      sponsorshipConfidence: confidence,
      metadata: {
        ...sponsor.metadata,
        filings,
        approvals,
        denials,
      },
    })
    kept++
  }

  console.log(`   Filtered out: ${filteredByFilings} (low filings), ${filteredByStaffing} (staffing agencies)`)
  console.log(`   Kept: ${kept} sponsors from USCIS data`)

  // Curated sponsors override with higher priority
  for (const sponsor of curated) {
    const normalized = normalizeName(sponsor.companyName)
    generatedMap.set(normalized, {
      ...sponsor,
      source: sponsor.source || 'curated',
      sponsorshipConfidence: sponsor.sponsorshipConfidence ?? 90,
    })
  }

  const mergedSponsors = Array.from(generatedMap.values()).sort((a, b) => {
    const filingsA = sanitizeNumeric((a.metadata as any)?.filings) ?? 0
    const filingsB = sanitizeNumeric((b.metadata as any)?.filings) ?? 0
    return filingsB - filingsA
  })

  const curatedSponsors = mergedSponsors.map((sponsor) => ({
    ...sponsor,
    sponsorshipConfidence: sponsor.sponsorshipConfidence ?? 70,
  }))

  await saveJson(MERGED_FILE, mergedSponsors)
  await saveJson(OUTPUT_FILE, curatedSponsors)

  console.log(`💾 Merged sponsors written to ${path.relative(process.cwd(), MERGED_FILE)} (${mergedSponsors.length} entries)`)
  console.log(`✅ Filtered sponsors written to ${path.relative(process.cwd(), OUTPUT_FILE)} (${curatedSponsors.length} entries)`)
}

filterSponsors().catch((error) => {
  console.error('❌ Failed to filter visa sponsors:', error)
  process.exit(1)
})
