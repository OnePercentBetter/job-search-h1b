import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error('OpenAI embedding error:', error)
    throw new Error('Failed to generate embedding')
  }
}

export async function generateJobDescription(rawData: string): Promise<string> {
  // Optional: Use GPT to clean/structure job descriptions
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Extract and summarize job details in a clear, structured format.',
        },
        {
          role: 'user',
          content: rawData,
        },
      ],
      max_tokens: 500,
    })
    
    return response.choices[0].message.content || rawData
  } catch (error) {
    console.error('OpenAI description error:', error)
    return rawData // Fallback to raw data
  }
}

interface CollateralHighlightInput {
  jobTitle: string
  company: string
  jobDescription: string
  profileSummary: string
}

interface CollateralHighlightResponse {
  summary: string
  bullets: string[]
  closing: string
}

export async function generateCollateralHighlights(
  input: CollateralHighlightInput
): Promise<CollateralHighlightResponse | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  const { jobTitle, company, jobDescription, profileSummary } = input

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You create concise collateral talking points for early-career job seekers. Respond with JSON containing summary, bullets (array of 3 short strings), and closing. Keep each bullet under 20 words and avoid LaTeX control sequences.',
        },
        {
          role: 'user',
          content: [
            `Role: ${jobTitle} at ${company}`,
            `Profile summary: ${profileSummary || 'Not provided.'}`,
            `Job description: ${jobDescription || 'Not provided.'}`,
            '',
            'Return JSON with shape {"summary": "...", "bullets": ["..."], "closing": "..."}',
          ].join('\n'),
        },
      ],
      max_tokens: 400,
      temperature: 0.6,
    })

    const content = response.choices[0].message.content
    if (!content) {
      return null
    }

    const parsed = JSON.parse(content) as Partial<CollateralHighlightResponse>
    if (!parsed.summary || !parsed.bullets || !Array.isArray(parsed.bullets) || !parsed.closing) {
      return null
    }

    return {
      summary: parsed.summary,
      bullets: parsed.bullets,
      closing: parsed.closing,
    }
  } catch (error) {
    console.error('OpenAI collateral highlight error:', error)
    return null
  }
}
