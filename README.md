# 🧠 AI Cost Optimizer Framework

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8?style=for-the-badge&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Reduce LLM costs by up to 70% with intelligent model routing, semantic caching, adaptive prompting, and real-time cost analytics.**

</div>

---

## 🎯 The Problem

Companies are burning millions on LLMs:
- Using `claude-opus` to answer "what's 2+2?"
- Re-calling models for identical or near-identical prompts
- Sending bloated prompts with filler text that wastes tokens
- Zero visibility into spend by model, provider, or task type

## 💡 The Solution

```
Incoming Request
      │
      ▼
┌─────────────────┐
│  Cache Check    │ ──── HIT ────► Return cached response (saves 100%)
│ (exact + fuzzy) │
└────────┬────────┘
         │ MISS
         ▼
┌─────────────────┐
│  Model Router   │ ── Routes to cheapest capable model (saves 30–50%)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Adaptive        │ ── Compresses prompt before sending (saves 10–20%)
│ Prompter        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM API Call   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cost Analyzer  │ ── Records spend, detects patterns, projects costs
└─────────────────┘
```

## 📊 Savings Potential

| Technique | Estimated Savings |
|-----------|:-----------------:|
| Model routing (Opus → Haiku for simple tasks) | 30–50% |
| Response caching (>30% hit rate) | 20–30% |
| Prompt compression | 10–20% |
| Async batch routing | 15–25% |
| **Combined** | **50–70%** |

---

## 🏗️ Modules

### 🔀 Model Router (`lib/model-router.ts`)

Routes each request to the cheapest capable model for the task.

**Supported models:**

| Model | Provider | Input $/1K | Output $/1K | Quality |
|-------|----------|-----------|------------|---------|
| `gemini-flash-1-5` | Google | $0.000075 | $0.0003 | 74/100 |
| `gpt-4o-mini` | OpenAI | $0.00015 | $0.0006 | 70/100 |
| `claude-haiku-3` | Anthropic | $0.00025 | $0.00125 | 72/100 |
| `gemini-pro-1-5` | Google | $0.00125 | $0.005 | 88/100 |
| `claude-sonnet-3-5` | Anthropic | $0.003 | $0.015 | 92/100 |
| `gpt-4o` | OpenAI | $0.005 | $0.015 | 91/100 |
| `claude-opus-3` | Anthropic | $0.015 | $0.075 | 98/100 |

**Auto-detected task types:** `simple-qa` · `summarization` · `classification` · `code-generation` · `reasoning` · `long-context` · `creative-writing` · `data-extraction` · `math`

```typescript
import { routeRequest } from '@/lib/model-router'

const decision = routeRequest({
  prompt: "Summarize this report...",
  prioritize: "cost",       // 'cost' | 'quality' | 'speed'
  maxBudgetUsd: 0.01,
})

console.log(decision.selectedModel.id)    // 'claude-haiku-3'
console.log(decision.estimatedCostUsd)    // 0.000312
```

---

### ⚡ Response Cache (`lib/response-cache.ts`)

Two-tier caching to avoid redundant LLM calls.

- **Tier 1 — Exact match:** Hash-based O(1) lookup
- **Tier 2 — Semantic match:** Jaccard similarity (configurable threshold, default 85%)
- TTL-based eviction (default: 24h)

```typescript
import { getCache } from '@/lib/response-cache'

const cache = getCache()
const result = cache.get(userPrompt)

if (result.hit) return result.entry.response  // saved $!

cache.set(userPrompt, llmResponse, {
  modelId: 'claude-haiku-3',
  costUsd: 0.000312,
  tokens: 450,
})
```

---

### 📊 Cost Analyzer (`lib/cost-analyzer.ts`)

Full spend intelligence with projections and optimization tips.

```typescript
import { getAnalyzer } from '@/lib/cost-analyzer'

const analyzer = getAnalyzer()
const projection = analyzer.getProjection()

console.log(projection.monthly)                      // $127.40
console.log(projection.savingsIfOptimized)           // $89.18
console.log(projection.optimizationOpportunities)    // [{...}]
```

---

### ✍️ Adaptive Prompter (`lib/adaptive-prompter.ts`)

Compresses prompts to reduce input token usage.

**Techniques:** filler removal · verbose phrase compression · whitespace normalization · system prompt deduplication

```typescript
import { optimizePrompt } from '@/lib/adaptive-prompter'

const result = optimizePrompt(
  "I would like you to please kindly help me to summarize..."
)

console.log(result.savingsPercent)  // 31.4%
console.log(result.optimized)       // "Summarize..."
```

---

## 🖥️ Dashboard

Live 4-tab dashboard:

| Tab | Features |
|-----|----------|
| **📊 Overview** | KPI cards, 14-day spend chart, model/provider breakdown, optimization tips |
| **🔀 Router** | Interactive routing with priority selection and cost estimates |
| **✍️ Prompter** | Real-time prompt optimization with technique breakdown |
| **⚡ Cache** | Cache stats, hit rate, entries explorer |

---

## 🚀 Getting Started

```bash
git clone https://github.com/juliopessan/ai-cost-optimizer.git
cd ai-cost-optimizer
npm install
npm run dev
# → http://localhost:3000
```

### Deploy to Vercel

```bash
npx vercel --prod
```

---

## 🔌 REST API

### `POST /api/route`
```json
{ "prompt": "...", "prioritize": "cost", "maxBudgetUsd": 0.01 }
```

### `GET /api/analyze`
```
GET /api/analyze                        → breakdown by model/provider/task
GET /api/analyze?view=timeseries        → 14-day daily cost chart data
GET /api/analyze?view=projection        → projections + optimization tips
```

### `POST /api/cache`
```json
{ "prompt": "I would like you to please kindly..." }
// → { optimized, savingsPercent, techniques }
```

---

## 🗂️ Project Structure

```
ai-cost-optimizer/
├── app/
│   ├── page.tsx                    # Dashboard (4 tabs)
│   └── api/
│       ├── route/route.ts          # Model routing endpoint
│       ├── analyze/route.ts        # Cost analytics endpoint
│       └── cache/route.ts          # Cache + prompt optimizer
├── lib/
│   ├── model-router.ts             # Model catalog + routing logic
│   ├── response-cache.ts           # Two-tier semantic cache
│   ├── cost-analyzer.ts            # Spend tracking + projections
│   └── adaptive-prompter.ts       # Prompt compression engine
└── vercel.json
```

---

## 🤝 Contributing

PRs welcome! Areas to extend:

- [ ] More models (Mistral, Llama, Cohere, DeepSeek)
- [ ] Redis-backed persistent cache
- [ ] Spend alert webhooks
- [ ] CSV/PDF cost report export
- [ ] OpenTelemetry integration

---

## 📄 License

MIT © [Julio Pessan](https://github.com/juliopessan) · Built at [FCamara](https://fcamara.com) AI Practice

<div align="center">
  <sub>If this saves you money, consider giving it a ⭐</sub>
</div>

---

## 🎨 UI & Animations

### DNA Favicon
SVG favicon with double-helix DNA motif in FCamara orange (`#FF6B35 → #F04E37` gradient). Served as `public/favicon.svg` — no rasterization needed, scales perfectly at any resolution.

### Framer Motion Animations

| Element | Animation |
|---------|-----------|
| Header | Slides down on mount (`y: -60 → 0`) |
| Active tab indicator | Spring-physics `layoutId` shared layout |
| KPI stat cards | Staggered scale-in with `0.06s` delay per card |
| Dashboard sections | `fadeUp` with custom easing on entry |
| Tab content | `AnimatePresence` cross-fade between tabs |
| Optimization tip rows | `whileHover` slide-right + background tint |
| Router result | Scale-in reveal on data arrival |
| Buttons | `whileHover` scale + `whileTap` press feedback |
| Textarea | `whileFocus` orange glow ring |
| DNA Logo | `whileHover` rotate + scale spring |
| Loading spinner | Concentric rotating rings + pulsing DNA emoji |
| Live indicator dot | Continuous scale pulse |
| Animated numbers | Counter from 0 to value on mount |
| Cache empty state | Looping wobble on search icon |
| Footer | Delayed fade-in after content loads |

### Components

```
DNALogo        — SVG helix inside orange gradient circle, spring hover
DNASpinner     — 4 concentric rotating rings + 🧬 pulse (loading state)
AnimatedNumber — Smooth counter animation from 0 → value on mount
StatCard       — Scale-in with stagger + lift-shadow on hover
Badge          — Scale-in pop on render
SectionHeader  — Slide-right entry with icon spring-hover
LocaleSwitcher — 🇧🇷 PT / 🇺🇸 EN toggle with active state
```
