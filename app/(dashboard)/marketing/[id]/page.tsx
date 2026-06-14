import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatPrice } from '@/lib/utils'
import { getChannelLabel, CAMPAIGN_STATUSES, calcROI, calcCAC } from '@/lib/marketing/channels'
import CloseForm from './CloseForm'
import StatusActions from './StatusActions'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: c } = await supabase.from('campaigns').select('*').eq('id', id).single()
  if (!c) notFound()

  const st  = CAMPAIGN_STATUSES[c.status as keyof typeof CAMPAIGN_STATUSES] ?? CAMPAIGN_STATUSES.planifiee
  const roi = calcROI(c.budget, c.revenue_generated)
  const cac = calcCAC(c.budget, c.reservations_count)
  const cvr = c.prospects_count > 0
    ? ((c.reservations_count / c.prospects_count) * 100).toFixed(1)
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/marketing" className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-gray-900 truncate">{c.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {getChannelLabel(c.channel)}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.style}`}>
              {st.label}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">ROI</p>
          <p className={`text-[36px] font-black leading-none ${roi == null ? 'text-gray-300' : roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {roi == null ? '—' : `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">CAC</p>
          <p className="text-[36px] font-black leading-none text-[#111111]">
            {cac == null ? 'N/A' : formatPrice(cac)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Taux conversion</p>
          <p className="text-[36px] font-black leading-none text-[#111111]">
            {cvr == null ? 'N/A' : `${cvr}%`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">CA généré</p>
          <p className="text-[36px] font-black leading-none text-[#111111]">
            {formatPrice(c.revenue_generated)}
          </p>
        </div>
      </div>

      {/* Infos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Détails</p>
        {c.objective && <p className="text-[13px] text-gray-600">{c.objective}</p>}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <div><span className="text-gray-400">Responsable</span><p className="font-medium">{c.responsible || '—'}</p></div>
          <div><span className="text-gray-400">Budget</span><p className="font-medium">{formatPrice(c.budget)}</p></div>
          <div><span className="text-gray-400">Lancement</span><p className="font-medium">{formatDate(c.start_date)}</p></div>
          <div><span className="text-gray-400">Fin</span><p className="font-medium">{c.end_date ? formatDate(c.end_date) : '—'}</p></div>
          <div><span className="text-gray-400">Prospects</span><p className="font-medium">{c.prospects_count}</p></div>
          <div><span className="text-gray-400">Réservations</span><p className="font-medium">{c.reservations_count}</p></div>
        </div>
        {c.observations && (
          <div className="pt-2 border-t border-gray-50">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Observations</p>
            <p className="text-[13px] text-gray-600">{c.observations}</p>
          </div>
        )}
      </div>

      {/* Actions statut */}
      <StatusActions campaignId={c.id} currentStatus={c.status} />

      {/* Formulaire clôture */}
      {c.status !== 'terminee' && <CloseForm campaignId={c.id} endDate={c.end_date} />}
    </div>
  )
}
