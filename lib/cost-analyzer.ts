// lib/cost-analyzer.ts
// AI Cost Optimizer — Cost Analyzer
// Tracks spend over time, projects costs, and surfaces savings opportunities

import { ModelId, MODEL_CATALOG } from './model-router'

export interface RequestRecord {
  id: string
  timestamp: number
  modelId: ModelId
  inputTokens: number
  outputTokens: number
  costUsd: number
  taskType: string
  cached: boolean
  latencyMs: number
  provider: string
}

export interface CostBreakdown {
  totalUsd: number
  byModel: Record<string, { requests: number; costUsd: number; tokens: number }>
  byProvider: Record<string, { requests: number; costUsd: number }>
  byTaskType: Record<string, { requests: number; costUsd: number }>
  cachedRequests: number
  cachedSavingsUsd: number
}

export interface CostProjection {
  daily: number
  weekly: number
  monthly: number
  annual: number
  savingsIfOptimized: number
  optimizationOpportunities: OptimizationTip[]
}

export interface OptimizationTip {
  id: string
  title: string
  description: string
  estimatedSavingsPercent: number
  effort: 'low' | 'medium' | 'high'
  category: 'routing' | 'caching' | 'prompting' | 'batching'
}

export interface TimeSeriesPoint {
  date: string
  costUsd: number
  requests: number
  cachedHits: number
  savedUsd: number
}

export class CostAnalyzer {
  private records: RequestRecord[] = []

  addRecord(record: Omit<RequestRecord, 'id' | 'timestamp'>): RequestRecord {
    const full: RequestRecord = {
      ...record,
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    }
    this.records.push(full)
    return full
  }

  getBreakdown(sinceMs?: number): CostBreakdown {
    const filtered = sinceMs
      ? this.records.filter(r => r.timestamp >= sinceMs)
      : this.records

    const breakdown: CostBreakdown = {
      totalUsd: 0,
      byModel: {},
      byProvider: {},
      byTaskType: {},
      cachedRequests: 0,
      cachedSavingsUsd: 0,
    }

    for (const r of filtered) {
      breakdown.totalUsd += r.costUsd

      if (!breakdown.byModel[r.modelId]) breakdown.byModel[r.modelId] = { requests: 0, costUsd: 0, tokens: 0 }
      breakdown.byModel[r.modelId].requests++
      breakdown.byModel[r.modelId].costUsd += r.costUsd
      breakdown.byModel[r.modelId].tokens += r.inputTokens + r.outputTokens

      if (!breakdown.byProvider[r.provider]) breakdown.byProvider[r.provider] = { requests: 0, costUsd: 0 }
      breakdown.byProvider[r.provider].requests++
      breakdown.byProvider[r.provider].costUsd += r.costUsd

      if (!breakdown.byTaskType[r.taskType]) breakdown.byTaskType[r.taskType] = { requests: 0, costUsd: 0 }
      breakdown.byTaskType[r.taskType].requests++
      breakdown.byTaskType[r.taskType].costUsd += r.costUsd

      if (r.cached) {
        breakdown.cachedRequests++
        breakdown.cachedSavingsUsd += r.costUsd
      }
    }

    return breakdown
  }

  getProjection(): CostProjection {
    const now = Date.now()
    const last7days = this.records.filter(r => r.timestamp >= now - 7 * 24 * 3600 * 1000)
    const dailyAvg = last7days.reduce((s, r) => s + r.costUsd, 0) / 7

    const opportunities = this.detectOptimizations()
    const totalSavingsPercent = opportunities.reduce((s, o) => s + o.estimatedSavingsPercent, 0)
    const savingsIfOptimized = dailyAvg * 30 * Math.min(totalSavingsPercent / 100, 0.7)

    return {
      daily: dailyAvg,
      weekly: dailyAvg * 7,
      monthly: dailyAvg * 30,
      annual: dailyAvg * 365,
      savingsIfOptimized,
      optimizationOpportunities: opportunities,
    }
  }

  detectOptimizations(): OptimizationTip[] {
    const tips: OptimizationTip[] = []
    const breakdown = this.getBreakdown()

    // Check if expensive models are being used for simple tasks
    const opusUsage = breakdown.byModel['claude-opus-3']
    if (opusUsage && opusUsage.requests > 10) {
      tips.push({
        id: 'opt-downgrade-opus',
        title: 'Downgrade Claude Opus for simple tasks',
        description: `${opusUsage.requests} requests used Opus. Routing simple-qa/summarization to Haiku saves ~95% per request.`,
        estimatedSavingsPercent: 30,
        effort: 'low',
        category: 'routing',
      })
    }

    // Check cache hit rate
    const total = this.records.length
    const cachedCount = this.records.filter(r => r.cached).length
    const hitRate = total > 0 ? cachedCount / total : 0
    if (hitRate < 0.3 && total > 20) {
      tips.push({
        id: 'opt-improve-cache',
        title: 'Low cache hit rate detected',
        description: `Current hit rate: ${(hitRate * 100).toFixed(0)}%. Increase TTL and enable semantic similarity matching to reach 40%+.`,
        estimatedSavingsPercent: 25,
        effort: 'medium',
        category: 'caching',
      })
    }

    // Prompt optimization
    tips.push({
      id: 'opt-prompt-compression',
      title: 'Enable prompt compression',
      description: 'System prompts repeated across requests waste tokens. Compress and cache system prompts to save 15-20% on input tokens.',
      estimatedSavingsPercent: 15,
      effort: 'medium',
      category: 'prompting',
    })

    // Batching
    if (total > 50) {
      tips.push({
        id: 'opt-batch-requests',
        title: 'Batch non-urgent requests',
        description: 'Non-real-time tasks (reports, analysis) can use Batch APIs at 50% discount. Route async workloads to batch endpoints.',
        estimatedSavingsPercent: 20,
        effort: 'high',
        category: 'batching',
      })
    }

    return tips
  }

  getTimeSeries(days = 14): TimeSeriesPoint[] {
    const points: TimeSeriesPoint[] = []
    const now = Date.now()

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - i * 24 * 3600 * 1000 - 24 * 3600 * 1000
      const dayEnd = now - i * 24 * 3600 * 1000
      const dayRecords = this.records.filter(r => r.timestamp >= dayStart && r.timestamp < dayEnd)
      const date = new Date(dayEnd).toISOString().slice(0, 10)
      points.push({
        date,
        costUsd: dayRecords.reduce((s, r) => s + r.costUsd, 0),
        requests: dayRecords.length,
        cachedHits: dayRecords.filter(r => r.cached).length,
        savedUsd: dayRecords.filter(r => r.cached).reduce((s, r) => s + r.costUsd, 0),
      })
    }

    return points
  }

  // Seed with realistic demo data
  seedDemoData(): void {
    const now = Date.now()
    const models: ModelId[] = ['claude-haiku-3', 'claude-sonnet-3-5', 'claude-opus-3', 'gpt-4o-mini', 'gpt-4o']
    const tasks = ['simple-qa', 'summarization', 'code-generation', 'reasoning', 'classification']

    // Generate 14 days of traffic
    for (let day = 0; day < 14; day++) {
      const requestCount = 40 + Math.floor(Math.random() * 60)
      for (let r = 0; r < requestCount; r++) {
        const model = MODEL_CATALOG[models[Math.floor(Math.random() * models.length)]]
        const inputTokens = 200 + Math.floor(Math.random() * 2000)
        const outputTokens = 100 + Math.floor(Math.random() * 800)
        const cost = (inputTokens / 1000) * model.inputCostPer1k + (outputTokens / 1000) * model.outputCostPer1k
        const isCached = Math.random() < 0.25

        const rec: RequestRecord = {
          id: `demo_${day}_${r}`,
          timestamp: now - day * 24 * 3600 * 1000 + Math.random() * 24 * 3600 * 1000,
          modelId: model.id,
          inputTokens,
          outputTokens,
          costUsd: isCached ? 0 : cost,
          taskType: tasks[Math.floor(Math.random() * tasks.length)],
          cached: isCached,
          latencyMs: model.latencyMs + Math.random() * 500,
          provider: model.provider,
        }
        this.records.push(rec)
      }
    }
  }

  getRecords(limit = 100): RequestRecord[] {
    return this.records
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }
}

// Singleton
let _analyzer: CostAnalyzer | null = null
export function getAnalyzer(): CostAnalyzer {
  if (!_analyzer) {
    _analyzer = new CostAnalyzer()
    _analyzer.seedDemoData()
  }
  return _analyzer
}
