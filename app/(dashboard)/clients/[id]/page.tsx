import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit, Phone, Mail, Star, AlertTriangle,
  ChevronRight, CalendarDays, Car, CreditCard, FileText, Plus, RotateCcw,
} from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { infractionTypeLabel, INFRACTION_STATUS, SINISTRE_STATUS } from '@/lib/incidents'
import DeleteButton from '@/components/ui/DeleteButton'
import { deleteClient } from '@/lib/actions/delete'
import ClientDocPhotos from './ClientDocPhotos'
import ClientNotesEditor from './ClientNotesEditor'
import ClientStatusActions from './ClientStatusActions'
import BackButton from '@/components/ui/BackButton'
import { getMissingClientFields } from '@/lib/clients/completeness'

// ─── Helpers visuels ──────────────────────────────────────────────────────────

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
      <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</span>
      <div className="text-sm font-semibold text-gray-900 text-right">{children}</div>
    </div>
  )
}

const STATUS_RES: Record<string, string> = {
  option:    'bg-gray-100 text-gray-600',
  confirmee: 'bg-blue-50 text-blue-700',
  en_cours:  'bg-green-50 text-green-700',
  en_retard: 'bg-red-50 text-red-700',
  terminee:  'bg-gray-100 text-gray-500',
  annulee:   'bg-gray-100 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  option:    'En cours',
  confirmee: 'Confirmée',
  en_cours:  'En location',
  en_retard: 'En retard',
  terminee:  'Terminée',
  annulee:   'Annulée',
}

const PAYMENT_LABELS: Record<string, string> = {
  especes:  'Espèces',
  virement: 'Virement',
  cb:       'Carte bancaire',
  cheque:   'Chèque',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  const { data: reservations } = await supabase
    .from('reservations')
    .select(
      'id, reservation_number, status, start_datetime, end_datetime, total_price, daily_price, payment_status, deposit_amount, deposit_status, deposit_deducted, late_minutes, vehicle:vehicles(plate, brand, model)'
    )
    .eq('client_id', id)
    .order('start_datetime', { ascending: false })

  // ── Historique & incidents (amendes + sinistres) ──
  // Tables en RLS gérant/associé → un employé verra simplement des listes vides.
  const [{ data: infractions }, { data: accidents }] = await Promise.all([
    supabase
      .from('infractions')
      .select('id, infraction_date, type, amount, status, vehicle:vehicles(plate, brand, model)')
      .eq('client_id', id)
      .order('infraction_date', { ascending: false }),
    supabase
      .from('accidents')
      .select('id, accident_date, description, status, repair_cost, deposit_retained, vehicle:vehicles(plate, brand, model)')
      .eq('client_id', id)
      .order('accident_date', { ascending: false }),
  ])

  // Signed URLs documents
  async function getSignedUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null
    const { data } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  const [idFrontUrl, idBackUrl, licFrontUrl, licBackUrl, addressUrl] = await Promise.all([
    getSignedUrl(client.id_doc_front_path),
    getSignedUrl(client.id_doc_back_path),
    getSignedUrl(client.license_front_path),
    getSignedUrl(client.license_back_path),
    getSignedUrl(client.proof_of_address_path),
  ])

  // ── Indicateurs financiers ──
  const completed  = reservations?.filter(r => r.status === 'terminee') ?? []
  const active     = reservations?.filter(r => ['en_cours', 'confirmee', 'option', 'en_retard'].includes(r.status)) ?? []
  const totalCA    = completed.reduce((s, r) => s + (r.total_price ?? 0), 0)
  const avgCA      = completed.length > 0 ? totalCA / completed.length : 0
  const totalAll   = reservations?.filter(r => r.status !== 'annulee').length ?? 0
  // Annulations : signal de fiabilité commerciale (désistements, no-shows). Non
  // comptées dans l'historique facturé mais suivies à part.
  const annulations = reservations?.filter(r => r.status === 'annulee').length ?? 0
  // Impayés : réservations terminées non soldées
  const impayes    = completed.filter(r => r.payment_status && r.payment_status !== 'paye')
  const impayesCA  = impayes.reduce((s, r) => s + (r.total_price ?? 0), 0)
  // Caution retenue : saisie partielle ou totale du dépôt
  const cautionsRetenues = (reservations ?? []).filter(
    (r: any) => r.deposit_status === 'saisie_partielle' || r.deposit_status === 'saisie_totale'
  )
  const cautionRetenueTotal = cautionsRetenues.reduce((s, r: any) => s + (r.deposit_deducted ?? 0), 0)
  // Remboursements en attente : caution d'une location terminée pas encore
  // restituée (statut « en_attente ») ou partiellement retenue (solde à rendre).
  const remboursements = (reservations ?? []).filter((r: any) =>
    r.status === 'terminee' && (r.deposit_amount ?? 0) > 0 && (
      r.deposit_status === 'en_attente' ||
      (r.deposit_status === 'saisie_partielle' && (r.deposit_amount - (r.deposit_deducted ?? 0)) > 0)
    )
  )
  const remboursementTotal = remboursements.reduce((s: number, r: any) =>
    s + (r.deposit_status === 'saisie_partielle'
      ? r.deposit_amount - (r.deposit_deducted ?? 0)
      : r.deposit_amount), 0)
  // Litiges & retards
  const litiges = (reservations ?? []).filter((r: any) => r.deposit_status === 'litigieuse')
  const retards = (reservations ?? []).filter((r: any) => r.status === 'en_retard' || (r.late_minutes ?? 0) > 0)
  const totalAmendes = (infractions ?? []).reduce((s, i: any) => s + (i.amount ?? 0), 0)
  const incidentsCount =
    (infractions?.length ?? 0) + (accidents?.length ?? 0) +
    cautionsRetenues.length + litiges.length + retards.length

  const initials = `${client.first_name?.charAt(0) ?? ''}${client.last_name?.charAt(0) ?? ''}`.toUpperCase() || '?'

  const isVip        = client.status === 'vip'
  const isBlackliste = client.status === 'blackliste'

  return (
    <div className="space-y-4">

      <BackButton fallbackHref="/clients" />

      {/* ─── Dossier incomplet ─── */}
      {(() => {
        const missing = getMissingClientFields(client)
        if (missing.length === 0) return null
        return (
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-orange-800">Dossier incomplet — impossibilité de louer</p>
              <p className="text-xs text-orange-600 mt-0.5">Manquant : {missing.join(', ')}</p>
            </div>
          </div>
        )
      })()}

      {/* ─── Hero client ─── */}
      <div className={`rounded-2xl p-5 ${
        isBlackliste ? 'bg-red-600' : isVip ? 'bg-[#111111]' : 'bg-[#111111]'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-black">{initials}</span>
            </div>
            {/* Nom + statut */}
            <div>
              <h1 className="text-white text-xl font-extrabold leading-tight">
                {client.first_name} {client.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isVip && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                    ★ VIP
                  </span>
                )}
                {isBlackliste && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                    ⚠ Blacklisté
                  </span>
                )}
                {client.rating && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < client.rating! ? 'fill-amber-300 text-amber-300' : 'text-white/20'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Actions rapides */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/clients/${id}/edit`}
              className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <Edit className="w-4 h-4 text-white" />
            </Link>
            <DeleteButton
              onConfirm={deleteClient.bind(null, id)}
              label="Supprimer le client"
              confirmMessage={`Supprimer ${client.first_name} ${client.last_name} ?`}
              variant="text"
            />
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{totalAll}</div>
            <div className="text-xs text-white/60 mt-0.5">Location{totalAll !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{active.length}</div>
            <div className="text-xs text-white/60 mt-0.5">En cours</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-white">{formatPrice(totalCA)}</div>
            <div className="text-xs text-white/60 mt-0.5">CA total</div>
          </div>
        </div>
      </div>

      {/* ─── Statut client (VIP / Blacklist) ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Statut client</SectionLabel>
        <ClientStatusActions clientId={id} status={client.status} />
      </div>

      {/* ─── Alerte blacklist ─── */}
      {isBlackliste && client.blacklist_reason && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 text-sm">Raison du blacklistage</p>
            <p className="text-sm text-red-700 mt-0.5">{client.blacklist_reason}</p>
          </div>
        </div>
      )}

      {/* ─── RÉSUMÉ ACTIVITÉ ─── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-2xl font-black text-gray-900">{totalAll}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">
            Location{totalAll !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-lg font-black text-gray-900">{formatPrice(totalCA)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">
            CA total
          </p>
        </div>
        <div className={`rounded-xl border shadow-sm p-3 text-center ${
          impayes.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'
        }`}>
          <p className={`text-2xl font-black ${impayes.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {impayes.length}
          </p>
          <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${
            impayes.length > 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            Impayé{impayes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Détail impayés */}
      {impayes.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm font-bold text-red-700">Montant impayé total</span>
          </div>
          <span className="text-sm font-black text-red-700">{formatPrice(impayesCA)}</span>
        </div>
      )}

      {/* Remboursements en attente (caution à restituer) */}
      {remboursements.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm font-bold text-blue-700">
              Caution à restituer · {remboursements.length} location{remboursements.length > 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-sm font-black text-blue-700">{formatPrice(remboursementTotal)}</span>
        </div>
      )}

      {/* ─── Historique & incidents ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Historique &amp; incidents</SectionLabel>
          {incidentsCount > 0 && (
            <span className="text-[10px] font-black bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
              {incidentsCount}
            </span>
          )}
        </div>

        {/* Compteurs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Amendes', value: infractions?.length ?? 0, sub: totalAmendes > 0 ? formatPrice(totalAmendes) : null, tone: 'red' as const },
            { label: 'Sinistres', value: accidents?.length ?? 0, sub: null, tone: 'red' as const },
            { label: 'Retards', value: retards.length, sub: null, tone: 'red' as const },
            { label: 'Caut. ret.', value: cautionsRetenues.length, sub: cautionRetenueTotal > 0 ? formatPrice(cautionRetenueTotal) : null, tone: 'red' as const },
            { label: 'Litiges', value: litiges.length, sub: null, tone: 'red' as const },
            { label: 'Impayés', value: impayes.length, sub: impayesCA > 0 ? formatPrice(impayesCA) : null, tone: 'red' as const },
            // Annulations : informationnel (ambre), pas une faute grave comme un impayé.
            { label: 'Annulations', value: annulations, sub: null, tone: 'amber' as const },
          ].map(s => {
            const active = s.value > 0
            const bg   = !active ? 'bg-gray-50' : s.tone === 'amber' ? 'bg-amber-50' : 'bg-red-50'
            const num  = !active ? 'text-gray-300' : s.tone === 'amber' ? 'text-amber-600' : 'text-red-600'
            const sub  = s.tone === 'amber' ? 'text-amber-400' : 'text-red-400'
            return (
              <div key={s.label} className={`rounded-xl p-2.5 text-center ${bg}`}>
                <p className={`text-lg font-black ${num}`}>{s.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">{s.label}</p>
                {s.sub && <p className={`text-[9px] font-semibold mt-0.5 ${sub}`}>{s.sub}</p>}
              </div>
            )
          })}
        </div>

        {/* Détail amendes + sinistres */}
        {(infractions?.length ?? 0) === 0 && (accidents?.length ?? 0) === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Aucune amende ni sinistre enregistré</p>
        ) : (
          <div className="space-y-1.5">
            {infractions?.map((inf: any) => {
              const v = Array.isArray(inf.vehicle) ? inf.vehicle[0] : inf.vehicle
              return (
                <Link key={inf.id} href={`/incidents/infractions/${inf.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">Amende · {infractionTypeLabel(inf.type)}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(inf.infraction_date)}{v?.brand ? ` · ${v.brand} ${v.model}` : ''}
                      {v?.plate && <span className="text-gray-300 font-mono"> · {v.plate}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {inf.amount > 0 && <p className="text-sm font-bold text-gray-700">{formatPrice(inf.amount)}</p>}
                    <p className="text-[10px] font-bold uppercase text-gray-400">{INFRACTION_STATUS[inf.status]?.label ?? inf.status}</p>
                  </div>
                </Link>
              )
            })}
            {accidents?.map((acc: any) => {
              const v = Array.isArray(acc.vehicle) ? acc.vehicle[0] : acc.vehicle
              return (
                <Link key={acc.id} href={`/incidents/sinistres/${acc.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Car className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">Sinistre · {acc.description}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(acc.accident_date)}{v?.brand ? ` · ${v.brand} ${v.model}` : ''}
                      {v?.plate && <span className="text-gray-300 font-mono"> · {v.plate}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {acc.repair_cost > 0 && <p className="text-sm font-bold text-gray-700">{formatPrice(acc.repair_cost)}</p>}
                    <p className="text-[10px] font-bold uppercase text-gray-400">{SINISTRE_STATUS[acc.status]?.label ?? acc.status}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Action principale ─── */}
      <Link
        href={`/reservations/new?client=${id}`}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-all active:scale-[.97]"
      >
        <Plus className="w-4 h-4" /> Nouvelle réservation
      </Link>

      {/* ─── Coordonnées ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Coordonnées</SectionLabel>
        <div>
          {client.phone && (
            <InfoRow label="Téléphone">
              <a href={`tel:${client.phone}`} className="text-[#111111] font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {client.phone}
              </a>
            </InfoRow>
          )}
          {client.email && (
            <InfoRow label="Email">
              <a href={`mailto:${client.email}`} className="text-[#111111] font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate max-w-[180px]">{client.email}</span>
              </a>
            </InfoRow>
          )}
          {client.birth_date && (
            <InfoRow label="Naissance">{formatDate(client.birth_date)}</InfoRow>
          )}
          {client.address && (
            <InfoRow label="Adresse">
              <span className="text-right">
                {client.address}
                {client.postal_code && `, ${client.postal_code}`}
                {client.city && ` ${client.city}`}
              </span>
            </InfoRow>
          )}
          {client.acquisition_channel && (
            <InfoRow label="Canal d'acquisition">{client.acquisition_channel}</InfoRow>
          )}
        </div>
      </div>

      {/* ─── Documents ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Documents d&apos;identité</SectionLabel>
        <div>
          {client.id_doc_type && (
            <InfoRow label="Pièce d'identité">
              {client.id_doc_type}
              {client.id_doc_number && ` · ${client.id_doc_number}`}
            </InfoRow>
          )}
          {client.license_number && (
            <InfoRow label="Permis de conduire">
              <span className="flex flex-col items-end gap-0.5">
                <span>{client.license_number}</span>
                {client.license_expiry && (
                  <span className={`text-xs ${new Date(client.license_expiry) < new Date() ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                    Exp. {formatDate(client.license_expiry)}
                  </span>
                )}
              </span>
            </InfoRow>
          )}
          {client.license_categories?.length > 0 && (
            <InfoRow label="Catégories">
              {client.license_categories.join(', ')}
            </InfoRow>
          )}
        </div>
        {(idFrontUrl || idBackUrl || licFrontUrl || licBackUrl || addressUrl) && (
          <div className="mt-3">
            <ClientDocPhotos
              idFrontUrl={idFrontUrl}
              idBackUrl={idBackUrl}
              licFrontUrl={licFrontUrl}
              licBackUrl={licBackUrl}
              addressUrl={addressUrl}
            />
          </div>
        )}
      </div>

      {/* ─── Infos commerciales ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <SectionLabel>Infos commerciales</SectionLabel>
        <div>
          {client.usual_payment_method && (
            <InfoRow label="Mode de paiement habituel">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                {PAYMENT_LABELS[client.usual_payment_method] ?? client.usual_payment_method}
              </span>
            </InfoRow>
          )}
          {client.usual_deposit && (
            <InfoRow label="Caution habituelle">{formatPrice(client.usual_deposit)}</InfoRow>
          )}
          {(client.discount_percent ?? 0) > 0 && (
            <InfoRow label="Remise fidélité">
              <span className="text-green-600 font-bold">−{client.discount_percent}%</span>
            </InfoRow>
          )}
          {client.commercial_perks && (
            <InfoRow label="Avantages ciblés">
              <span className="text-gray-700 text-right whitespace-pre-line">{client.commercial_perks}</span>
            </InfoRow>
          )}
          {completed.length > 0 && (
            <InfoRow label="CA moyen / location">{formatPrice(avgCA)}</InfoRow>
          )}
          {completed.length > 0 && (
            <InfoRow label="CA total terminé">{formatPrice(totalCA)}</InfoRow>
          )}
        </div>
      </div>

      {/* ─── Notes internes ─── */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <SectionLabel>Notes internes</SectionLabel>
        <ClientNotesEditor clientId={client.id} notes={client.internal_notes ?? null} />
      </div>

      {/* ─── Historique des locations ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>
            Historique · {reservations?.length ?? 0}
          </SectionLabel>
        </div>

        {!reservations || reservations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune réservation</p>
        ) : (
          <div className="space-y-2">
            {reservations.map(r => {
              const v = (r as any).vehicle
              const startDate  = new Date(r.start_datetime)
              const endDate    = new Date(r.end_datetime)
              const hasIssue   = ['saisie_partielle', 'saisie_totale', 'litigieuse'].includes((r as any).deposit_status)
              const isUnpaid   = r.payment_status && r.payment_status !== 'paye' && r.status === 'terminee'
              return (
                <Link
                  key={r.id}
                  href={`/reservations/${r.id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    hasIssue ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    hasIssue ? 'bg-red-100 border border-red-200' : 'bg-white border border-gray-100'
                  }`}>
                    {hasIssue
                      ? <AlertTriangle className="w-4 h-4 text-red-500" />
                      : <Car className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                      <span>{(v as any)?.brand} {(v as any)?.model}</span>
                      <span className="font-mono text-xs font-normal text-gray-400">{(v as any)?.plate}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {startDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      {' → '}
                      {endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    {hasIssue && (
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mt-0.5">
                        Caution retenue
                      </p>
                    )}
                    {isUnpaid && !hasIssue && (
                      <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mt-0.5">
                        Impayé
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_RES[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    <span className={`text-xs font-bold ${isUnpaid ? 'text-orange-600' : 'text-gray-700'}`}>
                      {formatPrice(r.total_price)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Bouton modifier ─── */}
      <Link
        href={`/clients/${id}/edit`}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-white border border-gray-100 shadow-sm text-gray-700 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors active:scale-[.99]"
      >
        <Edit className="w-4 h-4" /> Modifier la fiche client
      </Link>

    </div>
  )
}
