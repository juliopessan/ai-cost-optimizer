/**
 * Internationalization — Portuguese (BR) / English
 * TypeScript mirror of web/i18n.py — single source of truth kept in sync.
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n()
 *   t('nav.overview')              // → "Visão Geral" (pt-BR) or "Overview" (en)
 *   t('overview.cache_hit_sub', { count: 42 }) // → "42 requisições em cache"
 */

'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'pt-BR' | 'en'

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

type TranslationValue = string | Record<string, unknown>
type Catalog = Record<string, Record<string, TranslationValue>>

// ── Catalog ───────────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<Locale, Catalog> = {
  en: {
    app: {
      name: 'AI Cost Optimizer',
      tagline: 'Model routing · Caching · Adaptive prompting · Analytics',
      live: 'Live',
      built_by: 'Built at FCamara AI Practice',
      footer: 'AI Cost Optimizer Framework · Built with Next.js + TypeScript',
    },
    nav: {
      overview: 'Overview',
      router: 'Router',
      prompter: 'Prompter',
      cache: 'Cache',
    },
    overview: {
      title: 'Overview',
      subtitle: 'Spend summary and optimization opportunities',
      spend_14d: '14-Day Spend',
      spend_14d_sub: 'across all models',
      monthly_est: 'Monthly Est.',
      monthly_est_sub: 'at current rate',
      savings_opt: 'Savings w/ Opt.',
      savings_opt_sub: 'per month',
      cache_hit_rate: 'Cache Hit Rate',
      cache_hit_sub: '{count} cached requests',
      spend_over_time: 'Spend Over Time',
      spend_over_time_sub: 'Daily cost + cache savings (14 days)',
      cost_by_model: 'Cost by Model',
      cost_by_model_sub: 'Top 6 models by spend',
      cost_by_provider: 'Cost by Provider',
      opt_opportunities: 'Optimization Opportunities',
      opt_opportunities_sub: 'Actionable steps to reduce costs',
    },
    router: {
      title: 'Model Router',
      subtitle: 'Find the optimal model for any request',
      your_prompt: 'Your Prompt',
      prompt_placeholder: 'Enter your prompt here...',
      priority: 'Priority',
      priority_cost: '💰 Cost',
      priority_quality: '🎯 Quality',
      priority_speed: '⚡ Speed',
      route_btn: 'Route Request →',
      routing: 'Routing…',
      optimal_model: 'Optimal Model',
      est_cost: 'Est. Cost',
      est_tokens: 'Est. Tokens',
      quality_score: 'Quality Score',
      avg_latency: 'Avg Latency',
      alternatives: 'Alternatives',
    },
    prompter: {
      title: 'Adaptive Prompter',
      subtitle: 'Compress prompts to reduce token usage',
      original_prompt: 'Original Prompt',
      optimize_btn: 'Optimize Prompt →',
      optimizing: 'Optimizing…',
      original_tokens: 'Original Tokens',
      optimized_tokens: 'Optimized Tokens',
      savings: 'Savings',
      optimized_prompt: 'Optimized Prompt',
      techniques_applied: 'Techniques Applied',
    },
    cache: {
      title: 'Response Cache',
      subtitle: 'Semantic similarity matching · TTL-based eviction',
      entries: 'Cache Entries',
      total_hits: 'Total Hits',
      hit_rate: 'Hit Rate',
      usd_saved: 'USD Saved',
      empty_title: 'Cache is empty',
      empty_sub: 'Start routing requests to populate it.',
      entries_available: '{count} cached entries available.',
    },
    models: {
      provider_anthropic: 'Anthropic',
      provider_openai: 'OpenAI',
      provider_google: 'Google',
      task_simple_qa: 'Simple Q&A',
      task_summarization: 'Summarization',
      task_classification: 'Classification',
      task_code_generation: 'Code Generation',
      task_reasoning: 'Reasoning',
      task_long_context: 'Long Context',
      task_creative_writing: 'Creative Writing',
      task_data_extraction: 'Data Extraction',
      task_math: 'Math',
    },
    optimization: {
      effort_low: 'Low Effort',
      effort_medium: 'Medium Effort',
      effort_high: 'High Effort',
      category_routing: 'Routing',
      category_caching: 'Caching',
      category_prompting: 'Prompting',
      category_batching: 'Batching',
      savings_label: '-{pct}%',
    },
    errors: {
      prompt_required: 'Prompt is required.',
      budget_exceeded: 'Estimated cost ${cost} exceeds budget limit ${limit}.',
      no_capable_model: 'No model found capable of handling this task within the given constraints.',
      cache_miss: 'Cache miss — forwarding to model router.',
      api_error: 'API error: {message}',
      generic: 'Something went wrong. Please try again.',
    },
    units: {
      tokens: 'tokens',
      ms: 'ms',
      usd_per_1k: '$/1K tokens',
      daily: '/ day',
      weekly: '/ week',
      monthly: '/ month',
      annual: '/ year',
    },
  },

  'pt-BR': {
    app: {
      name: 'Otimizador de Custos de IA',
      tagline: 'Roteamento de modelos · Cache · Prompts adaptativos · Analytics',
      live: 'Ao vivo',
      built_by: 'Desenvolvido na FCamara AI Practice',
      footer: 'AI Cost Optimizer Framework · Desenvolvido com Next.js + TypeScript',
    },
    nav: {
      overview: 'Visão Geral',
      router: 'Roteador',
      prompter: 'Otimizador',
      cache: 'Cache',
    },
    overview: {
      title: 'Visão Geral',
      subtitle: 'Resumo de gastos e oportunidades de otimização',
      spend_14d: 'Gasto (14 dias)',
      spend_14d_sub: 'em todos os modelos',
      monthly_est: 'Estimativa Mensal',
      monthly_est_sub: 'no ritmo atual',
      savings_opt: 'Economia c/ Otimização',
      savings_opt_sub: 'por mês',
      cache_hit_rate: 'Taxa de Cache',
      cache_hit_sub: '{count} requisições em cache',
      spend_over_time: 'Gasto ao Longo do Tempo',
      spend_over_time_sub: 'Custo diário + economia de cache (14 dias)',
      cost_by_model: 'Custo por Modelo',
      cost_by_model_sub: 'Top 6 modelos por gasto',
      cost_by_provider: 'Custo por Provedor',
      opt_opportunities: 'Oportunidades de Otimização',
      opt_opportunities_sub: 'Ações concretas para reduzir custos',
    },
    router: {
      title: 'Roteador de Modelos',
      subtitle: 'Encontre o modelo ideal para cada requisição',
      your_prompt: 'Seu Prompt',
      prompt_placeholder: 'Digite seu prompt aqui...',
      priority: 'Prioridade',
      priority_cost: '💰 Custo',
      priority_quality: '🎯 Qualidade',
      priority_speed: '⚡ Velocidade',
      route_btn: 'Rotear Requisição →',
      routing: 'Roteando…',
      optimal_model: 'Modelo Ideal',
      est_cost: 'Custo Est.',
      est_tokens: 'Tokens Est.',
      quality_score: 'Qualidade',
      avg_latency: 'Latência Média',
      alternatives: 'Alternativas',
    },
    prompter: {
      title: 'Otimizador de Prompts',
      subtitle: 'Comprima prompts para reduzir o uso de tokens',
      original_prompt: 'Prompt Original',
      optimize_btn: 'Otimizar Prompt →',
      optimizing: 'Otimizando…',
      original_tokens: 'Tokens Originais',
      optimized_tokens: 'Tokens Otimizados',
      savings: 'Economia',
      optimized_prompt: 'Prompt Otimizado',
      techniques_applied: 'Técnicas Aplicadas',
    },
    cache: {
      title: 'Cache de Respostas',
      subtitle: 'Similaridade semântica · Expiração automática (TTL)',
      entries: 'Entradas no Cache',
      total_hits: 'Total de Hits',
      hit_rate: 'Taxa de Acerto',
      usd_saved: 'Dólares Economizados',
      empty_title: 'Cache vazio',
      empty_sub: 'Comece a rotear requisições para populá-lo.',
      entries_available: '{count} entradas em cache disponíveis.',
    },
    models: {
      provider_anthropic: 'Anthropic',
      provider_openai: 'OpenAI',
      provider_google: 'Google',
      task_simple_qa: 'Pergunta Simples',
      task_summarization: 'Sumarização',
      task_classification: 'Classificação',
      task_code_generation: 'Geração de Código',
      task_reasoning: 'Raciocínio',
      task_long_context: 'Contexto Longo',
      task_creative_writing: 'Escrita Criativa',
      task_data_extraction: 'Extração de Dados',
      task_math: 'Matemática',
    },
    optimization: {
      effort_low: 'Esforço Baixo',
      effort_medium: 'Esforço Médio',
      effort_high: 'Esforço Alto',
      category_routing: 'Roteamento',
      category_caching: 'Cache',
      category_prompting: 'Prompts',
      category_batching: 'Lotes',
      savings_label: '-{pct}%',
    },
    errors: {
      prompt_required: 'O prompt é obrigatório.',
      budget_exceeded: 'Custo estimado ${cost} excede o limite de ${limit}.',
      no_capable_model: 'Nenhum modelo encontrado capaz de lidar com essa tarefa dentro das restrições informadas.',
      cache_miss: 'Cache miss — encaminhando para o roteador de modelos.',
      api_error: 'Erro de API: {message}',
      generic: 'Algo deu errado. Tente novamente.',
    },
    units: {
      tokens: 'tokens',
      ms: 'ms',
      usd_per_1k: '$/1K tokens',
      daily: '/ dia',
      weekly: '/ semana',
      monthly: '/ mês',
      annual: '/ ano',
    },
  },
}

// ── Interpolation ─────────────────────────────────────────────────────────────

function interpolate(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`
  )
}

// ── Core translate fn ─────────────────────────────────────────────────────────

export function translate(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>
): string {
  const parts = key.split('.')
  const catalog = TRANSLATIONS[locale] ?? TRANSLATIONS['en']
  const fallback = TRANSLATIONS['en']

  let value: unknown = catalog
  for (const part of parts) {
    value = (value as Record<string, unknown>)?.[part]
    if (value === undefined) break
  }

  if (typeof value !== 'string') {
    // Try English fallback
    value = fallback
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part]
      if (value === undefined) break
    }
  }

  if (typeof value !== 'string') return key

  return params ? interpolate(value, params) : value
}

// ── Context + Provider ────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'pt-BR',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({
  children,
  defaultLocale = 'pt-BR',
}: {
  children: ReactNode
  defaultLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(key, locale, params),
    [locale]
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

// ── Locale switcher component ─────────────────────────────────────────────────

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="flex items-center gap-1 text-xs font-semibold">
      {(['pt-BR', 'en'] as Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`px-2 py-1 rounded-lg transition-all ${
            locale === l
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          {l === 'pt-BR' ? '🇧🇷 PT' : '🇺🇸 EN'}
        </button>
      ))}
    </div>
  )
}

export { TRANSLATIONS }
export type { Catalog }
