import { NextResponse } from 'next/server'
import { getCache } from '@/lib/response-cache'
import { optimizePrompt } from '@/lib/adaptive-prompter'

export async function GET() {
  const cache = getCache()
  return NextResponse.json({ stats: cache.getStats(), entries: cache.listEntries(20) })
}

export async function POST(req: Request) {
  const { prompt } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  const result = optimizePrompt(prompt)
  return NextResponse.json(result)
}
