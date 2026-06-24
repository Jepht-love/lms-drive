import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

function AgeBar({ range, count, total }: { range: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-[12px] text-gray-500 w-12 flex-shrink-0">{range}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 bg-[#111111] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-medium text-[#111111] w-8 text-right flex-shrink-0">{count}</span>
    </div>
  )
}

function MonthBar({ month, count, max }: { month: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[10px] text-gray-400 w-8 flex-shrink-0">{month}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="h-1.5 bg-[#C4A35A] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-medium text-gray-600 w-4 text-right flex-shrink-0">{count}</span>
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const [
    { data: clients },
    { data: reservations },
    { data: topClients },
  ] = await Promise.all([
    supabase.from('clients').select('id, birth_date, status, rating, acquisition_channel, city'),
    supabase
      .from('reservations')
      .select('vehicle_id, client_id, start_datetime, end_datetime, total_price, vehicles(plate, brand, model)')
      .eq('status', 'terminee'),
    supabase
      .from('clients')
      .select('id, first_name, last_name, rating, status')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // C1 — Tranches d'âge
  const ageGroups: Record<string, number> = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '55+': 0 }
  clients?.forEach(c => {
    if (!c.birth_date) return
    const age = Math.floor((Date.now() - new Date(c.birth_date).getTime()) / (365.25 * 86400000))
    if (age < 26) ageGroups['18-25']++
    else if (age < 36) ageGroups['26-35']++
    else if (age < 46) ageGroups['36-45']++
    else if (age < 56) ageGroups['46-55']++
    else ageGroups['55+']++
  })
  const totalWithAge = Object.values(ageGroups).reduce((s, n) => s + n, 0)

  // C2 — Véhicules les plus demandés
  const vehicleCounts = new Map<string, { label: string; count: number }>()
  reservations?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    if (!v || !r.vehicle_id) return
    const key = r.vehicle_id
    if (!vehicleCounts.has(key)) {
      vehicleCounts.set(key, { label: `${v.brand} ${v.model} · ${v.plate}`, count: 0 })
    }
    vehicleCounts.get(key)!.count++
  })
  const topVehicles = [...vehicleCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5)

  // C3 — Activité mensuelle (12 derniers mois)
  const now = new Date()
  const monthLabels: string[] = []
  const monthCounts: number[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthLabels.push(d.toLocaleDateString('fr-FR', { month: 'short' }))
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
    const count = reservations?.filter(r => r.start_datetime >= start && r.start_datetime < end).length ?? 0
    monthCounts.push(count)
  }
  const maxMonthCount = Math.max(...monthCounts, 1)

  // C4 — Canaux d'acquisition
  const channelCounts = new Map<string, number>()
  clients?.forEach(c => {
    if (!c.acquisition_channel) return
    channelCounts.set(c.acquisition_channel, (channelCounts.get(c.acquisition_channel) ?? 0) + 1)
  })
  const topChannels = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  // C5 — Clients fidèles (≥ 3 resas)
  const clientResCounts = new Map<string, number>()
  reservations?.forEach(r => {
    clientResCounts.set(r.client_id, (clientResCounts.get(r.client_id) ?? 0) + 1)
  })
  const loyalClientIds = new Set([...clientResCounts.entries()].filter(([, n]) => n >= 3).map(([id]) => id))
  const loyalClients = topClients
    ?.filter(c => loyalClientIds.has(c.id))
    .map(c => ({ ...c, reservations: clientResCounts.get(c.id) ?? 0 }))
    .sort((a, b) => b.reservations - a.reservations)
    .slice(0, 10) ?? []

  // C6 — Segmentation par niveau de fidélité
  const tierConfig = [
    { key: 'platinum', label: 'Platinum', emoji: '💎', min: 11, color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'gold',     label: 'Gold',     emoji: '🥇', min: 6,  max: 10, color: '#b45309', bg: '#fef9c3' },
    { key: 'silver',   label: 'Silver',   emoji: '🥈', min: 3,  max: 5,  color: '#374151', bg: '#f3f4f6' },
    { key: 'bronze',   label: 'Bronze',   emoji: '🥉', min: 1,  max: 2,  color: '#92400e', bg: '#fef3c7' },
  ]
  const allCounts = [...clientResCounts.values()]
  const tierCounts = tierConfig.map(t => ({
    ...t,
    count: allCounts.filter(n => n >= t.min && (t.max == null || n <= t.max)).length,
  }))
  const totalScored = tierCounts.reduce((s, t) => s + t.count, 0)

  // C7 — Secteurs géographiques les plus rentables (clients.city existait déjà
  // en base mais n'était interrogé nulle part dans le profil clientèle)
  const cityByClient = new Map((clients ?? []).map(c => [c.id, c.city]))
  const cityRevenue = new Map<string, { count: number; revenue: number }>()
  reservations?.forEach(r => {
    const city = cityByClient.get(r.client_id)
    if (!city) return
    const e = cityRevenue.get(city) ?? { count: 0, revenue: 0 }
    e.count++; e.revenue += r.total_price ?? 0
    cityRevenue.set(city, e)
  })
  const topCities = [...cityRevenue.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5)

  // C8 — Habitudes de consommation : durée moyenne de location, fréquence par client
  const durations = (reservations ?? []).map(r =>
    Math.max(1, Math.round((new Date(r.end_datetime).getTime() - new Date(r.start_datetime).getTime()) / 86400000)),
  )
  const avgDuration = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0
  const clientsWithRental = clientResCounts.size
  const avgRentalsPerClient = clientsWithRental > 0
    ? [...clientResCounts.values()].reduce((s, n) => s + n, 0) / clientsWithRental
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/marketing" className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600">←</Link>
        <h1 className="text-xl font-black text-gray-900">Profil clientèle</h1>
      </div>

      {/* C1 — Tranches d'âge */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Tranches d'âge</p>
        {totalWithAge === 0 ? (
          <p className="text-[13px] text-gray-400">Dates de naissance non renseignées</p>
        ) : (
          Object.entries(ageGroups).map(([range, count]) => (
            <AgeBar key={range} range={range} count={count} total={totalWithAge} />
          ))
        )}
      </div>

      {/* C2 — Véhicules les plus demandés */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Top véhicules demandés</p>
        {topVehicles.length === 0 ? (
          <p className="text-[13px] text-gray-400">Aucune location terminée</p>
        ) : (
          <div className="space-y-2">
            {topVehicles.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[13px] font-black text-gray-300 w-6 flex-shrink-0">{i + 1}</span>
                <p className="flex-1 text-[13px] font-medium text-[#111111] truncate">{v.label}</p>
                <span className="text-[13px] font-black text-[#111111]">{v.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* C3 — Activité mensuelle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Activité mensuelle (12 mois)</p>
        {monthLabels.map((m, i) => (
          <MonthBar key={m} month={m} count={monthCounts[i]} max={maxMonthCount} />
        ))}
      </div>

      {/* C4 — Canaux d'acquisition */}
      {topChannels.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Canaux d'acquisition</p>
          <div className="space-y-2">
            {topChannels.map(([channel, count]) => (
              <div key={channel} className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#111111] capitalize">{channel}</span>
                <span className="text-[13px] font-black text-[#111111]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C5 — Clients fidèles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Clients fidèles (≥ 3 locations)</p>
        {loyalClients.length === 0 ? (
          <p className="text-[13px] text-gray-400">Aucun client avec 3+ locations</p>
        ) : (
          <div className="space-y-2">
            {loyalClients.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-[13px] font-black text-gray-300 w-6 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#111111]">
                    {c.first_name} {c.last_name}
                    {c.status === 'vip' && <span className="ml-1 text-[10px] text-amber-500 font-bold">VIP</span>}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-black text-[#111111]">{c.reservations} loc.</p>
                  {c.rating && <p className="text-[11px] text-amber-500">{c.rating}/5 ⭐</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* C6 — Segmentation niveaux fidélité */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Niveaux de fidélité</p>
        <p className="text-[11px] text-gray-400 mb-4">Basé sur le nombre de locations par client</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {tierCounts.map(t => (
            <div key={t.key} className="rounded-xl p-3" style={{ backgroundColor: t.bg }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{t.emoji}</span>
                <span className="text-[12px] font-bold" style={{ color: t.color }}>{t.label}</span>
              </div>
              <p className="text-[22px] font-black" style={{ color: t.color }}>{t.count}</p>
              <p className="text-[10px] mt-0.5" style={{ color: t.color, opacity: 0.7 }}>
                {t.key === 'platinum' ? '11+ locations' :
                 t.key === 'gold' ? '6-10 locations' :
                 t.key === 'silver' ? '3-5 locations' : '1-2 locations'}
              </p>
            </div>
          ))}
        </div>
        {totalScored > 0 && (
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {tierCounts.map(t => t.count > 0 && (
              <div
                key={t.key}
                style={{ flex: t.count / totalScored, backgroundColor: t.color, minWidth: 4 }}
              />
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-2">{totalScored} clients avec au moins 1 location</p>
      </div>

      {/* C7 — Secteurs géographiques les plus rentables */}
      {topCities.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Secteurs géographiques rentables</p>
          <div className="space-y-2">
            {topCities.map(([city, e], i) => (
              <div key={city} className="flex items-center gap-3">
                <span className="text-[13px] font-black text-gray-300 w-6 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#111111] truncate">{city}</p>
                  <p className="text-[11px] text-gray-400">{e.count} location{e.count > 1 ? 's' : ''}</p>
                </div>
                <span className="text-[13px] font-black text-[#111111] flex-shrink-0">{formatPrice(e.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C8 — Habitudes de consommation */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Habitudes de consommation</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[20px] font-black text-[#111111]">{avgDuration.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">jour{avgDuration >= 2 ? 's' : ''} / location en moyenne</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[20px] font-black text-[#111111]">{avgRentalsPerClient.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">location{avgRentalsPerClient >= 2 ? 's' : ''} / client en moyenne</p>
          </div>
        </div>
      </div>
    </div>
  )
}
