import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Car, User, CalendarDays, Clock,
  CreditCard, Shield, AlertTriangle, ChevronRight, Phone, BadgePercent,
} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatDateTime, formatPrice, calculateRentalDays, calculateRentalPrice } from '@/lib/utils'
import ReservationStatusButtons from '../ReservationStatusButtons'
import DepositStatusEditor from '../DepositStatusEditor'
import DepositInfoEditor from '../DepositInfoEditor'
import DepositSettlement from '../DepositSettlement'
import PaymentEditor from '../PaymentEditor'
import EditDatesPanel from '../EditDatesPanel'
import ProlongReservation from '../ProlongReservation'
import WorkflowStepper from '../WorkflowStepper'
import InvoiceCard from '../InvoiceCard'
import LateFeeEditor from '../LateFeeEditor'
import DeleteButton from '@/components/ui/DeleteButton'
import { deleteReservation } from '@/lib/actions/delete'
import PaymentCountdownMini from '../PaymentCountdownMini'
import SendPaymentEmailButton from '../SendPaymentEmailButton'
import { syncReservationToCalendar } from '@/lib/calendar/syncRental'
import type { ReservationStatus, PaymentStatus, PaymentMethod } from '@/types/database'
import { format, differenceInDays, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-0.5 h-3.5 bg-black rounded-full flex-shrink-0" />
      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{children}</span>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold flex-shrink-0">{label}</span>
      <div className="text-sm font-semibold text-gray-900 text-right ml-4">{children}</div>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { label: string; hero: string; badge: string }> = {
  option:    { label: 'En cours',    hero: 'bg-gray-700',  badge: 'bg-gray-100 text-gray-600' },
  confirmee: { label: 'Confirmée',  hero: 'bg-blue-700',  badge: 'bg-blue-50 text-blue-700' },
  en_cours:  { label: 'En location', hero: 'bg-[#111111]', badge: 'bg-green-50 text-green-700' },
  en_retard: { label: 'En retard', hero: 'bg-red-700',    badge: 'bg-red-50 text-red-700' },
  terminee:  { label: 'Terminée',  hero: 'bg-gray-500',   badge: 'bg-gray-100 text-gray-500' },
  annulee:   { label: 'Annulée',   hero: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-400' },
}

const PAYMENT_LABELS: Record<string, string> = {
  especes:  'Espèces', virement: 'Virement', cb: 'Carte bancaire', cheque: 'Chèque',
}
const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  en_attente:      'En attente',
  liberee:         'Libérée',
  saisie_partielle:'Saisie partielle',
  saisie_totale:   'Saisie totale',
  litigieuse:      'Litigieuse',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  // Retour contextuel : depuis le calendrier, la page Alertes ou le tableau de
  // bord (accueil), le bouton retour ramène à la source (et non à la liste des
  // réservations, où l'on n'était pas).
  const backHref =
    from === 'calendrier' ? '/calendrier'
    : from === 'alerts'   ? '/alerts'
    : from === 'accueil'  ? '/'
    : '/reservations'
  const supabase = await createClient()

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, vehicle:vehicles(*), client:clients(*)')
    .eq('id', id)
    .single()

  if (!reservation) notFound()

  // Détection auto retards — mutation directe (pas l'action updateReservationStatus,
  // qui appelle revalidatePath : interdit pendant le rendu d'une page, Next.js plante).
  if (reservation.status === 'en_cours') {
    const now = new Date()
    if (new Date(reservation.end_datetime) < now) {
      await supabase.from('reservations').update({ status: 'en_retard' }).eq('id', id)
      await syncReservationToCalendar(id)
      reservation.status = 'en_retard'
    }
  }

  // Plus d'auto-annulation : le chrono acompte 2 h est purement visuel — le gérant
  // garde la main pour annuler ou confirmer l'option (choix « auto à la création, sans annulation »).

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, contract_number, status')
    .eq('reservation_id', id)
    .limit(1)
    .single()

  const { data: inspections } = contract
    ? await supabase
        .from('inspections')
        .select('id, type, client_signature_svg, signed_at, damaged_zones')
        .eq('contract_id', contract.id)
        .in('type', ['depart', 'arrivee'])
    : { data: [] }

  const inspectionInfos = (inspections ?? []).map(i => ({
    id: i.id,
    type: i.type as 'depart' | 'arrivee',
    hasSig: !!i.client_signature_svg,
    signedAt: i.signed_at,
    damages: Array.isArray(i.damaged_zones) ? (i.damaged_zones as unknown[]).length : 0,
  }))

  const contractClosed = contract?.status === 'cloture'

  const { data: invoice } = contractClosed && contract
    ? await supabase
        .from('invoices')
        .select('id, invoice_number, line_items, total_amount, sent_at, cancelled_at, payment_term_days, due_date')
        .eq('contract_id', contract.id)
        .maybeSingle()
    : { data: null }
  const cfg = STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.option

  const v = reservation.vehicle as any
  const c = reservation.client as any

  const startDate = new Date(reservation.start_datetime)
  const endDate   = new Date(reservation.end_datetime)
  const totalHours = differenceInHours(endDate, startDate)
  const nbDays     = Math.max(0, Math.floor(totalHours / 24))
  const nbHours    = totalHours % 24
  const isLate    = reservation.status === 'en_retard'
  const hasExtraFees =
    (reservation.late_fee_amount > 0) || (reservation.extra_km_count > 0)
  // Le frais de retard peut être saisi/ajusté à la main dès que le véhicule est
  // sorti (en cours / en retard) ou déjà rendu (terminé).
  const canEditLateFee = ['en_cours', 'en_retard', 'terminee'].includes(reservation.status)

  // Réduction : écart entre le tarif au barème (jour/semaine) et le prix total
  // réellement appliqué (prix négocié via « Modifier les dates & tarif »).
  // Mentionnée dans l'encadré noir + la carte Tarif (ticket SAV 23/07).
  const standardTotal = calculateRentalPrice(
    reservation.daily_price,
    (reservation.vehicle as any)?.weekly_price ?? null,
    calculateRentalDays(reservation.start_datetime, reservation.end_datetime),
  )
  const discount    = Math.round((standardTotal - reservation.total_price) * 100) / 100
  const hasDiscount = discount > 0

  // Chrono acompte : 2 h à partir de la création de l'option, tant que l'acompte
  // n'est pas encaissé. Affichage seul, aucune annulation automatique.
  const acompteDeadline = reservation.status === 'option' && reservation.payment_status === 'en_attente' && (reservation as any).created_at
    ? new Date(new Date((reservation as any).created_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
    : null

  return (
    <div className="space-y-4">

      {/* ─── Bouton retour ─── */}
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={backHref} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <span className="text-sm text-gray-400 font-mono">{reservation.reservation_number}</span>
        <div className="ml-auto">
          <DeleteButton
            onConfirm={deleteReservation.bind(null, id)}
            label="Supprimer la réservation"
            confirmMessage={`Supprimer ${reservation.reservation_number} ?`}
            variant="text"
          />
        </div>
      </div>

      {/* ─── Hero statut ─── */}
      <div className={`rounded-2xl p-5 ${cfg.hero}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full font-bold ${cfg.badge}`}>
              {cfg.label}
            </span>
            {['en_cours', 'en_retard', 'confirmee'].includes(reservation.status) && (
              <ProlongReservation
                reservationId={id}
                contractId={contract?.id}
                startDatetime={reservation.start_datetime}
                endDatetime={reservation.end_datetime}
                dailyPrice={reservation.daily_price}
                weeklyPrice={(reservation.vehicle as any)?.weekly_price ?? null}
                currentTotal={reservation.total_price}
                kmIncludedDaily={reservation.km_included}
                reservationStatus={reservation.status}
              />
            )}
            <EditDatesPanel
              reservationId={id}
              startDatetime={reservation.start_datetime}
              endDatetime={reservation.end_datetime}
              dailyPrice={reservation.daily_price}
              weeklyPrice={(reservation.vehicle as any)?.weekly_price ?? null}
              currentTotal={reservation.total_price}
              reservationStatus={reservation.status}
              variant="hero"
            />
          </div>
          <div className="flex items-center gap-2">
            {isLate && (
              <span className="flex items-center gap-1.5 text-xs text-red-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Retour dépassé
              </span>
            )}
            {acompteDeadline && (
              <PaymentCountdownMini reservationId={id} deadline={acompteDeadline} onDark />
            )}
          </div>
        </div>

        {/* Véhicule + client */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/vehicles/${v?.id}`} className="bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-colors">
            <div className="flex items-center gap-1.5 text-white/60 mb-1">
              <Car className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Véhicule</span>
            </div>
            <div className="font-extrabold text-white text-base">
              {v?.brand} {v?.model}{v?.color ? ` · ${v.color}` : ''}
            </div>
            <div className="font-mono text-white/50 text-xs mt-0.5">{v?.plate}</div>
          </Link>
          <Link href={`/clients/${c?.id}`} className="bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-colors">
            <div className="flex items-center gap-1.5 text-white/60 mb-1">
              <User className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Client</span>
            </div>
            <div className="font-bold text-white text-sm">{c?.first_name} {c?.last_name}</div>
            {c?.phone && (
              <div className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {c.phone}
              </div>
            )}
          </Link>
        </div>

        {/* Dates */}
        <div className="mt-3 bg-white/10 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-white/60 mb-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Période · {nbDays}j{nbHours > 0 ? ` ${nbHours}h` : ''}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-white/50 text-xs">Départ</div>
              <div className="text-white font-bold text-sm">{format(startDate, 'd MMM', { locale: fr })}</div>
              <div className="text-white/70 text-xs">{format(startDate, 'HH:mm')}</div>
            </div>
            <div>
              <div className={`text-xs ${isLate ? 'text-red-300' : 'text-white/50'}`}>Retour prévu</div>
              <div className={`font-bold text-sm ${isLate ? 'text-red-200' : 'text-white'}`}>
                {format(endDate, 'd MMM', { locale: fr })}
              </div>
              <div className="text-white/70 text-xs">{format(endDate, 'HH:mm')}</div>
            </div>
          </div>
        </div>

        {/* Prix total */}
        <div className="mt-3 bg-white/10 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm font-semibold">Total location</span>
            <span className="text-white text-2xl font-extrabold">{formatPrice(reservation.total_price)}</span>
          </div>
          {hasDiscount && (
            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <BadgePercent className="w-3.5 h-3.5" /> Réduction appliquée
              </span>
              <span className="text-white/50">
                <s>{formatPrice(standardTotal)}</s>{' '}
                <span className="text-emerald-300 font-bold no-underline">−{formatPrice(discount)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Workflow ─── */}
      <WorkflowStepper
        reservationId={id}
        contractId={contract?.id ?? null}
        contractStatus={contract?.status ?? null}
        reservationStatus={reservation.status}
        inspections={inspectionInfos}
      />

      {/* ─── Facture de restitution (frais complémentaires) ─── */}
      {invoice && <InvoiceCard invoice={invoice as any} />}

      {/* ─── Actions statut ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Actions</SectionLabel>
        <ReservationStatusButtons
          reservationId={id}
          contractId={contract?.id}
          currentStatus={reservation.status as ReservationStatus}
          contractClosed={contractClosed}
          totalPrice={reservation.total_price}
        />
      </div>

      {/* ─── Contrat ─── */}
      {contract && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <SectionLabel>Contrat</SectionLabel>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-gray-400">{contract.contract_number}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              contract.status === 'cloture'   ? 'bg-green-50 text-green-700' :
              contract.status === 'signe'     ? 'bg-green-50 text-green-600' :
              contract.status === 'a_signer'  ? 'bg-amber-50 text-amber-700' :
                                                'bg-gray-100 text-gray-500'
            }`}>
              {contract.status === 'cloture' ? 'Clôturé' :
               contract.status === 'signe'   ? 'Signé' :
               contract.status === 'a_signer'? 'À signer' : contract.status}
            </span>
          </div>
          <Link
            href={`/contracts/${contract.id}`}
            className="flex items-center gap-2 w-full py-3 px-4 bg-[#111111] hover:bg-gray-800 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[.97]"
          >
            <FileText className="w-4 h-4" /> Ouvrir le contrat
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Link>
        </div>
      )}

      {/* ─── Tarif détaillé ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Tarif</SectionLabel>
        <div>
          <InfoRow label="Prix / jour">{formatPrice(reservation.daily_price)}</InfoRow>
          <InfoRow label="Durée">{nbDays} jour{nbDays > 1 ? 's' : ''}{nbHours > 0 ? ` ${nbHours}h` : ''}</InfoRow>
          {reservation.km_included && (
            <InfoRow label="KM inclus / jour">{reservation.km_included} km</InfoRow>
          )}
          {reservation.extra_km_price && (
            <InfoRow label="Supplément KM">{reservation.extra_km_price}€ / km</InfoRow>
          )}
          {hasDiscount && (
            <>
              <InfoRow label="Tarif standard"><s className="text-gray-400">{formatPrice(standardTotal)}</s></InfoRow>
              <InfoRow label="Réduction">
                <span className="font-bold text-emerald-600">
                  −{formatPrice(discount)}{standardTotal > 0 ? ` (−${Math.round((discount / standardTotal) * 100)} %)` : ''}
                </span>
              </InfoRow>
            </>
          )}
          <InfoRow label="Total"><span className="text-base font-extrabold">{formatPrice(reservation.total_price)}</span></InfoRow>
        </div>
      </div>

      {/* ─── Frais complémentaires (retard / km) ─── */}
      {(hasExtraFees || canEditLateFee) && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <SectionLabel>Frais complémentaires</SectionLabel>
          <div className="space-y-3">
            {/* Retard : éditable à la main quand le véhicule est sorti/rendu ; sinon lecture seule. */}
            {canEditLateFee ? (
              <LateFeeEditor
                reservationId={id}
                lateFeeAmount={reservation.late_fee_amount ?? null}
                lateMinutes={reservation.late_minutes ?? null}
              />
            ) : reservation.late_fee_amount > 0 && (
              <InfoRow label={`Retard (${reservation.late_minutes} min)`}>
                <span className="text-orange-700">{formatPrice(reservation.late_fee_amount)}</span>
              </InfoRow>
            )}
            {reservation.extra_km_count > 0 && (
              <InfoRow label={`Km dépassés (${reservation.extra_km_count} km)`}>
                <span className="text-orange-700">{formatPrice(reservation.extra_km_amount)}</span>
              </InfoRow>
            )}
            {(reservation.late_fee_amount > 0 || reservation.extra_km_count > 0) && (
              <InfoRow label="Total frais">
                <span className="text-orange-700 text-base font-extrabold">
                  {formatPrice((reservation.late_fee_amount ?? 0) + (reservation.extra_km_amount ?? 0))}
                </span>
              </InfoRow>
            )}
          </div>
        </div>
      )}

      {/* ─── Caution ─── */}
      {reservation.deposit_amount && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <SectionLabel>Caution</SectionLabel>
          <div className="mb-3">
            <InfoRow label="Montant">
              <span className="text-lg font-extrabold">{formatPrice(reservation.deposit_amount)}</span>
            </InfoRow>
            <InfoRow label="Statut">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                reservation.deposit_status === 'liberee'         ? 'bg-green-50 text-green-700' :
                reservation.deposit_status === 'saisie_totale'   ? 'bg-red-50 text-red-700' :
                reservation.deposit_status === 'saisie_partielle'? 'bg-orange-50 text-orange-700' :
                reservation.deposit_status === 'litigieuse'      ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-500'
              }`}>
                {DEPOSIT_STATUS_LABELS[reservation.deposit_status ?? 'en_attente']}
              </span>
            </InfoRow>
          </div>
          <DepositInfoEditor
            reservationId={id}
            depositMethod={reservation.deposit_method ?? null}
            depositRef={reservation.deposit_ref ?? null}
          />
          <div className="mt-3 pt-3 border-t border-gray-50">
            <DepositStatusEditor
              reservationId={id}
              currentStatus={reservation.deposit_status ?? 'en_attente'}
              contractClosed={contractClosed}
            />
          </div>
          <DepositSettlement
            reservationId={id}
            depositAmount={reservation.deposit_amount}
            depositDeducted={reservation.deposit_deducted ?? 0}
            status={reservation.deposit_status ?? 'en_attente'}
          />
        </div>
      )}

      {/* ─── Paiement ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Paiement de la location</SectionLabel>
        <PaymentEditor
          reservationId={id}
          totalPrice={reservation.total_price}
          currentStatus={(reservation.payment_status ?? 'en_attente') as PaymentStatus}
          currentMethod={(reservation.payment_method ?? null) as PaymentMethod | null}
          currentAmount={reservation.payment_amount ?? null}
          currentRef={reservation.payment_ref ?? null}
        />
        {reservation.status === 'option' && reservation.payment_status === 'en_attente' && c?.email && (
          <SendPaymentEmailButton
            reservationId={id}
            clientEmail={c.email}
            clientName={[c.first_name, c.last_name].filter(Boolean).join(' ')}
            reservationNumber={reservation.reservation_number ?? ''}
          />
        )}
      </div>

      {/* ─── Notes internes ─── */}
      {reservation.internal_notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <SectionLabel>Notes internes</SectionLabel>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {reservation.internal_notes}
          </p>
        </div>
      )}

    </div>
  )
}
