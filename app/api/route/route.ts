import { NextResponse } from 'next/server'
import { routeRequest, RoutingRequest } from '@/lib/model-router'
import { getCache } from '@/lib/response-cache'
import { getAnalyzer } from '@/lib/cost-analyzer'

export async function POST(req: Request) {
  try {
    const body: RoutingRequest = await req.json()
    if (!body.prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 })

    // Check cache first
    const cache = getCache()
    const cached = cache.get(body.prompt)
    if (cached.hit && cached.entry) {
      const analyzer = getAnalyzer()
      analyzer.addRecord({
        modelId: cached.entry.modelUsed as any,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        taskType: 'cached',
        cached: true,
        latencyMs: 0,
        provider: 'cache',
      })
      return NextResponse.json({
        cached: true,
        similarity: cached.similarity,
        savedCostUsd: cached.savedCostUsd,
        response: cached.entry.response,
        entry: cached.entry,
      })
    }

    const decision = routeRequest(body)
    return NextResponse.json({ cached: false, decision })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  const { MODEL_CATALOG } = await import('@/lib/model-router')
  return NextResponse.json({ models: Object.values(MODEL_CATALOG) })
}
