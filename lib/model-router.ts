// lib/model-router.ts
// AI Cost Optimizer — Model Router
// Routes each request to the cheapest model that can handle it

export type ModelId =
  | 'claude-haiku-3'
  | 'claude-sonnet-3-5'
  | 'claude-opus-3'
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'gemini-flash-1-5'
  | 'gemini-pro-1-5'

export interface ModelConfig {
  id: ModelId
  provider: 'anthropic' | 'openai' | 'google'
  inputCostPer1k: number  // USD per 1K tokens
  outputCostPer1k: number
  contextWindow: number
  capabilities: TaskCapability[]
  latencyMs: number       // avg latency
  qualityScore: number    // 0-100
}

export type TaskCapability =
  | 'simple-qa'
  | 'summarization'
  | 'classification'
  | 'code-generation'
  | 'reasoning'
  | 'long-context'
  | 'creative-writing'
  | 'data-extraction'
  | 'math'

export interface RoutingRequest {
  prompt: string
  taskType?: TaskCapability
  maxBudgetUsd?: number
  prioritize?: 'cost' | 'quality' | 'speed'
  requiredContextTokens?: number
}

export interface RoutingDecision {
  selectedModel: ModelConfig
  reason: string
  estimatedCostUsd: number
  estimatedTokens: number
  alternativeModels: Array<{ model: ModelConfig; tradeoff: string }>
}

export const MODEL_CATALOG: Record<ModelId, ModelConfig> = {
  'claude-haiku-3': {
    id: 'claude-haiku-3',
    provider: 'anthropic',
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    contextWindow: 200000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'data-extraction'],
    latencyMs: 500,
    qualityScore: 72,
  },
  'claude-sonnet-3-5': {
    id: 'claude-sonnet-3-5',
    provider: 'anthropic',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'code-generation', 'reasoning', 'long-context', 'creative-writing', 'data-extraction'],
    latencyMs: 1500,
    qualityScore: 92,
  },
  'claude-opus-3': {
    id: 'claude-opus-3',
    provider: 'anthropic',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    contextWindow: 200000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'code-generation', 'reasoning', 'long-context', 'creative-writing', 'data-extraction', 'math'],
    latencyMs: 3000,
    qualityScore: 98,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    contextWindow: 128000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'data-extraction'],
    latencyMs: 400,
    qualityScore: 70,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    contextWindow: 128000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'code-generation', 'reasoning', 'creative-writing', 'data-extraction', 'math'],
    latencyMs: 1200,
    qualityScore: 91,
  },
  'gemini-flash-1-5': {
    id: 'gemini-flash-1-5',
    provider: 'google',
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    contextWindow: 1000000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'long-context', 'data-extraction'],
    latencyMs: 600,
    qualityScore: 74,
  },
  'gemini-pro-1-5': {
    id: 'gemini-pro-1-5',
    provider: 'google',
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    contextWindow: 1000000,
    capabilities: ['simple-qa', 'summarization', 'classification', 'code-generation', 'reasoning', 'long-context', 'creative-writing', 'data-extraction', 'math'],
    latencyMs: 2000,
    qualityScore: 88,
  },
}

function detectTaskType(prompt: string): TaskCapability {
  const lower = prompt.toLowerCase()
  if (lower.includes('code') || lower.includes('function') || lower.includes('implement')) return 'code-generation'
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('tldr')) return 'summarization'
  if (lower.includes('classify') || lower.includes('categorize') || lower.includes('label')) return 'classification'
  if (lower.includes('reason') || lower.includes('analyze') || lower.includes('explain why')) return 'reasoning'
  if (lower.includes('math') || lower.includes('calculate') || lower.includes('equation')) return 'math'
  if (lower.includes('write') || lower.includes('story') || lower.includes('creative')) return 'creative-writing'
  if (lower.includes('extract') || lower.includes('parse') || lower.includes('find')) return 'data-extraction'
  if (prompt.length > 10000) return 'long-context'
  return 'simple-qa'
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function routeRequest(request: RoutingRequest): RoutingDecision {
  const taskType = request.taskType ?? detectTaskType(request.prompt)
  const estimatedInputTokens = estimateTokens(request.prompt)
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.4)
  const totalTokens = estimatedInputTokens + estimatedOutputTokens
  const prioritize = request.prioritize ?? 'cost'

  // Filter capable models
  const capable = Object.values(MODEL_CATALOG).filter(m => {
    const hasCapability = m.capabilities.includes(taskType)
    const fitsContext = m.contextWindow >= (request.requiredContextTokens ?? estimatedInputTokens)
    const estimatedCost = (estimatedInputTokens / 1000) * m.inputCostPer1k + (estimatedOutputTokens / 1000) * m.outputCostPer1k
    const fitsbudget = request.maxBudgetUsd ? estimatedCost <= request.maxBudgetUsd : true
    return hasCapability && fitsContext && fitsbudget
  })

  if (capable.length === 0) {
    // Fallback to sonnet if nothing fits
    const fallback = MODEL_CATALOG['claude-sonnet-3-5']
    const cost = (estimatedInputTokens / 1000) * fallback.inputCostPer1k + (estimatedOutputTokens / 1000) * fallback.outputCostPer1k
    return {
      selectedModel: fallback,
      reason: 'Fallback: no model matched all constraints. Using Claude Sonnet as safe default.',
      estimatedCostUsd: cost,
      estimatedTokens: totalTokens,
      alternativeModels: [],
    }
  }

  // Sort by priority
  const sorted = capable.sort((a, b) => {
    if (prioritize === 'cost') {
      const costA = (a.inputCostPer1k + a.outputCostPer1k * 0.4)
      const costB = (b.inputCostPer1k + b.outputCostPer1k * 0.4)
      return costA - costB
    }
    if (prioritize === 'quality') return b.qualityScore - a.qualityScore
    if (prioritize === 'speed') return a.latencyMs - b.latencyMs
    return 0
  })

  const selected = sorted[0]
  const estimatedCostUsd = (estimatedInputTokens / 1000) * selected.inputCostPer1k + (estimatedOutputTokens / 1000) * selected.outputCostPer1k

  const alternatives = sorted.slice(1, 3).map(m => {
    const altCost = (estimatedInputTokens / 1000) * m.inputCostPer1k + (estimatedOutputTokens / 1000) * m.outputCostPer1k
    const costDiff = ((altCost - estimatedCostUsd) / estimatedCostUsd * 100).toFixed(0)
    const qualityDiff = m.qualityScore - selected.qualityScore
    return {
      model: m,
      tradeoff: qualityDiff > 0
        ? `+${qualityDiff} quality pts, ${costDiff}% more expensive`
        : `${qualityDiff} quality pts, ${Math.abs(Number(costDiff))}% cheaper`,
    }
  })

  return {
    selectedModel: selected,
    reason: `Task: ${taskType} | Priority: ${prioritize} | Model ${selected.id} is the optimal choice with quality score ${selected.qualityScore}/100`,
    estimatedCostUsd,
    estimatedTokens: totalTokens,
    alternativeModels: alternatives,
  }
}
