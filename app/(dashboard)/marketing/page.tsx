import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { getChannelLabel, CAMPAIGN_STATUSES, calcROI } from '@/lib/marketing/channels'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'

type Tab = 'toutes' | 'en_cours' | 'planifiee' | 'terminee'

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await searchParams
  const tab: Tab = (['toutes', 'en_cours', 'planifiee', 'terminee'].includes(rawTab ?? '') ? rawTab : 'toutes') as Tab

  const supabase = await createClient()
  let query = supabase.from('campaigns').select('*').order('start_date', { ascending: false })
  if (tab !== 'toutes') query = query.eq('status', tab)
  const { data: campaigns } = await query

  const tabStyle = (active: boolean) =>
    `flex-shrink-0 text-[12px] font-medium px-4 py-2 rounded-2xl transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-200 text-gray-600'
    }`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">Marketing</h1>
        <div className="flex gap-2">
          <Link href="/marketing/analytics" className="px-3 py-2.5 bg-white border border-gray-100 shadow-sm text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
            Profil clients
          </Link>
          <Link href="/marketing/dashboard" className="px-3 py-2.5 bg-white border border-gray-100 shadow-sm text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
            Dashboard
          </Link>
          <Link href="/marketing/new" className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm active:scale-[.97]">
            <Plus className="w-4 h-4" /> Campagne
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {([
          { id: 'toutes',   label: 'Toutes' },
          { id: 'en_cours', label: 'En cours' },
          { id: 'planifiee',label: 'Planifiées' },
          { id: 'terminee', label: 'Terminées' },
        ] as const).map(t => (
          <Link key={t.id} href={`/marketing?tab=${t.id}`} className={tabStyle(tab === t.id)}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* Liste */}
      {!campaigns?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📣</span>
          </div>
          <p className="text-[14px] font-medium text-gray-500 mb-1">Aucune campagne</p>
          <p className="text-[12px] text-gray-400">Créez votre première campagne marketing.</p>
        </div>
      ) : (
        <AnimatedList className="space-y-3">
          {campaigns.map(c => {
            const st  = CAMPAIGN_STATUSES[c.status as keyof typeof CAMPAIGN_STATUSES] ?? CAMPAIGN_STATUSES.planifiee
            const roi = calcROI(c.budget, c.revenue_generated)
            return (
              <AnimatedListItem key={c.id}>
              <Link href={`/marketing/${c.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {getChannelLabel(c.channel)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.style}`}>
                        {st.label}
                      </span>
                    </div>
                    <span className="text-[12px] text-gray-400 flex-shrink-0">
                      {formatDate(c.start_date)}{c.end_date ? ` → ${formatDate(c.end_date)}` : ''}
                    </span>
                  </div>

                  <p className="text-[15px] font-bold text-[#111111] mb-1">{c.name}</p>
                  {c.objective && <p className="text-[12px] text-gray-400 mb-3">{c.objective}</p>}

                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Budget</p>
                      <p className="text-[13px] font-black text-[#111111]">{formatPrice(c.budget)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Prospects</p>
                      <p className="text-[13px] font-black text-[#111111]">{c.prospects_count}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Réservations</p>
                      <p className="text-[13px] font-black text-[#111111]">{c.reservations_count}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">ROI</p>
                      <p className={`text-[13px] font-black ${roi == null ? 'text-gray-400' : roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {roi == null ? '—' : `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%`}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
              </AnimatedListItem>
            )
          })}
        </AnimatedList>
      )}
    </div>
  )
}
