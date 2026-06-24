import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { getCategoryLabel } from '@/lib/accounting/categories'
import AccountingCharts from './AccountingCharts'

const M = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default async function ChartsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const year = new Date().getFullYear()
  const { data: txs } = await supabase
    .from('financial_transactions')
    .select('date, type, category, amount, vehicle_id, vehicles(brand, model)')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)

  const all = txs ?? []

  const monthly = M.map(m => ({ month: m, revenue: 0, expenses: 0 }))
  for (const t of all) {
    const mi = new Date(t.date).getMonth()
    if (t.type === 'recette') monthly[mi].revenue += t.amount ?? 0
    else monthly[mi].expenses += t.amount ?? 0
  }

  const catMap = new Map<string, number>()
  for (const t of all) if (t.type === 'depense') catMap.set(t.category, (catMap.get(t.category) ?? 0) + (t.amount ?? 0))
  const expensesByCategory = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, amount]) => ({ label: getCategoryLabel(id), amount }))

  const vehMap = new Map<string, { name: string; revenue: number; expenses: number }>()
  for (const t of all) {
    if (!t.vehicle_id) continue
    const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles
    const e = vehMap.get(t.vehicle_id) ?? { name: v ? `${v.brand} ${v.model}` : '—', revenue: 0, expenses: 0 }
    if (t.type === 'recette') e.revenue += t.amount ?? 0
    else e.expenses += t.amount ?? 0
    vehMap.set(t.vehicle_id, e)
  }
  const vehicleData = [...vehMap.values()]

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <div>
        <h1 className="text-xl font-black text-gray-900">Graphiques</h1>
        <p className="text-sm text-gray-400 mt-0.5">Année {year}</p>
      </div>

      <AccountingCharts monthly={monthly} expensesByCategory={expensesByCategory} vehicleData={vehicleData} />
    </div>
  )
}
