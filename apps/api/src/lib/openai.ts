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

