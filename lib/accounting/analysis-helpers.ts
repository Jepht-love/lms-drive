import { periodRange, expenseFamily, getFamilyLabel, getCategoryLabel } from './categories'

export type Tx = { type: string; category: string; amount: number | null }

export function previousRange(period: string, now: Date): { from: string; to: string; label: string } {
  const d = new Date(now)
  if (period === 'year') {
    const y = d.getFullYear() - 1
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` }
  }
  if (period === 'quarter') {
    d.setMonth(d.getMonth() - 3)
    return periodRange('quarter', d)
  }
  d.setMonth(d.getMonth() - 1)
  return periodRange('month', d)
}

export function dateLabel(from: string, granularity: string): string {
  const d = new Date(from + 'T12:00:00')
  if (granularity === 'year') return `${d.getFullYear()}`
  if (granularity === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `T${q} ${d.getFullYear()}`
  }
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function aggregate(txs: Tx[]) {
  let revenue = 0, expenses = 0
  const byFamily = new Map<string, number>()
  const byPoste = new Map<string, number>()
  for (const t of txs) {
    if (t.type === 'recette') { revenue += t.amount ?? 0; continue }
    expenses += t.amount ?? 0
    const fid = expenseFamily(t.category)?.id ?? 'autres'
    byFamily.set(fid, (byFamily.get(fid) ?? 0) + (t.amount ?? 0))
    byPoste.set(t.category, (byPoste.get(t.category) ?? 0) + (t.amount ?? 0))
  }
  return { revenue, expenses, margin: revenue - expenses, byFamily, byPoste }
}

export function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null
  return Math.round(((cur - prev) / Math.abs(prev)) * 100)
}

export function buildAnalysisData(curTxs: Tx[], prevTxs: Tx[]) {
  const C = aggregate(curTxs)
  const P = aggregate(prevTxs)

  const families = [...C.byFamily.entries()]
    .map(([id, amount]) => ({ id, label: getFamilyLabel(id), amount, prev: P.byFamily.get(id) ?? 0 }))
    .sort((a, b) => b.amount - a.amount)

  const postes = [...C.byPoste.entries()]
    .map(([id, amount]) => ({ id, label: getCategoryLabel(id), amount, prev: P.byPoste.get(id) ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

  const famIds = new Set([...C.byFamily.keys(), ...P.byFamily.keys()])
  const deltas = [...famIds]
    .map(id => ({
      id,
      label: getFamilyLabel(id),
      cur: C.byFamily.get(id) ?? 0,
      prev: P.byFamily.get(id) ?? 0,
      delta: (C.byFamily.get(id) ?? 0) - (P.byFamily.get(id) ?? 0),
    }))
    .filter(d => d.delta !== 0)
    .sort((a, b) => b.delta - a.delta)

  const costDrivers = deltas.filter(d => d.delta > 0)
  const savings = deltas.filter(d => d.delta < 0).reverse()

  return { C, P, families, postes, deltas, costDrivers, savings }
}
