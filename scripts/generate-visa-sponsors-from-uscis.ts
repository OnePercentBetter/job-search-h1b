import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { TextDecoder } from 'util'
import { parse } from 'csv-parse'
import { z } from 'zod'

const DELIMITER_CANDIDATES = ['\t', ',', ';', '|'] as const

const SponsorAggregateSchema = z.object({
  companyName: z.string(),
  normalizedName: z.string(),
  filings: z.number().int().min(0),
  approvals: z.number().int().min(0),
  denials: z.number().int().min(0),
  lastYearSponsored: z.number().int().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  industry: z.string().optional(),
  taxId: z.string().optional(),
})

type SponsorAggregate = z.infer<typeof SponsorAggregateSchema>

const USCISRowSchema = z.object({
  fiscalYear: z.string(),
  employerName: z.string().optional(),
  taxId: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  industry: z.string().optional(),
  newEmploymentApproval: z.string().optional(),
  newEmploymentDenial: z.string().optional(),
  continuationApproval: z.string().optional(),
  continuationDenial: z.string().optional(),
  changeEmployerApproval: z.string().optional(),
  changeEmployerDenial: z.string().optional(),
  amendedApproval: z.string().optional(),
  amendedDenial: z.string().optional(),
})

type USCISRow = z.infer<typeof USCISRowSchema>

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function detectDelimiter(content: string) {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''

  let bestDelimiter: (typeof DELIMITER_CANDIDATES)[number] = ','
  let bestCount = 0

  for (const candidate of DELIMITER_CANDIDATES) {
    // Escape special regex characters
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const count = (firstLine.match(new RegExp(escaped, 'g')) || []).length
    if (count > bestCount) {
      bestDelimiter = candidate
      bestCount = count
    }
  }

  if (bestCount === 0) {
    return ','
  }

  return bestDelimiter
}

function parseNumeric(value?: string) {
  if (!value) return 0
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function findValue(record: Record<string, string>, predicate: (key: string) => boolean) {
  for (const [rawKey, value] of Object.entries(record)) {
    const key = rawKey.trim().toLowerCase()
    if (predicate(key)) {
      return value
    }
  }
  return undefined
}

async function readFileAsText(filePath: string) {
  const buffer = await fs.readFile(filePath)

  if (buffer.length >= 2) {
    const bom = buffer.subarray(0, 2)
    if (bom[0] === 0xff && bom[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(buffer)
    }
    if (bom[0] === 0xfe && bom[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(buffer)
    }
  }

  // Heuristic: many null bytes -> UTF-16LE
  const nullCount = buffer.subarray(0, Math.min(buffer.length, 1000)).reduce((acc, byte) => acc + (byte === 0 ? 1 : 0), 0)
  if (nullCount > 200) {
    return new TextDecoder('utf-16le').decode(buffer)
  }

  return buffer.toString('utf8')
}

async function readCSV(filePath: string): Promise<USCISRow[]> {
  const content = await readFileAsText(filePath)
  const delimiter = detectDelimiter(content)

  return new Promise((resolve, reject) => {
    const records: USCISRow[] = []
    let loggedHeader = false
    const parser = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
      delimiter,
    })

    parser.on('readable', () => {
      let record
      // eslint-disable-next-line no-cond-assign
      while ((record = parser.read())) {
        if (!loggedHeader) {
          loggedHeader = true
          console.log('   Detected columns:', Object.keys(record))
          console.log('   Sample row:', record)
        }
        const mapped: USCISRow = {
          fiscalYear: findValue(record, (key) => key.includes('fiscal') && key.includes('year')) || '',
          employerName:
            findValue(record, (key) => key.includes('employer') && key.includes('petitioner')) ||
            findValue(record, (key) => key === 'employer name') ||
            findValue(record, (key) => key === 'employer'),
          taxId: findValue(record, (key) => key.includes('tax') && key.includes('id')),
          city: findValue(record, (key) => key.includes('petitioner city') || key === 'city'),
          state: findValue(record, (key) => key.includes('petitioner state') || key === 'state'),
          industry: findValue(record, (key) => key.includes('industry')),
          newEmploymentApproval: findValue(record, (key) => key.includes('new employment approval')),
          newEmploymentDenial: findValue(record, (key) => key.includes('new employment denial')),
          continuationApproval: findValue(record, (key) => key.includes('continuation approval')),
          continuationDenial: findValue(record, (key) => key.includes('continuation denial')),
          changeEmployerApproval: findValue(record, (key) => key.includes('change of employer approval') || key.includes('change employer approval')),
          changeEmployerDenial: findValue(record, (key) => key.includes('change of employer denial') || key.includes('change employer denial')),
          amendedApproval: findValue(record, (key) => key.includes('amended approval')),
          amendedDenial: findValue(record, (key) => key.includes('amended denial')),
        }

        const parsed = USCISRowSchema.safeParse(mapped)
        if (parsed.success && parsed.data.employerName) {
          records.push(parsed.data)
        }
      }
    })

    parser.on('error', (error) => reject(error))
    parser.on('end', () => resolve(records))
  })
}

function aggregateRows(rows: USCISRow[]): SponsorAggregate[] {
  const aggregates = new Map<string, SponsorAggregate>()

  for (const row of rows) {
    const employerName = row.employerName?.trim()
    if (!employerName) continue

    const normalizedName = normalizeName(employerName)
    const fiscalYear = parseInt(row.fiscalYear?.trim() || '', 10)
    if (!normalizedName || !Number.isFinite(fiscalYear)) continue

    const approvals =
      parseNumeric(row.newEmploymentApproval) +
      parseNumeric(row.continuationApproval) +
      parseNumeric(row.changeEmployerApproval) +
      parseNumeric(row.amendedApproval)

    const denials =
      parseNumeric(row.newEmploymentDenial) +
      parseNumeric(row.continuationDenial) +
      parseNumeric(row.changeEmployerDenial) +
      parseNumeric(row.amendedDenial)

    if (!Number.isFinite(approvals) || !Number.isFinite(denials)) {
      continue
    }

    const filings = approvals + denials
    if (!Number.isFinite(filings) || filings <= 0) continue

    const existing = aggregates.get(normalizedName)
    if (!existing) {
      aggregates.set(normalizedName, {
        companyName: employerName,
        normalizedName,
        filings,
        approvals,
        denials,
        lastYearSponsored: fiscalYear,
        city: row.city?.trim(),
        state: row.state?.trim(),
        industry: row.industry?.trim(),
        taxId: row.taxId?.trim(),
      })
    } else {
      existing.filings += filings
      existing.approvals += approvals
      existing.denials += denials
      if (!existing.lastYearSponsored || existing.lastYearSponsored < fiscalYear) {
        existing.lastYearSponsored = fiscalYear
      }
      if (!existing.industry && row.industry) {
        existing.industry = row.industry.trim()
      }
      if (!existing.taxId && row.taxId) {
        existing.taxId = row.taxId.trim()
      }
      if (!existing.city && row.city) {
        existing.city = row.city.trim()
      }
      if (!existing.state && row.state) {
        existing.state = row.state.trim()
      }
    }
  }

  return Array.from(aggregates.values())
}

function calculateConfidence(filings: number, approvals: number): number {
  if (filings >= 200) return 95
  if (filings >= 100) return 90
  if (filings >= 50) return 85
  if (filings >= 25) return 80
  if (filings >= 10) return 75
  if (filings >= 5) return 70
  return approvals > 0 ? 65 : 50
}

const ALLOWED_INDUSTRY_KEYWORDS = [
  'professional, scientific, and technical services',
  'finance',
  'insurance',
  'information',
  'software',
  'management of companies',
  'educational services',
  'health care',
  'manufacturing',
]

const EXCLUDED_KEYWORDS = [
  'staffing',
  'consulting',
  'solutions',
  'tech inc',
  'services inc',
  'technologies',
  'llc',
]

function isAllowedIndustry(industry?: string | null) {
  if (!industry) return false
  const lower = industry.toLowerCase()
  return ALLOWED_INDUSTRY_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function looksLikeStaffing(companyName: string) {
  const lower = companyName.toLowerCase()
  return EXCLUDED_KEYWORDS.some((keyword) => lower.includes(keyword))
}

async function generate() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const csvPath = path.resolve(__dirname, '../data/Employer Information-2.csv')
  const outputPath = path.resolve(__dirname, '../data/visa-sponsors.generated.json')

  console.log('📥 Reading USCIS disclosure data...')
  const content = await readFileAsText(csvPath)
  const delimiter = detectDelimiter(content)
  console.log(`   Detected delimiter: ${delimiter === '\t' ? 'tab' : delimiter}`)

  const rows = await readCSV(csvPath)
  console.log(`   Parsed ${rows.length.toLocaleString()} rows`)

  console.log('📊 Aggregating employers...')
  const aggregates = aggregateRows(rows)
  console.log(`   Aggregated ${aggregates.length.toLocaleString()} unique employers`)

  const filteredAggregates = aggregates.filter((aggregate) => {
    const allowedByIndustry = isAllowedIndustry(aggregate.industry)
    const allowedByFilings = aggregate.filings >= 5
    const notStaffing = !looksLikeStaffing(aggregate.companyName)
    return allowedByIndustry && allowedByFilings && notStaffing
  })

  console.log(`   After filtering: ${filteredAggregates.length.toLocaleString()} employers`)

  const sponsors = filteredAggregates
    .map((aggregate) => {
      const confidence = calculateConfidence(aggregate.filings, aggregate.approvals)

      return {
        companyName: aggregate.companyName,
        aliases: [],
        sponsorshipTypes: ['H1B'],
        lastYearSponsored: aggregate.lastYearSponsored,
        sponsorshipConfidence: confidence,
        notes: `USCIS FY filings: ${aggregate.filings} (approvals: ${aggregate.approvals}, denials: ${aggregate.denials})`,
        source: aggregate.lastYearSponsored ? `USCIS H1B Disclosure ${aggregate.lastYearSponsored}` : 'USCIS H1B Disclosure',
        metadata: {
          filings: aggregate.filings,
          approvals: aggregate.approvals,
          denials: aggregate.denials,
          city: aggregate.city,
          state: aggregate.state,
          industry: aggregate.industry,
          taxId: aggregate.taxId,
        },
      }
    })
    .sort((a, b) => (b.metadata?.filings || 0) - (a.metadata?.filings || 0))

  await fs.writeFile(outputPath, `${JSON.stringify(sponsors, null, 2)}\n`, 'utf8')
  console.log(`✅ Wrote ${sponsors.length.toLocaleString()} sponsor entries to ${path.relative(process.cwd(), outputPath)}`)
  console.log('ℹ️  Merge the generated file into data/visa-sponsors.json (curated list) before seeding.')
}

generate().catch((error) => {
  console.error('❌ Failed to generate visa sponsors from USCIS data:', error)
  process.exit(1)
})
