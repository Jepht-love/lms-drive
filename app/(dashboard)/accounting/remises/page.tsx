import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BadgePercent, CalendarDays } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, reservationDiscount } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Remises accordées = réservations (hors annulées) dont le prix total facturé
// est passé sous le barème (prix/jour figé, tarif semaine). La remise est
// DÉRIVÉE (aucune colonne dédiée), donc rétroactive sur l'historique existant.
export default async function RemisesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, reservation_number, status, start_datetime, end_datetime, total_price, daily_price, vehicle:vehicles(plate, brand, model, weekly_price), client:clients(first_name, last_name)')
    .neq('status', 'annulee')
    .order('start_datetime', { ascending: false })

  const rows = (reservations ?? [])
    .map(r => ({ r, ...reservationDiscount(r as any) }))
    .filter(x => x.discount > 0)

  const totalRemises = rows.reduce((s, x) => s + x.discount, 0)
  const totalStandard = rows.reduce((s, x) => s + x.standard, 0)
  const avgPercent = totalStandard > 0 ? Math.round((totalRemises / totalStandard) * 100) : 0

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Remises accordées</h1>

      {/* Total */}
      <div className="bg-[#111111] text-white rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Total des remises consenties</p>
        <p className="text-[32px] font-black leading-none">−{formatPrice(totalRemises)}</p>
        <p className="text-xs text-white/60 mt-1.5">
          {rows.length} réservation{rows.length > 1 ? 's' : ''} · {avgPercent}% en moyenne vs barème
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <BadgePercent className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-medium text-sm">Aucune remise accordée</p>
          <p className="text-gray-300 text-xs mt-1">Les prix négociés sous le barème apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {rows.map(({ r, discount, standard, percent }) => {
            const v = (r as any).vehicle
            const c = (r as any).client
            const start = new Date(r.start_datetime)
            const end = new Date(r.end_datetime)
            return (
              <Link key={r.id} href={`/reservations/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <BadgePercent className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 truncate">
                    {v?.brand} {v?.model}
                    {c && <span className="font-normal text-gray-400"> · {c.first_name} {c.last_name}</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {format(start, 'd MMM', { locale: fr })} → {format(end, 'd MMM yyyy', { locale: fr })}
                    <span className="text-gray-300 font-mono ml-1">{r.reservation_number}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-emerald-600">−{formatPrice(discount)}</p>
                  <p className="text-[10px] text-gray-400">
                    <s>{formatPrice(standard)}</s> → {formatPrice(r.total_price)} · −{percent}%
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
