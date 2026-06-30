import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Car } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { periodRange, expenseFamily, getFamilyLabel } from '@/lib/accounting/categories'

const PERIODS = [
  { id: 'month',   label: 'Ce mois' },
  { id: 'quarter', label: 'Ce trimestre' },
  { id: 'year',    label: 'Cette année' },
]

const RENTED_STATUSES = new Set(['en_cours', 'terminee', 'en_retard'])
// Interventions qui immobilisent le véhicule (atelier) — pour le taux d'immobilisation.
const GARAGE_TYPES = new Set(['revision', 'vidange', 'pneus', 'freins', 'reparation', 'carrosserie', 'controle_technique'])
// Pannes = réparations subies (hors entretien planifié).
const PANNE_TYPES = new Set(['reparation', 'carrosserie'])

const DAY = 86_400_000
function overlapDays(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart)
  const end = Math.min(aEnd, bEnd)
  return end <= start ? 0 : (end - start) / DAY
}

export default async function VehicleKpiPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period = 'month' } = await searchParams
  const granularity = period === 'year' ? 'year' : period === 'quarter' ? 'quarter' : 'month'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const { from, to, label } = periodRange(granularity)
  const fromMs = new Date(from).getTime()
  const toMs = new Date(`${to}T23:59:59`).getTime()
  const periodDays = Math.max(1, (toMs - fromMs) / DAY)
  const currentYear = new Date().getFullYear()

  const [{ data: vehiclesRaw }, { data: externalRows }, { data: reservations }, { data: txs }, { data: inspections }, { data: maintenance }] =
    await Promise.all([
      supabase.from('vehicles').select('id, plate, brand, model, year').eq('is_active', true).order('brand'),
      supabase.from('vehicles').select('id').eq('is_external', true),
      supabase.from('reservations').select('vehicle_id, start_datetime, end_datetime, status, total_price')
        .lte('start_datetime', new Date(toMs).toISOString()).gte('end_datetime', new Date(fromMs).toISOString()),
      supabase.from('financial_transactions').select('vehicle_id, type, category, amount').gte('date', from).lte('date', to).not('vehicle_id', 'is', null),
      supabase.from('inspections').select('vehicle_id, km_reading, created_at').gte('created_at', from).lte('created_at', `${to}T23:59:59`),
      supabase.from('maintenance_records').select('vehicle_id, type, date').gte('date', from).lte('date', to),
    ])

  const externalIds = new Set((externalRows ?? []).map(v => v.id))
  const vehicles = (vehiclesRaw ?? []).filter(v => !externalIds.has(v.id))

  // Indexation par véhicule
  type Km = { min: number; max: number }
  const caBy = new Map<string, number>()
  const rentedDaysBy = new Map<string, number>()
  const costBy = new Map<string, number>()
  const costByFamily = new Map<string, Map<string, number>>()
  const kmBy = new Map<string, Km>()
  const panneBy = new Map<string, number>()
  const immobBy = new Map<string, number>()

  for (const r of reservations ?? []) {
    if (!r.vehicle_id || !RENTED_STATUSES.has(r.status)) continue
    caBy.set(r.vehicle_id, (caBy.get(r.vehicle_id) ?? 0) + (r.total_price ?? 0))
    const d = overlapDays(new Date(r.start_datetime).getTime(), new Date(r.end_datetime).getTime(), fromMs, toMs)
    rentedDaysBy.set(r.vehicle_id, (rentedDaysBy.get(r.vehicle_id) ?? 0) + d)
  }
  for (const t of txs ?? []) {
    if (t.type !== 'depense' || !t.vehicle_id) continue
    costBy.set(t.vehicle_id, (costBy.get(t.vehicle_id) ?? 0) + (t.amount ?? 0))
    const fid = expenseFamily(t.category)?.id ?? 'autres'
    const fam = costByFamily.get(t.vehicle_id) ?? new Map<string, number>()
    fam.set(fid, (fam.get(fid) ?? 0) + (t.amount ?? 0))
    costByFamily.set(t.vehicle_id, fam)
  }
  for (const i of inspections ?? []) {
    if (!i.vehicle_id || i.km_reading == null) continue
    const k = kmBy.get(i.vehicle_id) ?? { min: i.km_reading, max: i.km_reading }
    k.min = Math.min(k.min, i.km_reading)
    k.max = Math.max(k.max, i.km_reading)
    kmBy.set(i.vehicle_id, k)
  }
  for (const m of maintenance ?? []) {
    if (!m.vehicle_id) continue
    if (PANNE_TYPES.has(m.type)) panneBy.set(m.vehicle_id, (panneBy.get(m.vehicle_id) ?? 0) + 1)
    if (GARAGE_TYPES.has(m.type)) immobBy.set(m.vehicle_id, (immobBy.get(m.vehicle_id) ?? 0) + 1)
  }

  const rows = vehicles.map(v => {
    const ca = caBy.get(v.id) ?? 0
    const cost = costBy.get(v.id) ?? 0
    const rentedDays = rentedDaysBy.get(v.id) ?? 0
    const km = kmBy.get(v.id)
    const kmDriven = km ? Math.max(0, km.max - km.min) : 0
    const immobDays = immobBy.get(v.id) ?? 0 // 1 intervention atelier ≈ 1 jour (estimation)
    return {
      vehicle: v,
      ca,
      cost,
      marge: ca - cost,
      tauxUtilisation: Math.min(100, Math.round((rentedDays / periodDays) * 100)),
      kmDriven,
      coutKm: kmDriven > 0 ? cost / kmDriven : null,
      pannes: panneBy.get(v.id) ?? 0,
      age: v.year ? currentYear - v.year : null,
      tauxImmobilisation: Math.min(100, Math.round((immobDays / periodDays) * 100)),
      immobDays,
      costFamilies: [...(costByFamily.get(v.id) ?? new Map()).entries()]
        .map(([fid, amount]) => ({ label: getFamilyLabel(fid), amount: amount as number }))
        .sort((a, b) => b.amount - a.amount),
    }
  }).sort((a, b) => b.marge - a.marge)

  // Moyenne / totaux parc
  const n = rows.length || 1
  const fleet = {
    ca: rows.reduce((s, r) => s + r.ca, 0),
    cost: rows.reduce((s, r) => s + r.cost, 0),
    marge: rows.reduce((s, r) => s + r.marge, 0),
    tauxUtilisation: Math.round(rows.reduce((s, r) => s + r.tauxUtilisation, 0) / n),
    pannes: rows.reduce((s, r) => s + r.pannes, 0),
    age: (() => {
      const ages = rows.map(r => r.age).filter((a): a is number => a != null)
      return ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null
    })(),
    tauxImmobilisation: Math.round(rows.reduce((s, r) => s + r.tauxImmobilisation, 0) / n),
    coutKm: (() => {
      const totalKm = rows.reduce((s, r) => s + r.kmDriven, 0)
      const totalCost = rows.reduce((s, r) => s + r.cost, 0)
      return totalKm > 0 ? totalCost / totalKm : null
    })(),
  }

  const periodPill = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
    }`

  const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
    <div>
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm font-black ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <div>
        <h1 className="text-xl font-black text-gray-900">KPI par véhicule</h1>
        <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {PERIODS.map(p => (
          <Link key={p.id} href={`/accounting/kpi?period=${p.id}`} className={periodPill(period === p.id)}>{p.label}</Link>
        ))}
      </div>

      {/* ── Moyenne / totaux du parc ─────────────────────────────────────────── */}
      <section className="bg-[#111111] rounded-2xl p-4 text-white">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3">Moyenne du parc · {rows.length} véhicules</p>
        <div className="grid grid-cols-3 gap-y-3 gap-x-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">CA total</p>
            <p className="text-sm font-black text-green-400">{formatPrice(fleet.ca)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Coûts</p>
            <p className="text-sm font-black text-red-400">{formatPrice(fleet.cost)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Marge</p>
            <p className={`text-sm font-black ${fleet.marge >= 0 ? 'text-white' : 'text-red-400'}`}>{formatPrice(fleet.marge)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Taux d'utilisation</p>
            <p className="text-sm font-black text-white">{fleet.tauxUtilisation}%</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Coût / km</p>
            <p className="text-sm font-black text-white">{fleet.coutKm != null ? `${fleet.coutKm.toFixed(2)} €` : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Pannes</p>
            <p className="text-sm font-black text-white">{fleet.pannes}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Âge moyen</p>
            <p className="text-sm font-black text-white">{fleet.age != null ? `${fleet.age} ans` : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-white/40">Taux immob.</p>
            <p className="text-sm font-black text-white">{fleet.tauxImmobilisation}%</p>
          </div>
        </div>
      </section>

      {/* ── Détail par véhicule ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.vehicle.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Car className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 truncate">{r.vehicle.brand} {r.vehicle.model}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{r.vehicle.plate}{r.age != null ? ` · ${r.age} ans` : ''}</p>
                </div>
              </div>
              <span className={`text-sm font-black flex-shrink-0 ${r.marge >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {r.marge >= 0 ? '+' : ''}{formatPrice(r.marge)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-y-2.5 gap-x-2 pb-3 border-b border-gray-50">
              <Stat label="CA" value={formatPrice(r.ca)} accent="text-green-600" />
              <Stat label="Coûts" value={formatPrice(r.cost)} accent="text-red-500" />
              <Stat label="Utilisation" value={`${r.tauxUtilisation}%`} />
              <Stat label="Coût / km" value={r.coutKm != null ? `${r.coutKm.toFixed(2)} €` : '—'} />
              <Stat label="Pannes" value={`${r.pannes}`} />
              <Stat label="Immob. (est.)" value={`${r.immobDays} j`} />
            </div>

            {/* Coûts détaillés par poste */}
            {r.costFamilies.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Coûts par poste</p>
                {r.costFamilies.map(f => (
                  <div key={f.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 truncate">{f.label}</span>
                    <span className="text-xs font-bold text-gray-900 flex-shrink-0">{formatPrice(f.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-300 mt-3">Aucun coût enregistré sur la période</p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 px-1">
        « Immob. (est.) » : estimation d'après les interventions atelier (1 intervention ≈ 1 jour).
        Le coût/km se base sur les relevés kilométriques des états des lieux.
      </p>
    </div>
  )
}
