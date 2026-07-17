import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import DueDatesClient from './DueDatesClient'
import DueDatesChart from './DueDatesChart'
import VehicleDueSummary, { type VehicleSchedule } from './VehicleDueSummary'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default async function DueDatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const [{ data: allDue }, { data: vehicles }] = await Promise.all([
    supabase
      .from('financial_due_dates')
      .select('*, vehicles(plate)')
      .order('due_date', { ascending: true }),
    supabase.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand'),
  ])

  // Suppression logique : deleted_at != null = en corbeille. Filtre en mémoire
  // (tolérant : si la colonne n'existe pas, deleted_at est undefined → tout est
  // « actif », comportement inchangé).
  const dueDates = (allDue ?? []).filter((d: any) => !d.deleted_at)
  const deletedDueDates = (allDue ?? [])
    .filter((d: any) => !!d.deleted_at)
    .sort((a: any, b: any) => String(b.deleted_at).localeCompare(String(a.deleted_at)))
    .slice(0, 50)

  // Prévisionnel mensuel — uniquement les échéances pas encore réglées,
  // groupées par mois (potentiellement plusieurs années pour un loyer sur 36
  // mois) pour visualiser la charge à venir mois par mois.
  const unpaid = (dueDates ?? []).filter(d => !d.is_paid)
  const byMonth = new Map<string, { label: string; revenue: number; expenses: number }>()
  for (const d of unpaid) {
    const dt = new Date(d.due_date)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
    const e = byMonth.get(key) ?? { label, revenue: 0, expenses: 0 }
    if (d.type === 'recette') e.revenue += d.amount ?? 0
    else e.expenses += d.amount ?? 0
    byMonth.set(key, e)
  }
  const monthlyForecast = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)

  // Échéancier par véhicule : pour chaque voiture liée à des échéances de charge
  // (loyers/mensualités), total / déjà payé / reste / prochaine échéance.
  const vehicleById = new Map((vehicles ?? []).map(v => [v.id, v]))
  type Acc = { total: number; paid: number; nbTotal: number; nbPaid: number; nextDue: string | null }
  const byVehicle = new Map<string, Acc>()
  for (const d of (dueDates ?? []) as Array<{ type: string; vehicle_id: string | null; amount: number | null; is_paid: boolean; due_date: string }>) {
    if (d.type !== 'depense' || !d.vehicle_id) continue
    const g = byVehicle.get(d.vehicle_id) ?? { total: 0, paid: 0, nbTotal: 0, nbPaid: 0, nextDue: null }
    g.total += d.amount ?? 0
    g.nbTotal += 1
    if (d.is_paid) { g.paid += d.amount ?? 0; g.nbPaid += 1 }
    else if (!g.nextDue || d.due_date < g.nextDue) g.nextDue = d.due_date
    byVehicle.set(d.vehicle_id, g)
  }
  const vehicleSchedules: VehicleSchedule[] = [...byVehicle.entries()]
    .map(([vehicleId, g]) => ({ vehicle: vehicleById.get(vehicleId)!, ...g, remaining: g.total - g.paid }))
    .filter(s => s.vehicle)
    .sort((a, b) => b.remaining - a.remaining)

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Échéances à venir</h1>
      <VehicleDueSummary schedules={vehicleSchedules} />
      <DueDatesChart monthlyForecast={monthlyForecast} />
      <DueDatesClient dueDates={dueDates ?? []} deletedDueDates={deletedDueDates ?? []} vehicles={vehicles ?? []} />
    </div>
  )
}
