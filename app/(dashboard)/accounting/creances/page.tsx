import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, HandCoins, CalendarDays, AlertTriangle } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, formatDate } from '@/lib/utils'
import MarkReceivablePaid from './MarkReceivablePaid'

// Créances client = échéances 'recette' rattachées à une réservation, non
// soldées. Le service est daté à service_date (date de la résa) ; l'encaissement
// solde la créance et crée la recette (compta de trésorerie). Requête tolérante :
// si la migration 062 n'est pas encore appliquée, reservation_id est absent et
// la liste est simplement vide (aucune erreur).
export default async function CreancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const { data: rows } = await supabase
    .from('financial_due_dates')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name)')
    .eq('type', 'recette')
    .eq('is_paid', false)
    .not('reservation_id', 'is', null)
    .order('due_date', { ascending: true })

  const creances = (rows ?? []).filter((d: any) => !d.deleted_at)
  const today = new Date().toISOString().slice(0, 10)
  const overdue = creances.filter((d: any) => d.due_date < today)
  const total = creances.reduce((s: number, d: any) => s + (d.amount ?? 0), 0)
  const overdueTotal = overdue.reduce((s: number, d: any) => s + (d.amount ?? 0), 0)

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Créances client</h1>

      {/* Total à recevoir */}
      <div className="bg-[#111111] text-white rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Total à recevoir</p>
        <p className="text-[32px] font-black leading-none">{formatPrice(total)}</p>
        <p className="text-xs text-white/60 mt-1.5">
          {creances.length} créance{creances.length > 1 ? 's' : ''} en attente d’encaissement
        </p>
      </div>

      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm font-bold text-red-700">{overdue.length} en retard d’échéance</span>
          </div>
          <span className="text-sm font-black text-red-700">{formatPrice(overdueTotal)}</span>
        </div>
      )}

      {creances.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <HandCoins className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-medium text-sm">Aucune créance en attente</p>
          <p className="text-gray-300 text-xs mt-1">Créez-en une depuis une fiche réservation non soldée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {creances.map((d: any) => {
            const v = d.vehicles
            const c = d.clients
            const isOverdue = d.due_date < today
            return (
              <div key={d.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isOverdue ? 'border-red-100' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
                    <HandCoins className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      {c ? `${c.first_name} ${c.last_name}` : 'Client'}
                      {v && <span className="font-normal text-gray-400"> · {v.brand} {v.model}</span>}
                    </p>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      {d.reservation_id && (
                        <Link href={`/reservations/${d.reservation_id}`} className="font-semibold text-blue-600 hover:underline">
                          Voir la réservation
                        </Link>
                      )}
                      {d.service_date && <span>· service {formatDate(d.service_date)}</span>}
                    </div>
                    <p className={`text-[11px] mt-1 flex items-center gap-1 font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                      <CalendarDays className="w-3 h-3" />
                      Échéance {formatDate(d.due_date)}{isOverdue ? ' — dépassée' : ''}
                    </p>
                  </div>
                  <p className="text-sm font-black text-gray-900 flex-shrink-0">{formatPrice(d.amount)}</p>
                </div>
                <MarkReceivablePaid id={d.id} amount={d.amount} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
