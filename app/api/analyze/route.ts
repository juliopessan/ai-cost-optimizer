import { NextResponse } from 'next/server'
import { getAnalyzer } from '@/lib/cost-analyzer'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'breakdown'
  const analyzer = getAnalyzer()

  if (view === 'timeseries') return NextResponse.json(analyzer.getTimeSeries(14))
  if (view === 'projection') return NextResponse.json(analyzer.getProjection())
  if (view === 'records') return NextResponse.json(analyzer.getRecords(50))
  return NextResponse.json(analyzer.getBreakdown())
}
