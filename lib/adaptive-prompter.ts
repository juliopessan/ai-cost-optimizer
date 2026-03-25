// lib/adaptive-prompter.ts
// AI Cost Optimizer — Adaptive Prompter
// Compresses, optimizes and adapts prompts to minimize token usage

export interface PromptOptimizationResult {
  original: string
  optimized: string
  originalTokens: number
  optimizedTokens: number
  savingsPercent: number
  techniques: AppliedTechnique[]
}

export interface AppliedTechnique {
  name: string
  description: string
  tokensSaved: number
}

export interface SystemPromptTemplate {
  id: string
  name: string
  original: string
  compressed: string
  compressionRatio: number
  useCount: number
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Remove filler phrases that don't add meaning
const FILLER_PATTERNS: [RegExp, string][] = [
  [/please (kindly |do )?(help me |assist me |)?/gi, ''],
  [/i would like you to /gi, ''],
  [/could you please /gi, ''],
  [/can you please /gi, ''],
  [/i need you to /gi, ''],
  [/it is important that you /gi, ''],
  [/make sure (that )?you /gi, ''],
  [/ensure that /gi, ''],
  [/\bkindly\b/gi, ''],
  [/\bas an AI language model,?\s*/gi, ''],
  [/\bas a helpful assistant,?\s*/gi, ''],
  [/feel free to /gi, ''],
  [/don't hesitate to /gi, ''],
]

// Common verbose → concise replacements
const COMPRESSION_MAP: [RegExp, string][] = [
  [/in order to/gi, 'to'],
  [/due to the fact that/gi, 'because'],
  [/at this point in time/gi, 'now'],
  [/in the event that/gi, 'if'],
  [/for the purpose of/gi, 'for'],
  [/with regard to/gi, 'about'],
  [/in terms of/gi, 'regarding'],
  [/a large number of/gi, 'many'],
  [/a small number of/gi, 'few'],
  [/the majority of/gi, 'most'],
  [/is able to/gi, 'can'],
  [/are able to/gi, 'can'],
  [/was able to/gi, 'could'],
  [/provide a summary of/gi, 'summarize'],
  [/provide an explanation of/gi, 'explain'],
  [/provide information about/gi, 'describe'],
  [/\bvery\s+(?=\w)/gi, ''],
  [/\bquite\s+(?=\w)/gi, ''],
  [/\breally\s+(?=\w)/gi, ''],
  [/\bjust\s+(?=\w)/gi, ''],
  [/\bbasically\b/gi, ''],
  [/\bactually\b/gi, ''],
  [/\bsimply\b(?! because)/gi, ''],
]

export function optimizePrompt(prompt: string): PromptOptimizationResult {
  let optimized = prompt
  const techniques: AppliedTechnique[] = []

  // Step 1: Remove filler phrases
  let beforeFiller = optimized
  for (const [pattern, replacement] of FILLER_PATTERNS) {
    optimized = optimized.replace(pattern, replacement)
  }
  const fillerSaved = estimateTokens(beforeFiller) - estimateTokens(optimized)
  if (fillerSaved > 0) {
    techniques.push({ name: 'Filler removal', description: 'Removed redundant polite fillers', tokensSaved: fillerSaved })
  }

  // Step 2: Verbose phrase compression
  let beforeCompression = optimized
  for (const [pattern, replacement] of COMPRESSION_MAP) {
    optimized = optimized.replace(pattern, replacement)
  }
  const compressionSaved = estimateTokens(beforeCompression) - estimateTokens(optimized)
  if (compressionSaved > 0) {
    techniques.push({ name: 'Verbose phrase compression', description: 'Replaced wordy phrases with concise equivalents', tokensSaved: compressionSaved })
  }

  // Step 3: Normalize whitespace
  let beforeWS = optimized
  optimized = optimized.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const wsSaved = estimateTokens(beforeWS) - estimateTokens(optimized)
  if (wsSaved > 0) {
    techniques.push({ name: 'Whitespace normalization', description: 'Collapsed excess whitespace', tokensSaved: wsSaved })
  }

  // Step 4: Suggest structured format if not already using it
  const hasStructure = /^(###|##|-|\*|\d+\.)/.test(optimized)
  if (!hasStructure && optimized.length > 200) {
    techniques.push({
      name: 'Structure suggestion',
      description: 'Consider using bullet points or numbered lists — structured prompts save 10-20% on average output tokens',
      tokensSaved: 0,
    })
  }

  const originalTokens = estimateTokens(prompt)
  const optimizedTokens = estimateTokens(optimized)
  const savingsPercent = originalTokens > 0 ? ((originalTokens - optimizedTokens) / originalTokens) * 100 : 0

  return {
    original: prompt,
    optimized,
    originalTokens,
    optimizedTokens,
    savingsPercent,
    techniques,
  }
}

export function compressSystemPrompt(systemPrompt: string): { compressed: string; ratio: number } {
  // Apply all optimizations
  const result = optimizePrompt(systemPrompt)
  
  // Additional: remove redundant instructions
  let compressed = result.optimized
  
  // Deduplicate similar instructions (simple: remove exact duplicate sentences)
  const sentences = compressed.split(/[.!?]\s+/)
  const seen = new Set<string>()
  const deduped = sentences.filter(s => {
    const norm = s.trim().toLowerCase()
    if (seen.has(norm)) return false
    seen.add(norm)
    return true
  })
  compressed = deduped.join('. ')

  const ratio = estimateTokens(systemPrompt) > 0
    ? estimateTokens(compressed) / estimateTokens(systemPrompt)
    : 1

  return { compressed, ratio }
}

export function buildOptimalSystemPrompt(
  role: string,
  capabilities: string[],
  constraints: string[],
  outputFormat?: string
): string {
  const parts = [
    `You are ${role}.`,
    capabilities.length > 0 ? `You: ${capabilities.join(', ')}.` : '',
    constraints.length > 0 ? `Constraints: ${constraints.join('; ')}.` : '',
    outputFormat ? `Output: ${outputFormat}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

export function estimateMonthlySavings(
  avgPromptLengthChars: number,
  requestsPerDay: number,
  inputCostPer1kTokens: number,
  outputCostPer1kTokens: number,
  estimatedCompressionRatio = 0.15
): {
  monthlyInputCostSaved: number
  monthlyOutputCostSaved: number
  totalMonthlySaved: number
} {
  const tokensPerRequest = estimateTokens(' '.repeat(avgPromptLengthChars))
  const tokensSavedPerRequest = tokensPerRequest * estimatedCompressionRatio
  const requestsPerMonth = requestsPerDay * 30

  const monthlyInputCostSaved = (tokensSavedPerRequest * requestsPerMonth / 1000) * inputCostPer1kTokens
  const avgOutputCompression = estimatedCompressionRatio * 0.5
  const outputTokens = tokensPerRequest * 0.4
  const monthlyOutputCostSaved = (outputTokens * avgOutputCompression * requestsPerMonth / 1000) * outputCostPer1kTokens

  return {
    monthlyInputCostSaved,
    monthlyOutputCostSaved,
    totalMonthlySaved: monthlyInputCostSaved + monthlyOutputCostSaved,
  }
}
