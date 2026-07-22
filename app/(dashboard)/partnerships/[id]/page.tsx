import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, formatDate } from '@/lib/utils'
import { OPERATION_STATUS } from '@/lib/partnerships'
import { differenceInCalendarDays } from 'date-fns'
import OperationActions from './OperationActions'
import EntrantRentalLauncher from './EntrantRentalLauncher'
import SortantConventionFlow from './SortantConventionFlow'
import DeleteOperationButton from './DeleteOperationButton'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-3">
      <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold flex-shrink-0">{label}</span>
      <div className="text-sm font-semibold text-gray-900 text-right">{children}</div>
    </div>
  )
}

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: op } = await supabase
    .from('inter_agency_rentals')
    .select('*, partner_agencies(name, phone), vehicles(plate, brand, model, daily_price), clients(first_name, last_name, phone)')
    .eq('id', id).single()
  if (!op) notFound()

  const a = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
  const v = Array.isArray(op.vehicles) ? op.vehicles[0] : op.vehicles
  const cl = Array.isArray((op as any).clients) ? (op as any).clients[0] : (op as any).clients
  const st = OPERATION_STATUS[op.status] ?? OPERATION_STATUS.en_cours
  const isIn = op.direction === 'in'

  // SORTANT — état du flux convention + EDL (contrat rattaché à l'opération).
  let sortantFlow: {
    contractId: string | null; contractStatus: string | null
    conventionSigned: boolean; depSigned: boolean; arrSigned: boolean
  } | null = null
  if (op.direction === 'out') {
    const { data: contract } = await supabase
      .from('contracts')
      .select('id, status, inspections(type, client_signature_svg)')
      .eq('inter_agency_rental_id', id)
      .limit(1)
      .maybeSingle()
    const insps = (contract?.inspections ?? []) as { type: string; client_signature_svg: string | null }[]
    sortantFlow = {
      contractId: contract?.id ?? null,
      contractStatus: contract?.status ?? null,
      conventionSigned: contract?.status === 'signe' || contract?.status === 'cloture',
      depSigned: insps.some(i => i.type === 'depart' && !!i.client_signature_svg),
      arrSigned: insps.some(i => i.type === 'arrivee' && !!i.client_signature_svg),
    }
  }
  const vehicleName = v ? `${v.plate} · ${v.brand} ${v.model}` : op.external_vehicle_description || '—'

  // Une opération sortante sans client associé n'a pas de "prix client" à
  // comparer (on prête notre véhicule au partenaire sans client des nôtres
  // dans la boucle) : on compare alors le revenu perçu au tarif normal du
  // véhicule sur la même durée, avec les données déjà en base (vehicles.daily_price).
  // Quand un client est associé, la marge suit la même formule que l'entrant
  // (client_price − rental_cost, colonne générée `margin`).
  const hasClientPrice = (op.client_price ?? 0) > 0
  const outDays = Math.max(1, differenceInCalendarDays(
    new Date(op.end_date_actual ?? op.end_date_expected), new Date(op.start_date),
  ))
  const outReference = (v?.daily_price ?? 0) * outDays
  const outMargin = op.rental_cost - outReference

  return (
    <div className="space-y-4">
      <BackButton fallbackHref={`/partnerships?dir=${op.direction}`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Partenariats
      </BackButton>

      {/* Hero */}
      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isIn ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
            {isIn ? '← Entrant' : '→ Sortant'}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
        </div>
        <h1 className="text-white text-lg font-extrabold">{a?.name ?? 'Partenaire'}</h1>
        <p className="text-white/50 text-sm mt-0.5">{vehicleName}</p>

        {isIn || hasClientPrice ? (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-base font-black text-white">{formatPrice(op.rental_cost)}</div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase">{isIn ? 'Coût' : 'Revenu'}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-base font-black text-white">{formatPrice(op.client_price)}</div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase">Client</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className={`text-base font-black ${op.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(op.margin)}</div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase">Marge</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-base font-black text-white">{formatPrice(op.rental_cost)}</div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase">Revenu</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-base font-black text-white">{formatPrice(outReference)}</div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase">Tarif normal · {outDays}j</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className={`text-base font-black ${outMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(outMargin)}</div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase">Écart vs normal</div>
            </div>
          </div>
        )}
      </div>

      {isIn && (op.client_reservation_id || op.status !== 'cloture') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Location & contrat</p>
          <EntrantRentalLauncher
            operationId={op.id}
            reservationId={op.client_reservation_id ?? null}
            hasClient={!!op.client_id}
          />
        </div>
      )}

      {sortantFlow ? (
        <>
          <SortantConventionFlow
            operationId={op.id}
            contractId={sortantFlow.contractId}
            contractStatus={sortantFlow.contractStatus}
            conventionSigned={sortantFlow.conventionSigned}
            depSigned={sortantFlow.depSigned}
            arrSigned={sortantFlow.arrSigned}
            closed={op.status === 'cloture'}
          />
          <DeleteOperationButton id={op.id} />
        </>
      ) : (
        <OperationActions id={op.id} status={op.status} />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        {cl && <Row label="Client associé">{cl.first_name} {cl.last_name} · {cl.phone}</Row>}
        <Row label="Période">{formatDate(op.start_date)} → {formatDate(op.end_date_expected)}</Row>
        {op.end_date_actual && <Row label="Retour réel">{formatDate(op.end_date_actual)}</Row>}
        {op.departure_km != null && <Row label="Km départ">{op.departure_km.toLocaleString('fr-FR')}</Row>}
        {op.return_km != null && <Row label="Km retour">{op.return_km.toLocaleString('fr-FR')}</Row>}
        <Row label="Carburant départ">{op.fuel_level_departure} km</Row>
        {op.fuel_level_return != null && <Row label="Carburant retour">{op.fuel_level_return} km</Row>}
        <Row label="Caution">{formatPrice(op.deposit_amount)}</Row>
        {a?.phone && <Row label="Contact">{a.phone}</Row>}
      </div>

      {op.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700/70 mb-1.5">Notes</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{op.notes}</p>
        </div>
      )}
    </div>
  )
}
