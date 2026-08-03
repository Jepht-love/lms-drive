'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Check, BadgeEuro, Trash2, UserRound, Pencil, ShieldAlert } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import {
  MAINTENANCE_TYPES, MAINTENANCE_ANGLES, maintenanceType, angleOfType,
  WORK_STATUSES, WORK_STATUSES_CLOS, workStatus, urgency,
  type MaintenanceRecord, type WorkStatusKey,
} from '@/lib/maintenance'
import { PAYMENT_METHODS, paymentMethodLabel } from '@/lib/accounting/categories'
import {
  markMaintenancePaid, deleteMaintenanceRecord, settleIntervention,
  prendreEnChargeIntervention, changerStatutIntervention, repondreDemandeMontant,
} from '@/lib/actions/maintenance'
import { useToast } from '@/components/Toast'
import { damageOriginLabel, damageTypeLabel } from '@/lib/vehicles/damage-catalog'
import type { MaintenanceFlag } from '@/types/database'

/**
 * Historique d'entretien d'un véhicule.
 *
 * `flags` porte les dégâts du véhicule : depuis le 01/08/2026 une intervention
 * peut en réparer plusieurs, et son règlement se saisit alors DÉGÂT PAR DÉGÂT,
 * chacun avec le montant réellement facturé par le garage. C'est ce qui permet à
 * la comptabilité de distinguer ce que le client a remboursé de ce que la société
 * a payé de sa poche. Une intervention sans dégât (vidange, contrôle technique)
 * garde l'ancien règlement en un seul montant.
 */
/** Une correction de montant qui attend la réponse d'un autre manager. */
export interface DemandeMontant {
  id: string
  maintenance_id: string
  requested_by: string
  old_amount: number
  new_amount: number
  reason: string
  requester?: { full_name: string | null } | null
}

export default function MaintenanceHistory({
  records,
  flags = [],
  canClose = false,
  currentUserId = null,
  demandes = [],
}: {
  records: MaintenanceRecord[]
  flags?: MaintenanceFlag[]
  /** Gérant, associé ou administrateur : eux seuls terminent ou annulent. */
  canClose?: boolean
  currentUserId?: string | null
  /** Les corrections de montant en attente, toutes interventions confondues. */
  demandes?: DemandeMontant[]
}) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [filter, setFilter] = useState<string>('tous')
  const [openPay, setOpenPay] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [openStatut, setOpenStatut] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  /** flagId → montant facturé par le garage, saisi à l'écran. */
  const [reels, setReels] = useState<Record<string, string>>({})

  function prendre(id: string) {
    startTransition(async () => {
      const r = await prendreEnChargeIntervention(id)
      if (r?.error) { toast(r.error, 'error'); return }
      router.refresh()
      toast('Vous vous en occupez')
    })
  }

  function repondre(id: string, decision: 'validee' | 'refusee') {
    startTransition(async () => {
      const r = await repondreDemandeMontant(id, decision)
      if (r?.error) { toast(r.error, 'error'); return }
      router.refresh()
      toast(decision === 'validee' ? 'Correction validée' : 'Correction refusée')
    })
  }

  function changerStatut(id: string, statut: WorkStatusKey) {
    startTransition(async () => {
      const r = await changerStatutIntervention(id, statut)
      if (r?.error) { toast(r.error, 'error'); return }
      setOpenStatut(null)
      router.refresh()
      toast(`Intervention ${workStatus(statut).label.toLowerCase()}`)
    })
  }

  function regler(recordId: string, degats: MaintenanceFlag[], method: string) {
    const lignes = degats.map(d => ({
      flagId: d.id,
      amount: parseFloat((reels[d.id] ?? '').replace(',', '.')) || 0,
    }))
    startTransition(async () => {
      const r = await settleIntervention(recordId, lignes, method)
      if (r?.error) { toast(r.error, 'error'); return }
      setOpenPay(null)
      router.refresh()
      toast('Réparation réglée et comptabilisée')
    })
  }

  const presentTypes = new Set(records.map(r => r.type))
  const filtered =
    filter === 'tous'            ? records
    : filter.startsWith('angle:') ? records.filter(r => angleOfType(r.type) === filter.slice(6))
    :                               records.filter(r => r.type === filter)

  // Budget par angle (Réparation / Usure / Entretien / Autre), ordre de priorité.
  const byAngle = MAINTENANCE_ANGLES
    .map(a => {
      const recs = records.filter(r => a.types.includes(r.type))
      return { ...a, total: recs.reduce((s, r) => s + (r.amount ?? 0), 0), count: recs.length }
    })
    .filter(a => a.count > 0)

  function pay(id: string, method: string) {
    startTransition(async () => {
      await markMaintenancePaid(id, method)
      setOpenPay(null)
      router.refresh()
    })
  }

  function del(id: string) {
    startTransition(async () => {
      const r = await deleteMaintenanceRecord(id)
      if (r?.error) { toast(r.error, 'error'); return }
      setConfirmDel(null)
      router.refresh()
      toast('Intervention supprimée')
    })
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
        <p className="text-sm text-gray-400 font-medium">Aucune intervention enregistrée</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Budget par angle · Réparation / Usure / Entretien, cliquable pour filtrer */}
      {byAngle.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {byAngle.map(a => {
            const active = filter === `angle:${a.id}`
            return (
              <button type="button"
                key={a.id}
                onClick={() => setFilter(active ? 'tous' : `angle:${a.id}`)}
                className={`text-left rounded-2xl border p-3 transition-colors active:scale-[.99] ${
                  active ? 'bg-[#111111] border-[#111111]' : 'bg-white border-gray-100 shadow-sm hover:bg-gray-50'
                }`}
              >
                <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${active ? 'text-white/70' : 'text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} /> {a.label}
                </span>
                <span className={`block text-base font-black mt-1 ${active ? 'text-white' : 'text-gray-900'}`}>{formatPrice(a.total)}</span>
                <span className={`block text-[11px] ${active ? 'text-white/60' : 'text-gray-400'}`}>{a.count} interv.</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filtres par type */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <button type="button"
          onClick={() => setFilter('tous')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
            filter === 'tous' ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          Tous ({records.length})
        </button>
        {MAINTENANCE_TYPES.filter(t => presentTypes.has(t.key)).map(t => {
          const n = records.filter(r => r.type === t.key).length
          return (
            <button type="button"
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${
                filter === t.key ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${filter === t.key ? 'bg-white' : t.dot}`} />
              {t.label} ({n})
            </button>
          )
        })}
      </div>

      {/* Liste interventions */}
      <div className="space-y-2">
        {filtered.map(r => {
          const t = maintenanceType(r.type)
          const amount = r.amount ?? 0
          const degats = flags.filter(f => f.intervention_id === r.id)
          const aRegler = degats.filter(f => !f.repaired_at)
          // ── Le suivi du travail (02/08/2026) ────────────────────────────────
          const etat = workStatus(r.work_status)
          const niv  = urgency(r.urgency)
          const qui  = r.taker?.full_name ?? null
          const designe = r.assignee?.full_name ?? null
          const echeanceDepassee = Boolean(
            r.due_date && etat.ouvert && new Date(`${r.due_date}T23:59:59`) < new Date(),
          )
          const librePourMoi = etat.ouvert && !r.taken_by
          const cestMoi = Boolean(currentUserId && r.taken_by === currentUserId)
          const demande = demandes.find(d => d.maintenance_id === r.id)
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  {/* Une intervention qui répare des dégâts n'a PAS de type
                      unique : elle porte une carrosserie, un pneu et une vitre à
                      la fois. L'étiquette annonçait « CARROSSERIE » pour tout,
                      déduite du premier dégât, ce qui était faux et trompeur
                      (Jeff, 02/08/2026). On liste les natures réelles à la
                      place. */}
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                    {degats.length > 0
                      ? [...new Set(degats.map(d => damageTypeLabel(d.damage_type)))].join(' · ')
                      : t.label}
                  </span>
                  {r.description && (
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{r.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-sm font-black text-gray-900">{formatPrice(amount)}</span>
                  {/* Le crayon rouvre l'intervention préremplie. Avant le
                      02/08/2026 il fallait la supprimer et la ressaisir, ce qui
                      effaçait au passage son écriture comptable. */}
                  {/* `inline-flex items-center` est indispensable : sans lui,
                      l'icône d'un lien se pose sur la ligne de base du texte et
                      tombait 8 px plus haut que celle du bouton voisin, qui est
                      centrée (Jeff, 02/08/2026). */}
                  <Link
                    href={`/maintenance/${r.vehicle_id}/${r.id}/edit`}
                    className="p-1.5 inline-flex items-center justify-center text-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button type="button"
                    onClick={() => setConfirmDel(confirmDel === r.id ? null : r.id)}
                    className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                <span>{formatDate(r.date)}</span>
                {r.km_at_intervention != null && (
                  <>
                    <span>·</span>
                    <span>{r.km_at_intervention.toLocaleString('fr-FR')} km</span>
                  </>
                )}
                {r.provider && (
                  <>
                    <span>·</span>
                    <span>{r.provider}</span>
                  </>
                )}
              </div>
              {/* ── Où en est le travail ────────────────────────────────────
                  Trois informations sur une ligne : l'état, l'urgence quand
                  elle n'est pas normale, l'échéance quand il y en a une. Les
                  pastilles sont en largeur fixe pour que deux interventions
                  l'une sous l'autre restent alignées (règle du 02/08/2026). */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full inline-flex items-center justify-center w-[112px] ${etat.badge}`}>
                  <span className="truncate">{etat.label}</span>
                </span>
                {niv.key !== 'normale' && etat.ouvert && (
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full inline-flex items-center justify-center w-[76px] ${niv.badge}`}>
                    <span className="truncate">{niv.label}</span>
                  </span>
                )}
                {r.due_date && etat.ouvert && (
                  <span className={`text-[11px] font-semibold ${echeanceDepassee ? 'text-red-600' : 'text-gray-400'}`}>
                    {echeanceDepassee ? 'Échéance dépassée le ' : 'Pour le '}{formatDate(r.due_date)}
                  </span>
                )}
              </div>

              {/* Qui s'en charge. « Confiée à » est la personne désignée à la
                  création, « s'en occupe » celle qui s'est mise dessus : les
                  deux peuvent différer, et c'est une information utile. */}
              <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                <UserRound className="w-3 h-3 flex-shrink-0" />
                {/* Le libellé exact demandé par le gérant : « Pris en charge
                    par… ». Ne pas le reformuler. */}
                {qui
                  ? <span className="font-medium text-gray-600">Pris en charge par {qui}</span>
                  : designe
                    ? <span>Confiée à {designe}, personne ne s&apos;en est encore saisi</span>
                    : <span className="font-semibold text-amber-600">Personne ne s&apos;en occupe</span>}
              </p>

              {r.notes && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed whitespace-pre-wrap">{r.notes}</p>
              )}
              {r.invoice_url && (
                <a
                  href={r.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-500 underline mt-2"
                >
                  <FileText className="w-3 h-3" /> Voir la facture
                </a>
              )}

              {/* ── Une correction de montant attend une réponse ────────────
                  Contrôle anti-fraude voulu par Jeff : rien ne bouge tant qu'un
                  AUTRE gérant ou associé n'a pas répondu, et personne ne valide
                  sa propre demande. Le bouton est donc masqué à l'auteur. */}
              {demande && (
                <div className="mt-3 pt-3 border-t border-amber-100 bg-amber-50 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    Correction en attente : {formatPrice(demande.old_amount)} → {formatPrice(demande.new_amount)}
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {demande.reason}
                    {demande.requester?.full_name ? ` · demandée par ${demande.requester.full_name}` : ''}
                  </p>
                  {canClose && demande.requested_by !== currentUserId ? (
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" disabled={pending}
                        onClick={() => repondre(demande.id, 'validee')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-40">
                        Valider
                      </button>
                      <button type="button" disabled={pending}
                        onClick={() => repondre(demande.id, 'refusee')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-800 disabled:opacity-40">
                        Refuser
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 mt-1.5">
                      {demande.requested_by === currentUserId
                        ? 'Vous ne pouvez pas valider votre propre correction.'
                        : 'Un gérant ou un associé doit répondre.'}
                    </p>
                  )}
                </div>
              )}

              {/* ── Faire avancer le travail ────────────────────────────────
                  « Je prends en charge » inscrit son nom et passe l'intervention
                  en « prise en charge » : sur le terrain, celui qui voit le
                  problème est celui qui s'en occupe (Jeff, 02/08/2026).
                  Terminer et annuler restent aux gérants et associés, parce que
                  la clôture engage un montant. */}
              {etat.ouvert && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  {librePourMoi && (
                    <button type="button"
                      onClick={() => prendre(r.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#111111] rounded-lg px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40"
                    >
                      <UserRound className="w-3.5 h-3.5" /> Je prends en charge
                    </button>
                  )}
                  {cestMoi && (
                    <span className="text-[11px] font-semibold text-blue-600">Vous vous en occupez</span>
                  )}
                  <button type="button"
                    onClick={() => setOpenStatut(openStatut === r.id ? null : r.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 ml-auto"
                  >
                    Changer l&apos;état
                  </button>
                </div>
              )}

              {openStatut === r.id && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WORK_STATUSES.map(s => {
                    const interdit = WORK_STATUSES_CLOS.includes(s.key) && !canClose
                    // `inline-flex items-center` parce que « Terminée » est un
                    // lien et les cinq autres des boutons : sans ça son texte se
                    // pose sur la ligne de base et la pastille ne tombe pas à la
                    // même hauteur que ses voisines (Jeff, 02/08/2026).
                    const cls = `px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 inline-flex items-center justify-center ${
                      s.key === r.work_status
                        ? 'bg-[#111111] border-[#111111] text-white'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`
                    // « Terminée » n'est pas un simple changement d'état : elle
                    // ouvre le compte rendu de ce qui a été fait, que le gérant
                    // exige (02/08/2026). On ne clôt plus sans le remplir.
                    if (s.key === 'terminee' && !interdit) {
                      return (
                        <Link key={s.key} href={`/maintenance/${r.vehicle_id}/${r.id}/cloture`} className={cls}>
                          {s.label}
                        </Link>
                      )
                    }
                    return (
                      <button type="button"
                        key={s.key}
                        disabled={pending || interdit || s.key === r.work_status}
                        onClick={() => changerStatut(r.id, s.key)}
                        title={interdit ? 'Réservé au gérant et aux associés' : undefined}
                        className={cls}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Réparation de dégâts : le règlement se saisit ligne par ligne, et
                  c'est LUI qui crée les écritures comptables. Rien n'a été écrit
                  au devis. */}
              {aRegler.length > 0 && !r.paid_at && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {openPay === r.id ? (
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Montant facturé par le garage
                      </p>
                      {aRegler.map(d => (
                        <div key={d.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-gray-900 truncate">{d.label}</span>
                            <span className="block text-[11px] text-gray-400">
                              {damageOriginLabel(d.origin)}
                              {d.quote_amount != null && <> · devis {formatPrice(d.quote_amount)}</>}
                            </span>
                          </span>
                          <input
                            type="number" step="0.01" min="0" inputMode="decimal"
                            value={reels[d.id] ?? ''}
                            onChange={e => setReels(prev => ({ ...prev, [d.id]: e.target.value }))}
                            placeholder={d.quote_amount != null ? String(d.quote_amount) : 'montant'}
                            className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-gray-400"
                          />
                          <span className="text-xs text-gray-400">€</span>
                        </div>
                      ))}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-1">Mode de règlement</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_METHODS.map(m => (
                          <button type="button"
                            key={m.id}
                            disabled={pending}
                            onClick={() => regler(r.id, aRegler, m.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        {aRegler.length} dégât{aRegler.length > 1 ? 's' : ''} au garage, pas encore facturé
                      </span>
                      <button type="button"
                        onClick={() => setOpenPay(r.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 shrink-0"
                      >
                        <BadgeEuro className="w-3.5 h-3.5" /> Saisir la facture
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Entretien courant : règlement en un seul montant (inchangé) */}
              {amount > 0 && aRegler.length === 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {r.paid_at ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
                      <Check className="w-3.5 h-3.5" />
                      Payé{r.paid_method ? ` · ${paymentMethodLabel(r.paid_method)}` : ''}, comptabilisé
                    </span>
                  ) : openPay === r.id ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Mode de paiement</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_METHODS.map(m => (
                          <button type="button"
                            key={m.id}
                            disabled={pending}
                            onClick={() => pay(r.id, m.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button type="button"
                      onClick={() => setOpenPay(r.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
                    >
                      <BadgeEuro className="w-3.5 h-3.5" /> Marquer payé
                    </button>
                  )}
                </div>
              )}

              {confirmDel === r.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-1">Supprimer cette intervention ?{r.paid_at ? ' La charge compta liée sera aussi retirée.' : ''}</span>
                  <button type="button" onClick={() => setConfirmDel(null)} disabled={pending} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40">Annuler</button>
                  <button type="button" onClick={() => del(r.id)} disabled={pending} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-40">Supprimer</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
