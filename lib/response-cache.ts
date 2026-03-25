// lib/response-cache.ts
// AI Cost Optimizer — Response Cache
// Semantic-aware caching to avoid re-calling LLMs for similar prompts

export interface CacheEntry {
  id: string
  promptHash: string
  promptPreview: string
  response: string
  modelUsed: string
  costUsd: number
  tokens: number
  createdAt: number
  expiresAt: number
  hitCount: number
  tags: string[]
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  totalSavedUsd: number
  totalSavedTokens: number
  memoryUsageKb: number
}

export interface CacheLookupResult {
  hit: boolean
  entry?: CacheEntry
  similarity?: number
  savedCostUsd?: number
}

// Simple hash function for prompts
function hashPrompt(prompt: string): string {
  let hash = 0
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Normalize prompt for similarity comparison
function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Jaccard similarity on word sets
function promptSimilarity(a: string, b: string): number {
  const setA = new Set(normalizePrompt(a).split(' '))
  const setB = new Set(normalizePrompt(b).split(' '))
  const arrA = Array.from(setA)
  const intersection = new Set(arrA.filter(x => setB.has(x)))
  const union = new Set([...arrA, ...Array.from(setB)])
  return intersection.size / union.size
}

export class ResponseCache {
  private entries: Map<string, CacheEntry> = new Map()
  private stats = { hits: 0, misses: 0, totalSavedUsd: 0, totalSavedTokens: 0 }
  private defaultTtlMs: number
  private similarityThreshold: number

  constructor(options: { defaultTtlMs?: number; similarityThreshold?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 3600 * 1000 * 24 // 24h default
    this.similarityThreshold = options.similarityThreshold ?? 0.85
  }

  set(prompt: string, response: string, metadata: { modelId: string; costUsd: number; tokens: number; tags?: string[]; ttlMs?: number }): CacheEntry {
    const now = Date.now()
    const entry: CacheEntry = {
      id: `cache_${now}_${Math.random().toString(36).slice(2)}`,
      promptHash: hashPrompt(prompt),
      promptPreview: prompt.slice(0, 120) + (prompt.length > 120 ? '…' : ''),
      response,
      modelUsed: metadata.modelId,
      costUsd: metadata.costUsd,
      tokens: metadata.tokens,
      createdAt: now,
      expiresAt: now + (metadata.ttlMs ?? this.defaultTtlMs),
      hitCount: 0,
      tags: metadata.tags ?? [],
    }
    this.entries.set(entry.promptHash, entry)
    return entry
  }

  get(prompt: string): CacheLookupResult {
    const now = Date.now()
    const hash = hashPrompt(prompt)

    // Exact match
    const exact = this.entries.get(hash)
    if (exact && exact.expiresAt > now) {
      exact.hitCount++
      this.stats.hits++
      this.stats.totalSavedUsd += exact.costUsd
      this.stats.totalSavedTokens += exact.tokens
      return { hit: true, entry: exact, similarity: 1.0, savedCostUsd: exact.costUsd }
    }

    // Similarity match (scan active entries)
    let bestMatch: CacheEntry | null = null
    let bestSimilarity = 0

    for (const entry of Array.from(this.entries.values())) {
      if (entry.expiresAt <= now) continue
      const sim = promptSimilarity(prompt, entry.promptPreview)
      if (sim > bestSimilarity) {
        bestSimilarity = sim
        bestMatch = entry
      }
    }

    if (bestMatch && bestSimilarity >= this.similarityThreshold) {
      bestMatch.hitCount++
      this.stats.hits++
      this.stats.totalSavedUsd += bestMatch.costUsd
      this.stats.totalSavedTokens += bestMatch.tokens
      return { hit: true, entry: bestMatch, similarity: bestSimilarity, savedCostUsd: bestMatch.costUsd }
    }

    this.stats.misses++
    return { hit: false }
  }

  evictExpired(): number {
    const now = Date.now()
    let evicted = 0
    for (const [key, entry] of Array.from(this.entries)) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key)
        evicted++
      }
    }
    return evicted
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    const memoryUsageKb = Math.ceil(
      JSON.stringify(Array.from(this.entries.values())).length / 1024
    )
    return {
      totalEntries: this.entries.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      totalSavedUsd: this.stats.totalSavedUsd,
      totalSavedTokens: this.stats.totalSavedTokens,
      memoryUsageKb,
    }
  }

  listEntries(limit = 50): CacheEntry[] {
    return Array.from(this.entries.values())
      .filter(e => e.expiresAt > Date.now())
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit)
  }

  clear(): void {
    this.entries.clear()
  }
}

// Singleton cache instance for API routes
let _cache: ResponseCache | null = null
export function getCache(): ResponseCache {
  if (!_cache) _cache = new ResponseCache()
  return _cache
}
