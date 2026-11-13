import type { QuizQuestion, ResourceItem } from '../types/course'

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || ''

const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash']

export interface AiGeneratedQuizPayload {
  title: string
  description: string
  questions: QuizQuestion[]
}

export async function generateAiQuizFromMaterial(material: ResourceItem): Promise<AiGeneratedQuizPayload> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not configured')
  }
  const prompt = [
    'You are an expert educational assessment author.',
    'Generate a multiple-choice quiz in ENGLISH based on this lesson material.',
    'Rules:',
    '1. Return ONLY valid JSON: {"title":"string","description":"string","questions":[{"prompt":"string","options":["A","B","C","D"],"correct":0}]}',
    '2. Write all text in English.',
    '3. Produce EXACTLY 10 multiple-choice questions.',
    '4. Each question MUST have EXACTLY 4 distinct options and "correct" as integer 0..3.',
    `Lesson material title: ${material.title}`,
    material.description ? `Description: ${material.description}` : '',
    material.url ? `URL: ${material.url}` : '',
    material.file?.name ? `File name: ${material.file.name}` : '',
    `Material type: ${material.kind}`,
  ]
    .filter(Boolean)
    .join('\n')

  let lastError: Error | null = null
  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        lastError = new Error(`Gemini ${model} failed (${res.status}): ${text}`)
        if (res.status === 404 || res.status === 429 || res.status >= 500) continue
        throw lastError
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const raw = (data.candidates ?? [])
        .flatMap((c) => c.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim()
      return parseAiQuizJson(raw, material.title)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError ?? new Error('Failed to generate AI quiz')
}

export function parseAiQuizJson(raw: string, fallbackTitle: string): AiGeneratedQuizPayload {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|JSON)?/, '').replace(/```$/, '').trim()
  }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)

  const parsed = JSON.parse(cleaned) as {
    title?: string
    description?: string
    questions?: { prompt?: string; options?: string[]; correct?: number }[]
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 10) : []
  if (rawQuestions.length < 10) {
    throw new Error(`Expected 10 questions from AI, got ${rawQuestions.length}`)
  }

  const questions: QuizQuestion[] = rawQuestions.map((q, idx) => {
    const prompt = String(q.prompt ?? '').trim()
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : []
    const correct = Number(q.correct)
    if (!prompt || options.length !== 4 || !Number.isInteger(correct) || correct < 0 || correct > 3) {
      throw new Error(`Invalid question ${idx + 1} in AI output`)
    }
    return {
      id: `ai-q-${idx + 1}`,
      prompt,
      options,
      correct,
    }
  })

  return {
    title: parsed.title?.trim() || `AI Quiz: ${fallbackTitle}`,
    description: parsed.description?.trim() || `10-question quiz generated from ${fallbackTitle}.`,
    questions,
  }
}
