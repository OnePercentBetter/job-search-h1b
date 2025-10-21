import { describe, expect, it } from 'vitest'
import { buildLatexDocument } from '../../services/collateral-builder'

describe('buildLatexDocument', () => {
  const baseContext = {
    jobTitle: 'Software Engineer, New Grad',
    company: 'Acme Corp',
    location: 'New York, NY',
    url: 'https://example.com/jobs/123',
    profileSummary: 'Aspiring backend engineer with experience in TypeScript and PostgreSQL.',
    highlights: {
      summary: 'Concise fit summary.',
      bullets: ['Bullet one with % sign', 'Bullet two & additional value'],
      closing: 'Wrap up with enthusiasm.',
    },
    generatedAt: new Date('2024-04-01T00:00:00Z'),
    visaStatus: 'sponsor_verified',
    sponsorshipConfidence: 92,
    userEmail: 'candidate@example.com',
  }

  it('produces valid LaTeX structure with escaped content', () => {
    const latex = buildLatexDocument(baseContext)

    expect(latex).toContain('\n\\section*{Tailored Talking Points}')
    expect(latex).toContain('Software Engineer, New Grad')
    expect(latex).toContain('candidate@example.com')
    expect(latex).toContain('Visa status: sponsor\_verified')
    expect(latex).toContain('Sponsorship confidence: 92\\%')
    expect(latex).toContain('\\item Bullet one with \\% sign')
    expect(latex).toContain('\\item Bullet two \\& additional value')
    expect(latex).toContain('Source: \\href{https://example.com/jobs/123}')
  })

  it('fills in defaults when highlights are sparse', () => {
    const latex = buildLatexDocument({
      ...baseContext,
      profileSummary: null,
      highlights: {
        summary: '',
        bullets: [],
        closing: '',
      },
    })

    expect(latex).toContain('No profile description found')
    expect(latex).toContain('Personalize the bullet points once you have additional context')
  })
})
