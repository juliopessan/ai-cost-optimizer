#!/usr/bin/env bash
# push.sh — push ai-cost-optimizer to GitHub
# Usage: bash push.sh <github-token>
#
# Example:
#   bash push.sh ghp_xxxxxxxxxxxx

set -e

TOKEN="${1:-}"
REPO="juliopessan/ai-cost-optimizer"

if [ -z "$TOKEN" ]; then
  echo "Usage: bash push.sh <github-token>"
  exit 1
fi

echo "→ Configuring remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${TOKEN}@github.com/${REPO}.git"

echo "→ Staging all files..."
git add -A

echo "→ Committing..."
git commit -m "feat: AI Cost Optimizer Framework v1.0.0

Modules:
- Model Router: 7-model catalog (Claude/GPT/Gemini), auto task detection, routing by cost/quality/speed
- Response Cache: exact hash + Jaccard semantic similarity (85% threshold), TTL eviction
- Cost Analyzer: 14-day analytics, monthly projections, optimization opportunity detection
- Adaptive Prompter: filler removal, verbose phrase compression, savings estimation

Stack: Next.js 14 · TypeScript · Tailwind · Recharts
Dashboard: 4-tab UI (Overview / Router / Prompter / Cache)
CI: GitHub Actions (typecheck + lint + build)" 2>/dev/null || echo "(nothing new to commit)"

echo "→ Pushing to main..."
git branch -M main
git push -u origin main --force

echo ""
echo "✅ Pushed! https://github.com/${REPO}"
