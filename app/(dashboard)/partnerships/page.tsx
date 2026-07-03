import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ChevronRight, Building2, Repeat } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { OPERATION_STATUS } from '@/lib/partnerships'
import { differenceInCalendarDays } from 'date-fns'

export default async function PartnershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string }>
}) {
  const { dir } = await searchParams
  const direction = dir === 'in' ? 'in' : 'out'
  const supabase = await createClient()

  const { data: ops } = await supabase
    .from('inter_agency_rentals')
    .select('*, partner_agencies(name), vehicles(plate, brand, model, daily_price)')
    .eq('direction', direction)
    .order('start_date', { ascending: false })

  const tab = (active: boolean) =>
    `flex-1 text-sm font-semibold py-2.5 min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
    }`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">Partenariats</h1>
        <div className="flex gap-2">
          <Link href="/partnerships/agencies" className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-gray-100 shadow-sm text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
            <Building2 className="w-4 h-4" /> Agences
          </Link>
          <Link href="/partnerships/new" className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors active:scale-[.98]">
            <Plus className="w-4 h-4" /> Opération
          </Link>
        </div>
      </div>

      {/* Onglets direction */}
      <div className="flex gap-2">
        <Link href="/partnerships?dir=out" className={tab(direction === 'out')}>→ Sortants</Link>
        <Link href="/partnerships?dir=in" className={tab(direction === 'in')}>← Entrants</Link>
      </div>

      {!ops || ops.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Repeat className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">
            Aucune opération {direction === 'out' ? 'sortante' : 'entrante'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ops.map(op => {
            const a = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
            const v = Array.isArray(op.vehicles) ? op.vehicles[0] : op.vehicles
            const st = OPERATION_STATUS[op.status] ?? OPERATION_STATUS.en_cours
            const vehicleName = v ? `${v.plate} · ${v.brand} ${v.model}` : op.external_vehicle_description || '—'
            return (
              <Link key={op.id} href={`/partnerships/${op.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${op.direction === 'out' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                          {op.direction === 'out' ? '→ Sortant' : '← Entrant'}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{a?.name ?? 'Partenaire'}</p>
                      <p className="text-xs text-gray-400">{vehicleName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 font-medium">{formatDate(op.start_date)}</p>
                      <p className="text-[11px] text-gray-400">→ {formatDate(op.end_date_expected)}</p>
                    </div>
                  </div>

                  {op.direction === 'in' || (op.client_price ?? 0) > 0 ? (
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{op.direction === 'in' ? 'Coût' : 'Revenu'}</p>
                        <p className="text-sm font-black text-gray-900">{formatPrice(op.rental_cost)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Client</p>
                        <p className="text-sm font-black text-gray-900">{formatPrice(op.client_price)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Marge</p>
                        <p className={`text-sm font-black ${op.margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPrice(op.margin)}</p>
                      </div>
                    </div>
                  ) : (() => {
                    const days = Math.max(1, differenceInCalendarDays(
                      new Date(op.end_date_actual ?? op.end_date_expected), new Date(op.start_date),
                    ))
                    const reference = (v?.daily_price ?? 0) * days
                    const margin = op.rental_cost - reference
                    return (
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Revenu</p>
                          <p className="text-sm font-black text-gray-900">{formatPrice(op.rental_cost)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tarif normal</p>
                          <p className="text-sm font-black text-gray-900">{formatPrice(reference)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Écart</p>
                          <p className={`text-sm font-black ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPrice(margin)}</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
