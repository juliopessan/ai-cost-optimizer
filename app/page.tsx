'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useI18n, LocaleSwitcher } from '@/lib/i18n'

// ── Types ─────────────────────────────────────────────────────────────────────
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
  selectedModel: { id: string; provider: string; qualityScore: number; latencyMs: number; inputCostPer1k: number }
  reason: string; estimatedCostUsd: number; estimatedTokens: number
  alternativeModels: Array<{ model: { id: string }; tradeoff: string }>
}
interface PromptResult {
  original: string; optimized: string; originalTokens: number; optimizedTokens: number
  savingsPercent: number
  techniques: Array<{ name: string; description: string; tokensSaved: number }>
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#c8532a', openai: '#10a37f', google: '#4285f4',
}
const EFFORT_COLOR: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }
const CATEGORY_ICON: Record<string, string> = { routing: '🔀', caching: '⚡', prompting: '✍️', batching: '📦' }

function fmtUsd(n: number) { return `$${n.toFixed(2)}` }
function fmt(n: number) { return n < 0.01 ? `$${n.toFixed(6)}` : `$${n.toFixed(4)}` }

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now()
    const duration = 1200
    const from = 0
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * ease)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])
  return <>{prefix}{display.toFixed(2)}{suffix}</>
}

// ── DNA Spinner ───────────────────────────────────────────────────────────────
function DNASpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="relative w-16 h-16">
        {['spin-ring-1','spin-ring-2','spin-ring-3','spin-ring-4'].map((cls, i) => (
          <div key={i} className={`absolute rounded-full border-2 border-orange-500 ${cls}`}
            style={{ inset: `${i * 4}px`, borderTopColor:'transparent', borderBottomColor:'transparent' }} />
        ))}
        <div className="absolute inset-0 flex items-center justify-center text-xl dna-wobble">🧬</div>
      </div>
    </div>
  )
}

// ── DNA Logo ──────────────────────────────────────────────────────────────────
function DNALogo({ size = 36 }: { size?: number }) {
  return (
    <div className="logo-hover rounded-xl flex items-center justify-center flex-shrink-0 cursor-default"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#FF6B35,#F04E37)' }}>
      <svg width={size * 0.6} height={size * 0.75} viewBox="0 0 16 20" fill="none">
        <path d="M4 1 C4 4 12 5.5 12 10 C12 14.5 4 16 4 19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 1 C12 4 4 5.5 4 10 C4 14.5 12 16 12 19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="4.5"  y1="4.5"  x2="11.5" y2="4.5"  stroke="white" strokeWidth="1.2" opacity="0.9"/>
        <line x1="6.5"  y1="7.5"  x2="9.5"  y2="7.5"  stroke="white" strokeWidth="1.2" opacity="0.9"/>
        <line x1="6.5"  y1="12.5" x2="9.5"  y2="12.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
        <line x1="4.5"  y1="15.5" x2="11.5" y2="15.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
      </svg>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, delay = 0, doAnimate = false, numValue }: {
  label: string; value: string; sub?: string; accent?: string; delay?: number; doAnimate?: boolean; numValue?: number
}) {
  return (
    <div className={`card-hover anim-scale-in delay-${delay} bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 cursor-default`}>
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`text-3xl font-black anim-count-up delay-${delay} ${accent ?? 'text-gray-900'}`}>
        {doAnimate && numValue !== undefined
          ? <AnimatedNumber value={numValue} prefix={value.startsWith('$') ? '$' : ''} suffix={value.endsWith('%') ? '%' : ''} />
          : value}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="anim-badge-pop px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}22`, color }}>{text}</span>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="anim-slide-right flex items-center gap-3 mb-5">
      <div className="logo-hover w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-lg cursor-default">{icon}</div>
      <div>
        <h2 className="font-bold text-gray-900 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', icon: '📊' },
  { id: 'router',   icon: '🔀' },
  { id: 'prompter', icon: '✍️' },
  { id: 'cache',    icon: '⚡' },
] as const
type TabId = typeof TABS[number]['id']

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('overview')
  const [prevTab, setPrevTab] = useState<TabId>('overview')
  const [tabKey, setTabKey] = useState(0)
  const [timeSeries, setTimeSeries] = useState<TimePoint[]>([])
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(true)

  const [routePrompt, setRoutePrompt] = useState('Summarize this quarterly earnings report and highlight key financial metrics.')
  const [priority, setPriority] = useState<'cost' | 'quality' | 'speed'>('cost')
  const [routeResult, setRouteResult] = useState<RoutingDecision | null>(null)
  const [routing, setRouting] = useState(false)

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
    setTimeSeries(ts); setBreakdown(bd); setProjection(pr)
    setLoading(false)
  }, [])
  useEffect(() => { loadData() }, [loadData])

  const switchTab = (id: TabId) => {
    setPrevTab(tab); setTab(id); setTabKey(k => k + 1)
  }

  const handleRoute = async () => {
    setRouting(true)
    const res = await fetch('/api/route', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: routePrompt, prioritize: priority }) })
    const data = await res.json()
    setRouteResult(data.decision); setRouting(false)
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    const res = await fetch('/api/cache', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: rawPrompt }) })
    const data = await res.json()
    setPromptResult(data); setOptimizing(false)
  }

  const providerPie = breakdown ? Object.entries(breakdown.byProvider).map(([k,v]) => ({ name: k, value: +v.costUsd.toFixed(4) })) : []
  const modelBar = breakdown
    ? Object.entries(breakdown.byModel).sort((a,b) => b[1].costUsd - a[1].costUsd).slice(0,6)
        .map(([k,v]) => ({ name: k.replace('claude-','c-').replace('gemini-','g-').replace('gpt-',''), cost: +v.costUsd.toFixed(4), requests: v.requests }))
    : []
  const totalRequests = breakdown ? Object.values(breakdown.byModel).reduce((s,m) => s+m.requests, 0) : 0
  const cacheRate = totalRequests > 0 ? (breakdown!.cachedRequests / totalRequests * 100).toFixed(1) : '0'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="anim-slide-down bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DNALogo size={38} />
            <div>
              <h1 className="font-black text-gray-900 text-lg leading-none">{t('app.name')}</h1>
              <p className="text-xs text-gray-400">{t('app.tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              <span className="text-xs text-gray-500 font-medium">{t('app.live')}</span>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map(tabItem => (
            <button key={tabItem.id} onClick={() => switchTab(tabItem.id)}
              className={`btn-hover relative px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                tab === tabItem.id ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              {tabItem.icon} {t(`nav.${tabItem.id}`)}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading && <DNASpinner />}

        {/* Overview */}
        {!loading && tab === 'overview' && (
          <div key={`overview-${tabKey}`} className="anim-tab space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={t('overview.spend_14d')} value={fmtUsd(breakdown?.totalUsd??0)} sub={t('overview.spend_14d_sub')} delay={0} doAnimate numValue={breakdown?.totalUsd}/>
              <StatCard label={t('overview.monthly_est')} value={fmtUsd(projection?.monthly??0)} sub={t('overview.monthly_est_sub')} delay={1} doAnimate numValue={projection?.monthly}/>
              <StatCard label={t('overview.savings_opt')} value={fmtUsd(projection?.savingsIfOptimized??0)} sub={t('overview.savings_opt_sub')} accent="text-green-600" delay={2} doAnimate numValue={projection?.savingsIfOptimized}/>
              <StatCard label={t('overview.cache_hit_rate')} value={`${cacheRate}%`} sub={t('overview.cache_hit_sub', { count: breakdown?.cachedRequests??0 })} accent="text-purple-600" delay={3}/>
            </div>

            <div className="anim-fade-up delay-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeader icon="📈" title={t('overview.spend_over_time')} subtitle={t('overview.spend_over_time_sub')} />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="saveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                  <XAxis dataKey="date" tick={{fontSize:11}} tickFormatter={d=>d.slice(5)}/>
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>`$${v.toFixed(2)}`}/>
                  <Tooltip formatter={(v:number)=>`$${v.toFixed(4)}`}/>
                  <Area type="monotone" dataKey="costUsd" stroke="#f97316" fill="url(#costGrad)" strokeWidth={2} name="Cost"/>
                  <Area type="monotone" dataKey="savedUsd" stroke="#22c55e" fill="url(#saveGrad)" strokeWidth={2} name="Saved"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="anim-fade-up delay-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="🤖" title={t('overview.cost_by_model')} subtitle={t('overview.cost_by_model_sub')} />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={modelBar} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                    <XAxis type="number" tick={{fontSize:11}} tickFormatter={v=>`$${v}`}/>
                    <YAxis dataKey="name" type="category" tick={{fontSize:11}} width={80}/>
                    <Tooltip formatter={(v:number)=>`$${v.toFixed(4)}`}/>
                    <Bar dataKey="cost" fill="#f97316" radius={4} name="Cost USD"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="anim-fade-up delay-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="🏢" title={t('overview.cost_by_provider')} />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={providerPie} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name"
                      label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {providerPie.map(entry => <Cell key={entry.name} fill={PROVIDER_COLORS[entry.name]??'#6b7280'}/>)}
                    </Pie>
                    <Tooltip formatter={(v:number)=>`$${v.toFixed(4)}`}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {projection && (
              <div className="anim-fade-up delay-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="💡" title={t('overview.opt_opportunities')} subtitle={t('overview.opt_opportunities_sub')} />
                <div className="space-y-3">
                  {projection.optimizationOpportunities.map((op,i) => (
                    <div key={op.id} className={`tip-hover anim-fade-up delay-${Math.min(i,5)} flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-gray-100`}>
                      <span className="text-2xl">{CATEGORY_ICON[op.category]??'💡'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{op.title}</span>
                          <Badge text={`-${op.estimatedSavingsPercent}%`} color="#16a34a"/>
                          <Badge text={op.effort} color={EFFORT_COLOR[op.effort]}/>
                          <Badge text={op.category} color="#6366f1"/>
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

        {/* Router */}
        {!loading && tab === 'router' && (
          <div key={`router-${tabKey}`} className="anim-tab space-y-6">
            <div className="anim-fade-up delay-0 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeader icon="🔀" title={t('router.title')} subtitle={t('router.subtitle')} />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('router.your_prompt')}</label>
                  <textarea className="textarea-focus w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 bg-white resize-none"
                    rows={4} value={routePrompt} onChange={e=>setRoutePrompt(e.target.value)} placeholder={t('router.prompt_placeholder')}/>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-xs font-semibold text-gray-600">{t('router.priority')}:</span>
                  {(['cost','quality','speed'] as const).map(p => (
                    <button key={p} onClick={()=>setPriority(p)}
                      className={`btn-hover px-3 py-1 rounded-lg text-sm font-semibold transition-all ${priority===p?'bg-orange-500 text-white':'bg-gray-100 text-gray-600'}`}>
                      {t(`router.priority_${p}`)}
                    </button>
                  ))}
                  <button onClick={handleRoute} disabled={routing||!routePrompt.trim()}
                    className="btn-hover ml-auto px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                    {routing ? t('router.routing') : t('router.route_btn')}
                  </button>
                </div>
              </div>
            </div>
            {routeResult && (
              <div className="anim-scale-in delay-0 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="anim-slide-right flex items-center gap-3">
                  <div className="anim-badge-pop w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">✅</div>
                  <div>
                    <p className="font-bold text-gray-900">{t('router.optimal_model')}: <span className="text-orange-600">{routeResult.selectedModel.id}</span></p>
                    <p className="text-xs text-gray-500">{routeResult.reason}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {label:t('router.est_cost'), value:fmt(routeResult.estimatedCostUsd), accent:'text-orange-600'},
                    {label:t('router.est_tokens'), value:String(routeResult.estimatedTokens), accent:'text-gray-900'},
                    {label:t('router.quality_score'), value:`${routeResult.selectedModel.qualityScore}/100`, accent:'text-green-600'},
                    {label:t('router.avg_latency'), value:`${routeResult.selectedModel.latencyMs}ms`, accent:'text-blue-600'},
                  ].map((item,i) => (
                    <div key={i} className={`anim-scale-in delay-${i} bg-slate-50 rounded-xl p-3 text-center`}>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className={`font-black ${item.accent}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {routeResult.alternativeModels.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{t('router.alternatives').toUpperCase()}</p>
                    {routeResult.alternativeModels.map((alt,i) => (
                      <div key={i} className={`anim-fade-up delay-${i} flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2 mb-2`}>
                        <span className="text-sm font-semibold text-gray-700">{alt.model.id}</span>
                        <span className="text-xs text-gray-500">{alt.tradeoff}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prompter */}
        {!loading && tab === 'prompter' && (
          <div key={`prompter-${tabKey}`} className="anim-tab space-y-6">
            <div className="anim-fade-up delay-0 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeader icon="✍️" title={t('prompter.title')} subtitle={t('prompter.subtitle')} />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('prompter.original_prompt')}</label>
                  <textarea className="textarea-focus w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 bg-white resize-none"
                    rows={5} value={rawPrompt} onChange={e=>setRawPrompt(e.target.value)}/>
                </div>
                <button onClick={handleOptimize} disabled={optimizing||!rawPrompt.trim()}
                  className="btn-hover px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {optimizing ? t('prompter.optimizing') : t('prompter.optimize_btn')}
                </button>
              </div>
            </div>
            {promptResult && (
              <div className="anim-fade-in space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label={t('prompter.original_tokens')} value={String(promptResult.originalTokens)} delay={0}/>
                  <StatCard label={t('prompter.optimized_tokens')} value={String(promptResult.optimizedTokens)} accent="text-green-600" delay={1}/>
                  <StatCard label={t('prompter.savings')} value={`${promptResult.savingsPercent.toFixed(1)}%`} accent="text-orange-600" delay={2}/>
                </div>
                <div className="anim-fade-up delay-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">{t('prompter.optimized_prompt').toUpperCase()}</p>
                  <div className="anim-fade-in delay-2 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap">
                    {promptResult.optimized}
                  </div>
                </div>
                {promptResult.techniques.length > 0 && (
                  <div className="anim-fade-up delay-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-3">{t('prompter.techniques_applied').toUpperCase()}</p>
                    {promptResult.techniques.map((tech,i) => (
                      <div key={i} className={`anim-fade-up delay-${i} flex items-start justify-between bg-slate-50 rounded-xl px-4 py-2 mb-2`}>
                        <div>
                          <span className="text-sm font-semibold text-gray-800">{tech.name}</span>
                          <p className="text-xs text-gray-500">{tech.description}</p>
                        </div>
                        {tech.tokensSaved > 0 && <Badge text={`-${tech.tokensSaved} tkns`} color="#16a34a"/>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cache */}
        {!loading && tab === 'cache' && (
          <div key={`cache-${tabKey}`} className="anim-tab">
            <CachePanel />
          </div>
        )}
      </main>

      <footer className="anim-fade-in delay-5 border-t border-gray-100 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DNALogo size={22} />
            <span className="text-xs text-gray-400">{t('app.footer')}</span>
          </div>
          <a href="https://github.com/juliopessan/ai-cost-optimizer" target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-orange-500 transition-colors">
            github.com/juliopessan/ai-cost-optimizer
          </a>
        </div>
      </footer>
    </div>
  )
}

// ── Cache Panel ───────────────────────────────────────────────────────────────
function CachePanel() {
  const { t } = useI18n()
  const [data, setData] = useState<{stats:{totalEntries:number;totalHits:number;hitRate:number;totalSavedUsd:number}|null;entries:unknown[]}>({stats:null,entries:[]})
  useEffect(() => { fetch('/api/cache').then(r=>r.json()).then(setData) }, [])
  const stats = data.stats
  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:t('cache.entries'), value:String(stats.totalEntries)},
            {label:t('cache.total_hits'), value:String(stats.totalHits), accent:'text-green-600'},
            {label:t('cache.hit_rate'), value:`${(stats.hitRate*100).toFixed(1)}%`, accent:'text-purple-600'},
            {label:t('cache.usd_saved'), value:`$${stats.totalSavedUsd.toFixed(2)}`, accent:'text-orange-600'},
          ].map((s,i) => <StatCard key={i} label={s.label} value={s.value} accent={s.accent} delay={i}/>)}
        </div>
      )}
      <div className="anim-fade-up delay-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <SectionHeader icon="⚡" title={t('cache.title')} subtitle={t('cache.subtitle')} />
        {data.entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3 dna-wobble inline-block">🔍</p>
            <p className="text-sm">{t('cache.empty_title')}</p>
            <p className="text-xs mt-1">{t('cache.empty_sub')}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('cache.entries_available', {count: data.entries.length})}</p>
        )}
      </div>
    </div>
  )
}
