'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue, animate } from 'framer-motion'
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

// ── Motion variants ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: 'easeOut' } }),
}
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scaleIn: any = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i = 0) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' } }),
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slideRight: any = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
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
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut' as const,
      onUpdate: (v) => setDisplay(v),
    })
    return controls.stop
  }, [value])
  return <span>{prefix}{display.toFixed(decimals)}{suffix}</span>
}

// ── DNA Spinner ───────────────────────────────────────────────────────────────
function DNASpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <motion.div className="relative w-16 h-16">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-orange-500"
            style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2 - i * 0.1, repeat: Infinity, ease: 'linear', delay: i * 0.15 }}
          />
        ))}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-orange-500 text-xl"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >🧬</motion.div>
      </motion.div>
    </div>
  )
}

// ── DNA Logo ──────────────────────────────────────────────────────────────────
function DNALogo({ size = 36 }: { size?: number }) {
  return (
    <motion.div
      className="rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#FF6B35,#F04E37)' }}
      whileHover={{ scale: 1.1, rotate: 8 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <svg width={size * 0.6} height={size * 0.75} viewBox="0 0 16 20" fill="none">
        <path d="M4 1 C4 4 12 5.5 12 10 C12 14.5 4 16 4 19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 1 C12 4 4 5.5 4 10 C4 14.5 12 16 12 19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="4.5"  y1="4.5"  x2="11.5" y2="4.5"  stroke="white" strokeWidth="1.2" opacity="0.9"/>
        <line x1="6.5"  y1="7.5"  x2="9.5"  y2="7.5"  stroke="white" strokeWidth="1.2" opacity="0.9"/>
        <line x1="6.5"  y1="12.5" x2="9.5"  y2="12.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
        <line x1="4.5"  y1="15.5" x2="11.5" y2="15.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
      </svg>
    </motion.div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, index = 0, animate: doAnimate = false, numValue }: {
  label: string; value: string; sub?: string; accent?: string; index?: number; animate?: boolean; numValue?: number
}) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ y: -3, boxShadow: '0 8px 30px rgba(240,78,55,0.12)' }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 cursor-default"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`text-3xl font-black ${accent ?? 'text-gray-900'}`}>
        {doAnimate && numValue !== undefined
          ? <AnimatedNumber value={numValue} prefix={value.startsWith('$') ? '$' : ''} suffix={value.endsWith('%') ? '%' : ''} decimals={value.includes('.') ? 2 : 0} />
          : value}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </motion.div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}22`, color }}
    >{text}</motion.span>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <motion.div variants={slideRight} initial="hidden" animate="visible" className="flex items-center gap-3 mb-5">
      <motion.div
        className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-lg"
        whileHover={{ rotate: 15, scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >{icon}</motion.div>
      <div>
        <h2 className="font-bold text-gray-900 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </motion.div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', icon: '📊' },
  { id: 'router',   icon: '🔀' },
  { id: 'prompter', icon: '✍️' },
  { id: 'cache',    icon: '⚡' },
] as const
type TabId = typeof TABS[number]['id']

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('overview')
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

  const providerPie = breakdown
    ? Object.entries(breakdown.byProvider).map(([k, v]) => ({ name: k, value: +v.costUsd.toFixed(4) }))
    : []
  const modelBar = breakdown
    ? Object.entries(breakdown.byModel)
        .sort((a, b) => b[1].costUsd - a[1].costUsd).slice(0, 6)
        .map(([k, v]) => ({ name: k.replace('claude-','c-').replace('gemini-','g-').replace('gpt-',''), cost: +v.costUsd.toFixed(4), requests: v.requests }))
    : []
  const totalRequests = breakdown ? Object.values(breakdown.byModel).reduce((s, m) => s + m.requests, 0) : 0
  const cacheRate = totalRequests > 0 ? (breakdown!.cachedRequests / totalRequests * 100).toFixed(1) : '0'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm"
      >
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
              <motion.span
                className="w-2 h-2 rounded-full bg-green-400"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs text-gray-500 font-medium">{t('app.live')}</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map((tabItem) => (
            <motion.button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`relative px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                tab === tabItem.id ? 'text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              {tab === tabItem.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-orange-500 rounded-t-lg"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {tabItem.icon} {t(`nav.${tabItem.id}`)}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading && <DNASpinner />}

        <AnimatePresence mode="wait">
          {/* ── OVERVIEW ── */}
          {!loading && tab === 'overview' && (
            <motion.div key="overview" variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="space-y-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('overview.spend_14d')} value={fmtUsd(breakdown?.totalUsd ?? 0)} sub={t('overview.spend_14d_sub')} index={0} animate numValue={breakdown?.totalUsd} />
                <StatCard label={t('overview.monthly_est')} value={fmtUsd(projection?.monthly ?? 0)} sub={t('overview.monthly_est_sub')} index={1} animate numValue={projection?.monthly} />
                <StatCard label={t('overview.savings_opt')} value={fmtUsd(projection?.savingsIfOptimized ?? 0)} sub={t('overview.savings_opt_sub')} accent="text-green-600" index={2} animate numValue={projection?.savingsIfOptimized} />
                <StatCard label={t('overview.cache_hit_rate')} value={`${cacheRate}%`} sub={t('overview.cache_hit_sub', { count: breakdown?.cachedRequests ?? 0 })} accent="text-purple-600" index={3} />
              </div>

              {/* Spend chart */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)}/>
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toFixed(2)}`}/>
                    <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`}/>
                    <Area type="monotone" dataKey="costUsd" stroke="#f97316" fill="url(#costGrad)" strokeWidth={2} name="Cost"/>
                    <Area type="monotone" dataKey="savedUsd" stroke="#22c55e" fill="url(#saveGrad)" strokeWidth={2} name="Saved"/>
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Model + Provider */}
              <div className="grid md:grid-cols-2 gap-4">
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <SectionHeader icon="🤖" title={t('overview.cost_by_model')} subtitle={t('overview.cost_by_model_sub')} />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={modelBar} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`}/>
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80}/>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`}/>
                      <Bar dataKey="cost" fill="#f97316" radius={4} name="Cost USD"/>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <SectionHeader icon="🏢" title={t('overview.cost_by_provider')} />
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={providerPie} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {providerPie.map((entry) => (
                          <Cell key={entry.name} fill={PROVIDER_COLORS[entry.name] ?? '#6b7280'}/>
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`}/>
                    </PieChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* Optimization tips */}
              {projection && (
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <SectionHeader icon="💡" title={t('overview.opt_opportunities')} subtitle={t('overview.opt_opportunities_sub')} />
                  <div className="space-y-3">
                    {projection.optimizationOpportunities.map((op, i) => (
                      <motion.div
                        key={op.id}
                        variants={fadeUp} initial="hidden" animate="visible" custom={i}
                        whileHover={{ x: 4, backgroundColor: '#fafafa' }}
                        className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-gray-100 transition-colors"
                      >
                        <span className="text-2xl">{CATEGORY_ICON[op.category] ?? '💡'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{op.title}</span>
                            <Badge text={`-${op.estimatedSavingsPercent}%`} color="#16a34a"/>
                            <Badge text={op.effort} color={EFFORT_COLOR[op.effort]}/>
                            <Badge text={op.category} color="#6366f1"/>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{op.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── ROUTER ── */}
          {!loading && tab === 'router' && (
            <motion.div key="router" variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="space-y-6">
              <motion.div variants={fadeUp} initial="hidden" animate="visible"
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="🔀" title={t('router.title')} subtitle={t('router.subtitle')} />
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('router.your_prompt')}</label>
                    <motion.textarea
                      whileFocus={{ boxShadow: '0 0 0 3px rgba(249,115,22,0.2)' }}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 bg-white resize-none focus:outline-none transition-shadow"
                      rows={4} value={routePrompt}
                      onChange={e => setRoutePrompt(e.target.value)}
                      placeholder={t('router.prompt_placeholder')}
                    />
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-xs font-semibold text-gray-600">{t('router.priority')}:</span>
                    {(['cost', 'quality', 'speed'] as const).map(p => (
                      <motion.button key={p} onClick={() => setPriority(p)}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${priority === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {t(`router.priority_${p}`)}
                      </motion.button>
                    ))}
                    <motion.button onClick={handleRoute} disabled={routing || !routePrompt.trim()}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="ml-auto px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all">
                      {routing ? t('router.routing') : t('router.route_btn')}
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              <AnimatePresence>
                {routeResult && (
                  <motion.div key="result" variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <motion.div variants={slideRight} initial="hidden" animate="visible" className="flex items-center gap-3">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}
                        className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">✅</motion.div>
                      <div>
                        <p className="font-bold text-gray-900">{t('router.optimal_model')}: <span className="text-orange-600">{routeResult.selectedModel.id}</span></p>
                        <p className="text-xs text-gray-500">{routeResult.reason}</p>
                      </div>
                    </motion.div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: t('router.est_cost'), value: fmt(routeResult.estimatedCostUsd), accent: 'text-orange-600' },
                        { label: t('router.est_tokens'), value: String(routeResult.estimatedTokens), accent: 'text-gray-900' },
                        { label: t('router.quality_score'), value: `${routeResult.selectedModel.qualityScore}/100`, accent: 'text-green-600' },
                        { label: t('router.avg_latency'), value: `${routeResult.selectedModel.latencyMs}ms`, accent: 'text-blue-600' },
                      ].map((item, i) => (
                        <motion.div key={i} variants={scaleIn} custom={i} initial="hidden" animate="visible"
                          className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-xs text-gray-500">{item.label}</p>
                          <p className={`font-black ${item.accent}`}>{item.value}</p>
                        </motion.div>
                      ))}
                    </div>
                    {routeResult.alternativeModels.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">{t('router.alternatives').toUpperCase()}</p>
                        <div className="space-y-2">
                          {routeResult.alternativeModels.map((alt, i) => (
                            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" animate="visible"
                              className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
                              <span className="text-sm font-semibold text-gray-700">{alt.model.id}</span>
                              <span className="text-xs text-gray-500">{alt.tradeoff}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── PROMPTER ── */}
          {!loading && tab === 'prompter' && (
            <motion.div key="prompter" variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="space-y-6">
              <motion.div variants={fadeUp} initial="hidden" animate="visible"
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <SectionHeader icon="✍️" title={t('prompter.title')} subtitle={t('prompter.subtitle')} />
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('prompter.original_prompt')}</label>
                    <motion.textarea whileFocus={{ boxShadow: '0 0 0 3px rgba(249,115,22,0.2)' }}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 bg-white resize-none focus:outline-none"
                      rows={5} value={rawPrompt} onChange={e => setRawPrompt(e.target.value)}/>
                  </div>
                  <motion.button onClick={handleOptimize} disabled={optimizing || !rawPrompt.trim()}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                    {optimizing ? t('prompter.optimizing') : t('prompter.optimize_btn')}
                  </motion.button>
                </div>
              </motion.div>

              <AnimatePresence>
                {promptResult && (
                  <motion.div key="promptResult" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: t('prompter.original_tokens'), value: String(promptResult.originalTokens) },
                        { label: t('prompter.optimized_tokens'), value: String(promptResult.optimizedTokens), accent: 'text-green-600' },
                        { label: t('prompter.savings'), value: `${promptResult.savingsPercent.toFixed(1)}%`, accent: 'text-orange-600' },
                      ].map((s, i) => (
                        <StatCard key={i} label={s.label} value={s.value} accent={s.accent} index={i} />
                      ))}
                    </div>
                    <motion.div variants={fadeUp} initial="hidden" animate="visible"
                      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2">{t('prompter.optimized_prompt').toUpperCase()}</p>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                        className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap">
                        {promptResult.optimized}
                      </motion.div>
                    </motion.div>
                    {promptResult.techniques.length > 0 && (
                      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 mb-3">{t('prompter.techniques_applied').toUpperCase()}</p>
                        <div className="space-y-2">
                          {promptResult.techniques.map((tech, i) => (
                            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" animate="visible"
                              className="flex items-start justify-between bg-slate-50 rounded-xl px-4 py-2">
                              <div>
                                <span className="text-sm font-semibold text-gray-800">{tech.name}</span>
                                <p className="text-xs text-gray-500">{tech.description}</p>
                              </div>
                              {tech.tokensSaved > 0 && <Badge text={`-${tech.tokensSaved} tkns`} color="#16a34a"/>}
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── CACHE ── */}
          {!loading && tab === 'cache' && (
            <motion.div key="cache" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
              <CachePanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="border-t border-gray-100 bg-white mt-12">
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
      </motion.footer>
    </div>
  )
}

// ── Cache Panel ───────────────────────────────────────────────────────────────
function CachePanel() {
  const { t } = useI18n()
  const [data, setData] = useState<{ stats: { totalEntries: number; totalHits: number; hitRate: number; totalSavedUsd: number } | null; entries: unknown[] }>({ stats: null, entries: [] })
  useEffect(() => { fetch('/api/cache').then(r => r.json()).then(setData) }, [])
  const stats = data.stats
  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('cache.entries'), value: String(stats.totalEntries) },
            { label: t('cache.total_hits'), value: String(stats.totalHits), accent: 'text-green-600' },
            { label: t('cache.hit_rate'), value: `${(stats.hitRate * 100).toFixed(1)}%`, accent: 'text-purple-600' },
            { label: t('cache.usd_saved'), value: `$${stats.totalSavedUsd.toFixed(2)}`, accent: 'text-orange-600' },
          ].map((s, i) => (
            <StatCard key={i} label={s.label} value={s.value} accent={s.accent} index={i} />
          ))}
        </div>
      )}
      <motion.div variants={fadeUp} initial="hidden" animate="visible"
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <SectionHeader icon="⚡" title={t('cache.title')} subtitle={t('cache.subtitle')} />
        {data.entries.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 text-gray-400">
            <motion.p animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-4xl mb-3">🔍</motion.p>
            <p className="text-sm">{t('cache.empty_title')}</p>
            <p className="text-xs mt-1">{t('cache.empty_sub')}</p>
          </motion.div>
        ) : (
          <p className="text-sm text-gray-500">{t('cache.entries_available', { count: data.entries.length })}</p>
        )}
      </motion.div>
    </div>
  )
}
