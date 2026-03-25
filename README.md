# AI Cost Optimizer Framework

> Reduce LLM costs by up to 70% with intelligent model routing, semantic caching, adaptive prompting, and real-time cost analytics.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/juliopessan/ai-cost-optimizer)

---

## The Problem

Companies are burning millions on LLMs — using `gpt-4o` to answer "what's 2+2?" and re-calling models for identical prompts. This framework fixes that.

## The Solution

```
┌─────────────────────────────────────────────────┐
│              AI Cost Optimizer                  │
│                                                 │
│  Request → [Cache Check] → [Model Router]       │
│                ↓                  ↓             │
│          [Cache Hit!]    [Adaptive Prompter]    │
│          Save $0.003     Compress 15-20%        │
│                                 ↓               │
│                     [Optimal Model API Call]    │
│                                 ↓               │
│                     [Cost Analyzer + Dashboard] │
└─────────────────────────────────────────────────┘
```

## Modules

### 🔀 Model Router (`lib/model-router.ts`)
Routes each request to the **cheapest capable model**:
- Catalog of 7 models: Claude Haiku/Sonnet/Opus, GPT-4o/Mini, Gemini Flash/Pro
- Auto-detects task type from prompt content
- Optimize by **cost**, **quality**, or **speed**
- Returns cost estimate + alternatives with tradeoffs

### ⚡ Response Cache (`lib/response-cache.ts`)
Avoids redundant LLM calls with two-tier matching:
- **Exact match**: hash-based O(1) lookup
- **Semantic match**: Jaccard similarity (configurable threshold, default 85%)
- TTL-based eviction, hit rate tracking, USD savings accounting

### 📊 Cost Analyzer (`lib/cost-analyzer.ts`)
Full spend intelligence:
- Per-model, per-provider, per-task-type breakdown
- 14-day time series + monthly/annual projections
- Auto-detects optimization opportunities with estimated savings %

### ✍️ Adaptive Prompter (`lib/adaptive-prompter.ts`)
Compresses prompts to reduce token usage:
- Removes filler phrases ("please kindly help me to...")
- Replaces verbose patterns ("in order to" → "to")
- Estimates monthly savings at scale
- System prompt compression + deduplication

## Dashboard

Live dashboard with 4 tabs:
- **Overview**: KPIs, spend chart, model breakdown, optimization tips
- **Router**: Interactive model routing with priority selection
- **Prompter**: Real-time prompt optimization with technique breakdown
- **Cache**: Cache stats and entry explorer

## Getting Started

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deploy

```bash
npx vercel --prod
```

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — utility-first styling
- **Recharts** — cost analytics charts
- No database required — runs in-memory with demo data seeded on startup

## Cost Savings Potential

| Technique | Est. Savings |
|-----------|-------------|
| Model routing (Opus → Haiku for simple tasks) | 30-50% |
| Response caching (>30% hit rate) | 20-30% |
| Prompt compression | 10-15% |
| Async batch routing | 15-25% |
| **Combined** | **50-70%** |

---

Built by [Julio Pessan](https://github.com/juliopessan) · FCamara AI Practice
