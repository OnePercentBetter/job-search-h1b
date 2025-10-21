import { escapeLatex } from '../utils/latex'

export interface CollateralHighlights {
  summary: string
  bullets: string[]
  closing: string
}

export interface LatexContext {
  jobTitle: string
  company: string
  location: string | null
  url: string
  profileSummary: string | null
  highlights: CollateralHighlights
  visaStatus?: string | null
  sponsorshipConfidence?: number | null
  generatedAt: Date
  userEmail?: string | null
}

export function defaultHighlights(
  profileSummary: string | null,
  jobTitle: string,
  company: string
): CollateralHighlights {
  const safeProfile = profileSummary?.trim()
    ? profileSummary.trim()
    : 'An early-career candidate exploring visa-friendly opportunities.'

  return {
    summary: `Tailored narrative for ${jobTitle} at ${company}. This document synthesizes the candidate profile with the role expectations to accelerate preparation.`,
    bullets: [
      `Connect prior experiences directly to ${company}'s mission and product surface.`,
      `Highlight 1-2 technical achievements that mirror responsibilities in the ${jobTitle} role.`,
      'Outline the visa-friendly track record and call out any relocation flexibility you can offer.',
    ],
    closing: `Close with enthusiasm, reiterating how your background aligns with ${company}'s roadmap while inviting next steps.`,
  }
}

function sanitizeLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => escapeLatex(line))
}

export function buildLatexDocument(context: LatexContext): string {
  const {
    jobTitle,
    company,
    location,
    url,
    profileSummary,
    highlights,
    visaStatus,
    sponsorshipConfidence,
    generatedAt,
    userEmail,
  } = context

  const summary = escapeLatex(highlights.summary)
  const bullets = sanitizeLines(highlights.bullets)
  const closing = escapeLatex(highlights.closing)
  const profile = escapeLatex(
    profileSummary ?? 'No profile description found. Consider updating your profile to improve personalization.'
  )
  const position = escapeLatex(jobTitle)
  const organization = escapeLatex(company)
  const jobLocation = escapeLatex(location ?? 'Not specified')
  const sourceUrl = escapeLatex(url)
  const generatedDate = generatedAt.toISOString().split('T')[0]

  const visaDetails: string[] = []
  if (visaStatus) {
    visaDetails.push(`Visa status: ${visaStatus}`)
  }
  if (sponsorshipConfidence !== undefined && sponsorshipConfidence !== null) {
    visaDetails.push(`Sponsorship confidence: ${sponsorshipConfidence}\\%`)
  }

  const visaLine = visaDetails.length ? visaDetails.join(' \\quad ') : 'Visa insights unavailable for this posting.'
  const contactLine = userEmail ? `Prepared for: ${escapeLatex(userEmail)}` : ''

  const bulletBlock = bullets.length
    ? bullets.map((bullet) => `\\item ${bullet}`).join('\n')
    : '\\item Personalize the bullet points once you have additional context about the team and project scope.'

  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[margin=1in]{geometry}',
    '\\usepackage{xcolor}',
    '\\usepackage{enumitem}',
    '\\usepackage{hyperref}',
    '\\hypersetup{colorlinks=true, linkcolor=blue, urlcolor=blue}',
    '\\begin{document}',
    '\\definecolor{Accent}{HTML}{3B82F6}',
    '\\definecolor{Slate}{HTML}{1F2937}',
    '\\definecolor{Muted}{HTML}{6B7280}',
    '',
    '\\begin{center}',
    `  {\\LARGE\\bfseries ${position}}\\\\[4pt]`,
    `  {\\large ${organization}}\\\\[2pt]`,
    `  {\\normalsize ${jobLocation}}\\\\[6pt]`,
    `  {\\small Generated on ${generatedDate}}`,
    '\\end{center}',
    '',
    contactLine ? `{\\small ${contactLine}}\\\\[4pt]` : '',
    '{\\color{Muted} \\hrulefill}\\\\[10pt]',
    '',
    '\\section*{Executive Summary}',
    summary,
    '',
    '\\section*{Tailored Talking Points}',
    '\\begin{itemize}[leftmargin=*]',
    bulletBlock,
    '\\end{itemize}',
    '',
    '\\section*{Profile Snapshot}',
    profile,
    '',
    '\\section*{Role & Visa Context}',
    `${visaLine}\\\\[4pt]`,
    `Source: \\href{${sourceUrl}}{${sourceUrl}}`,
    '',
    '\\section*{Closing Guidance}',
    closing,
    '',
    '\\vfill',
    '{\\scriptsize Generated programmatically. Customize phrasing before submission to maintain an authentic voice.}',
    '',
    '\\end{document}',
  ]
    .filter(Boolean)
    .join('\n')
}
