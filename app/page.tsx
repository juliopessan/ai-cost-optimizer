'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n, LocaleSwitcher } from '@/lib/i18n'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimePoint { date: string; costUsd: number; requests: number; cachedHits: number; savedUsd: number }
interface Breakdown {
  totalUsd: number
  byModel: Record<string, { requests: number; costUsd: number; tokens: number }>
  byProvider: Record<string, { requests: number; costUsd: number }>
  cachedRequests: number
  cachedSavingsUsd: number
}
interface Projection {
  daily: number; weekly: number; monthly: number; annual: number
  savingsIfOptimized: number
  optimizationOpportunities: Array<{ id: string; title: string; description: string; estimatedSavingsPercent: number; effort: string; category: string }>
}
interface RoutingDecision {
  selectedModel: { id: string; provider: string; qualityScore: number; latencyMs: number; inputCostPer1k: number; outputCostPer1k: number }
  reason: string; estimatedCostUsd: number; estimatedTokens: number
  alternativeModels: Array<{ model: { id: string }; tradeoff: string }>
}
interface PromptResult {
  original: string; optimized: string; originalTokens: number; optimizedTokens: number
  savingsPercent: number
  techniques: Array<{ name: string; description: string; tokensSaved: number }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#c8532a', openai: '#10a37f', google: '#4285f4', cache: '#9333ea',
}
const EFFORT_COLOR: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }
const CATEGORY_ICON: Record<string, string> = { routing: '🔀', caching: '⚡', prompting: '✍️', batching: '📦' }

function fmt(n: number, digits = 4) { return n < 0.01 ? n.toFixed(6) : `$${n.toFixed(digits)}` }
function fmtUsd(n: number) { return `$${n.toFixed(2)}` }

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`text-3xl font-black ${accent ?? 'text-gray-900'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}22`, color }}>
      {text}
    </span>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-lg">{icon}</div>
      <div>
        <h2 className="font-bold text-gray-900 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'overview' | 'router' | 'prompter' | 'cache'>('overview')
  const [timeSeries, setTimeSeries] = useState<TimePoint[]>([])
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(true)

  // Router tab
  const [routePrompt, setRoutePrompt] = useState('Summarize this quarterly earnings report and highlight key financial metrics.')
  const [priority, setPriority] = useState<'cost' | 'quality' | 'speed'>('cost')
  const [routeResult, setRouteResult] = useState<RoutingDecision | null>(null)
  const [routing, setRouting] = useState(false)

  // Prompter tab
  const [rawPrompt, setRawPrompt] = useState('I would like you to please kindly help me to summarize the following text. Make sure that you ensure the summary is very concise and basically captures the most really important key points.')
  const [promptResult, setPromptResult] = useState<PromptResult | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [ts, bd, pr] = await Promise.all([
      fetch('/api/analyze?view=timeseries').then(r => r.json()),
      fetch('/api/analyze').then(r => r.json()),
      fetch('/api/analyze?view=projection').then(r => r.json()),
    ])
    setTimeSeries(ts)
    setBreakdown(bd)
    setProjection(pr)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRoute = async () => {
    setRouting(true)
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: routePrompt, prioritize: priority }),
    })
    const data = await res.json()
    setRouteResult(data.decision)
    setRouting(false)
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    const res = await fetch('/api/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: rawPrompt }),
    })
    const data = await res.json()
    setPromptResult(data)
    setOptimizing(false)
  }

  // Pie data
  const providerPie = breakdown
    ? Object.entries(breakdown.byProvider).map(([k, v]) => ({ name: k, value: +v.costUsd.toFixed(4) }))
    : []

  const modelBar = breakdown
    ? Object.entries(breakdown.byModel)
        .sort((a, b) => b[1].costUsd - a[1].costUsd)
        .slice(0, 6)
        .map(([k, v]) => ({ name: k.replace('claude-', 'c-').replace('gemini-', 'g-').replace('gpt-', ''), cost: +v.costUsd.toFixed(4), requests: v.requests }))
    : []

  const totalRequests = breakdown ? Object.values(breakdown.byModel).reduce((s, m) => s + m.requests, 0) : 0
  const cacheRate = totalRequests > 0 ? ((breakdown?.cachedRequests ?? 0) / totalRequests * 100).toFixed(1) : '0'

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'router', label: '🔀 Router' },
    { id: 'prompter', label: '✍️ Prompter' },
    { id: 'cache', label: '⚡ Cache' },
  ] as const

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-lg">⚙</div>
            <div>
              <h1 className="font-black text-gray-900 text-lg leading-none">AI Cost Optimizer</h1>
              <p className="text-xs text-gray-500">Model routing · Caching · Adaptive prompting · Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-medium">Live</span>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
                tab === t.id
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {!loading && tab === 'overview' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="14-Day Spend" value={fmtUsd(breakdown?.totalUsd ?? 0)} sub="across all models" accent="text-gray-900" />
              <StatCard label="Monthly Est." value={fmtUsd(projection?.monthly ?? 0)} sub="at current rate" />
              <StatCard label="Savings w/ Opt." value={fmtUsd(projection?.savingsIfOptimized ?? 0)} sub="per month" accent="text-green-600" />
              <StatCard label="Cache Hit Rate" value={`${cacheRate}%`} sub={`${breakdown?.cachedRequests ?? 0} cached reqs`} accent="text-purple-600" />
            </div>

            {/* Spend over time */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeader icon="📈" title="Spend Over Time" subtitle="Daily cost + cache savings (14 days)" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="saveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toFixed(2)}`} />
                  <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                  <Area type="monotone" dataKey="costUsd" stroke="#f97316" fill="url(#costGrad)" strokeWidth={2} name="Cost" />
                  <Area type="monotone" dataKey="savedUsd" stroke="#22c55e" fill="url(#saveGrad)" strokeWidth={2} name="Saved" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Model cost + Provider pie */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="🤖" title="Cost by Model" subtitle="Top 6 models by spend" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={modelBar} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                    <Bar dataKey="cost" fill="#f97316" radius={4} name="Cost USD" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="🏢" title="Cost by Provider" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={providerPie} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {providerPie.map((entry) => (
                        <Cell key={entry.name} fill={PROVIDER_COLORS[entry.name] ?? '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Optimization tips */}
            {projection && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="💡" title="Optimization Opportunities" subtitle="Actionable steps to reduce costs" />
                <div className="space-y-3">
                  {projection.optimizationOpportunities.map(op => (
                    <div key={op.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-gray-100">
                      <span className="text-2xl">{CATEGORY_ICON[op.category] ?? '💡'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{op.title}</span>
                          <Badge text={`-${op.estimatedSavingsPercent}%`} color="#16a34a" />
                          <Badge text={op.effort} color={EFFORT_COLOR[op.effort]} />
                          <Badge text={op.category} color="#6366f1" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{op.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ROUTER TAB ── */}
        {!loading && tab === 'router' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeader icon="🔀" title="Model Router" subtitle="Find the optimal model for any request" />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Your Prompt</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                    rows={4}
                    value={routePrompt}
                    onChange={e => setRoutePrompt(e.target.value)}
                    placeholder="Enter your prompt here..."
                  />
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-xs font-semibold text-gray-600">Priority:</span>
                  {(['cost', 'quality', 'speed'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${priority === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >{p === 'cost' ? '💰 Cost' : p === 'quality' ? '🎯 Quality' : '⚡ Speed'}</button>
                  ))}
                  <button
                    onClick={handleRoute}
                    disabled={routing || !routePrompt.trim()}
                    className="ml-auto px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                  >{routing ? 'Routing…' : 'Route Request →'}</button>
                </div>
              </div>
            </div>

            {routeResult && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">✅</div>
                  <div>
                    <p className="font-bold text-gray-900">Optimal Model: <span className="text-orange-600">{routeResult.selectedModel.id}</span></p>
                    <p className="text-xs text-gray-500">{routeResult.reason}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Est. Cost</p>
                    <p className="font-black text-orange-600">{fmt(routeResult.estimatedCostUsd)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Est. Tokens</p>
                    <p className="font-black text-gray-900">{routeResult.estimatedTokens}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Quality Score</p>
                    <p className="font-black text-green-600">{routeResult.selectedModel.qualityScore}/100</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Avg Latency</p>
                    <p className="font-black text-blue-600">{routeResult.selectedModel.latencyMs}ms</p>
                  </div>
                </div>
                {routeResult.alternativeModels.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">ALTERNATIVES</p>
                    <div className="space-y-2">
                      {routeResult.alternativeModels.map((alt, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
                          <span className="text-sm font-semibold text-gray-700">{alt.model.id}</span>
                          <span className="text-xs text-gray-500">{alt.tradeoff}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PROMPTER TAB ── */}
        {!loading && tab === 'prompter' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeader icon="✍️" title="Adaptive Prompter" subtitle="Compress prompts to reduce token usage" />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Original Prompt</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                    rows={5}
                    value={rawPrompt}
                    onChange={e => setRawPrompt(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleOptimize}
                  disabled={optimizing || !rawPrompt.trim()}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                >{optimizing ? 'Optimizing…' : 'Optimize Prompt →'}</button>
              </div>
            </div>

            {promptResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Original Tokens" value={String(promptResult.originalTokens)} />
                  <StatCard label="Optimized Tokens" value={String(promptResult.optimizedTokens)} accent="text-green-600" />
                  <StatCard label="Savings" value={`${promptResult.savingsPercent.toFixed(1)}%`} accent="text-orange-600" />
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">OPTIMIZED PROMPT</p>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap">{promptResult.optimized}</div>
                </div>
                {promptResult.techniques.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-3">TECHNIQUES APPLIED</p>
                    <div className="space-y-2">
                      {promptResult.techniques.map((t, i) => (
                        <div key={i} className="flex items-start justify-between bg-slate-50 rounded-xl px-4 py-2">
                          <div>
                            <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                            <p className="text-xs text-gray-500">{t.description}</p>
                          </div>
                          {t.tokensSaved > 0 && <Badge text={`-${t.tokensSaved} tkns`} color="#16a34a" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CACHE TAB ── */}
        {!loading && tab === 'cache' && (
          <CachePanel />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-gray-400">AI Cost Optimizer Framework · Built with Next.js + TypeScript</span>
          <span className="text-xs text-gray-400">github.com/juliopessan/ai-cost-optimizer</span>
        </div>
      </footer>
    </div>
  )
}

// ── Cache Panel (separate to keep page size manageable) ──────────────────────

function CachePanel() {
  const [data, setData] = useState<{ stats: { totalEntries: number; totalHits: number; hitRate: number; totalSavedUsd: number; totalSavedTokens: number } | null; entries: unknown[] }>({ stats: null, entries: [] })

  useEffect(() => {
    fetch('/api/cache').then(r => r.json()).then(setData)
  }, [])

  const stats = data.stats
  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Cache Entries" value={String(stats.totalEntries)} />
          <StatCard label="Total Hits" value={String(stats.totalHits)} accent="text-green-600" />
          <StatCard label="Hit Rate" value={`${(stats.hitRate * 100).toFixed(1)}%`} accent="text-purple-600" />
          <StatCard label="USD Saved" value={fmtUsd(stats.totalSavedUsd)} accent="text-orange-600" />
        </div>
      )}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <SectionHeader icon="⚡" title="Response Cache" subtitle="Semantic similarity matching · TTL-based eviction" />
        {data.entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">Cache is empty — start routing requests to populate it.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{data.entries.length} cached entries available.</p>
        )}
      </div>
    </div>
  )
}
