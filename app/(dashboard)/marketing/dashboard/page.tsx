import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { getChannelLabel, calcROI } from '@/lib/marketing/channels'
import MarketingCharts from './MarketingCharts'

export default async function MarketingDashboardPage() {
  const supabase = await createClient()

  const [
    { data: clients },
    { data: reservations },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from('clients').select('id, status, rating'),
    supabase
      .from('reservations')
      .select('start_datetime, status')
      .gte('start_datetime', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('campaigns').select('*').eq('status', 'terminee'),
  ])

  // D3 — KPIs globaux
  const activeClients  = clients?.length ?? 0
  const vipCount       = clients?.filter(c => c.status === 'vip').length ?? 0
  const ratings        = clients?.map(c => c.rating).filter((r): r is number => r != null) ?? []
  const avgRating      = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0

  // Taux fidélité : clients ayant ≥ 3 locations sur total
  const clientResCounts = new Map<string, number>()
  const allReservations = (await supabase.from('reservations').select('client_id').eq('status', 'terminee')).data ?? []
  allReservations.forEach(r => {
    clientResCounts.set(r.client_id, (clientResCounts.get(r.client_id) ?? 0) + 1)
  })
  const loyalCount  = [...clientResCounts.values()].filter(n => n >= 3).length
  const loyaltyRate = activeClients > 0 ? (loyalCount / activeClients) * 100 : 0

  // D1 — Réservations mensuelles (12 mois)
  const now = new Date()
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const start = d.toISOString()
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
    const count = reservations?.filter(r => r.start_datetime >= start && r.start_datetime < end).length ?? 0
    return { month: d.toLocaleDateString('fr-FR', { month: 'short' }), count }
  })

  // D2 — Performance par canal
  const channelMap = new Map<string, { budget: number; revenue: number; count: number }>()
  campaigns?.forEach(c => {
    if (!channelMap.has(c.channel)) channelMap.set(c.channel, { budget: 0, revenue: 0, count: 0 })
    const ch = channelMap.get(c.channel)!
    ch.budget  += c.budget
    ch.revenue += c.revenue_generated
    ch.count   += 1
  })
  const channelData = [...channelMap.entries()]
    .map(([channel, d]) => ({
      channel,
      label:  getChannelLabel(channel),
      budget: d.budget,
      revenue: d.revenue,
      roi:    calcROI(d.budget, d.revenue) ?? 0,
    }))
    .sort((a, b) => b.roi - a.roi)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/marketing" className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600">←</Link>
        <h1 className="text-xl font-black text-gray-900">Dashboard performances</h1>
      </div>

      {/* D3 — KPIs image de marque */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Clients actifs</p>
          <p className="text-[48px] font-black text-[#111111] leading-none">{activeClients}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Satisfaction moy.</p>
          <p className="text-[48px] font-black text-amber-500 leading-none">
            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
          </p>
          {avgRating > 0 && <p className="text-[12px] text-gray-400">/ 5 ⭐</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Taux fidélité</p>
          <p className="text-[48px] font-black text-green-600 leading-none">{loyaltyRate.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Clients VIP</p>
          <p className="text-[48px] font-black text-amber-500 leading-none">{vipCount}</p>
        </div>
      </div>

      {/* Charts — client component */}
      <MarketingCharts monthlyData={monthlyData} channelData={channelData} />

      {/* D2 — Tableau canaux */}
      {channelData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Performance par canal</p>
          <div className="space-y-3">
            {channelData.map(ch => (
              <div key={ch.channel} className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#111111]">{ch.label}</p>
                <div className="text-right">
                  <p className="text-[13px] font-black text-[#111111]">{formatPrice(ch.revenue)}</p>
                  <p className={`text-[11px] font-bold ${ch.roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    ROI {ch.roi > 0 ? '+' : ''}{ch.roi.toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
