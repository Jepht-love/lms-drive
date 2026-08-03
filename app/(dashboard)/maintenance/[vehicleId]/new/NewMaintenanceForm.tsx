'use client'

// ─── Formulaire de planification d'une intervention ───────────────────────────
//
// À quoi sert ce fichier : saisir un passage au garage. Deux usages dans un seul
// écran, décidé par Jeff le 01/08/2026 :
//   · aucun dégât coché  → entretien courant (vidange, révision, contrôle
//     technique), exactement le formulaire d'avant
//   · un ou plusieurs dégâts cochés → réparation. Le type de l'intervention se
//     déduit alors du premier dégât, et chaque dégât porte SON devis.
//
// Pourquoi un devis par dégât et non un devis global : le garage évalue
// séparément une portière et une vitre, et c'est cette évaluation que la
// comptabilité doit pouvoir lire. Un montant global obligerait à le répartir à la
// main, donc à inventer des chiffres.
//
// Plusieurs voitures dans un même rendez-vous (Jeff, remarque 38.C du
// 03/08/2026) : un « + » ouvre la liste, chaque voiture ajoutée arrive avec son
// kilométrage et ses dégâts en attente. Le formulaire envoie alors une LISTE de
// véhicules, et le serveur crée **une intervention par voiture** pour un seul
// créneau au calendrier. Chacune se clôture à son rythme : un garage qui rend une
// voiture le mardi et les autres le vendredi ne doit pas bloquer la comptabilité.
//
// Ce qu'il ne faut pas casser :
// - le devis n'écrit RIEN en comptabilité, la dépense n'existe qu'une fois le
//   garage payé (règle de Jeff du 01/08/2026) ;
// - le kilométrage et le montant sont portés PAR VOITURE. Un montant commun aux
//   trois voitures multiplierait la dépense par trois en comptabilité.

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, X } from 'lucide-react'
import DatePickerField from '@/components/ui/DatePickerField'
import TimePickerField from '@/components/ui/TimePickerField'
import { MAINTENANCE_TYPES, URGENCIES, type UrgencyKey } from '@/lib/maintenance'
import { createMaintenanceRecord } from '@/lib/actions/maintenance'
import { damageTypeLabel, damageOriginLabel } from '@/lib/vehicles/damage-catalog'
import { formatPrice } from '@/lib/utils'
import type { MaintenanceFlag } from '@/types/database'

/** Une voiture qu'on peut faire monter dans le rendez-vous. */
export interface VehiculeCandidat {
  id: string
  label: string
  plate: string | null
  currentKm: number | null
  damages: MaintenanceFlag[]
}

interface Props {
  vehicleId: string
  vehicleLabel: string
  vehiclePlate: string | null
  currentKm: number | null
  damages: MaintenanceFlag[]
  /** Dégâts déjà réparés : sert à distinguer « rien à réparer » de « rien saisi ». */
  repairedCount: number
  canSeeAmounts: boolean
  /** L'équipe à qui confier l'intervention, prestataires exclus. */
  equipe: { id: string; full_name: string | null }[]
  /** Les autres voitures actives, pour un rendez-vous à plusieurs. */
  autresVehicules: VehiculeCandidat[]
}

/** Ce qu'on saisit pour une voiture ajoutée au rendez-vous. */
interface SaisieVehicule {
  km: string
  amount: string
  /** flagId → devis saisi, en chaîne pour laisser le champ vide. */
  damages: Record<string, string>
}

export default function NewMaintenanceForm({
  vehicleId, vehicleLabel, vehiclePlate, currentKm, damages, repairedCount,
  canSeeAmounts, equipe, autresVehicules,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('revision')
  const [urgence, setUrgence] = useState<UrgencyKey>('normale')
  /** flagId → devis saisi (chaîne, pour laisser le champ vide tant qu'on ne sait pas). */
  const [choisis, setChoisis] = useState<Record<string, string>>({})
  /** Les voitures ajoutées au rendez-vous, dans l'ordre où on les a choisies. */
  const [ajoutes, setAjoutes] = useState<string[]>([])
  const [saisies, setSaisies] = useState<Record<string, SaisieVehicule>>({})
  const [listeOuverte, setListeOuverte] = useState(false)

  const ids = Object.keys(choisis)
  const enReparation = ids.length > 0

  const totalDevis = useMemo(
    () => ids.reduce((s, id) => s + (parseFloat((choisis[id] || '').replace(',', '.')) || 0), 0),
    [ids, choisis],
  )

  const parId = useMemo(
    () => new Map(autresVehicules.map(v => [v.id, v])),
    [autresVehicules],
  )
  const disponibles = autresVehicules.filter(v => !ajoutes.includes(v.id))

  function basculer(flagId: string) {
    setChoisis(prev => {
      const copie = { ...prev }
      if (flagId in copie) delete copie[flagId]
      // Le devis déjà saisi à la déclaration du dommage remonte ici tout seul
      // (Jeff, 02/08/2026) : il ne se ressaisit plus de mémoire.
      else {
        const dejaChiffre = damages.find(d => d.id === flagId)?.quote_amount
        copie[flagId] = dejaChiffre != null ? String(dejaChiffre) : ''
      }
      return copie
    })
  }

  function ajouterVehicule(id: string) {
    const v = parId.get(id)
    if (!v) return
    setAjoutes(prev => [...prev, id])
    setSaisies(prev => ({
      ...prev,
      [id]: { km: v.currentKm != null ? String(v.currentKm) : '', amount: '', damages: {} },
    }))
    setListeOuverte(false)
  }

  function retirerVehicule(id: string) {
    setAjoutes(prev => prev.filter(x => x !== id))
    setSaisies(prev => {
      const copie = { ...prev }
      delete copie[id]
      return copie
    })
  }

  function majSaisie(id: string, champ: 'km' | 'amount', valeur: string) {
    setSaisies(prev => ({ ...prev, [id]: { ...prev[id], [champ]: valeur } }))
  }

  function basculerDegat(vehiculeId: string, flagId: string) {
    setSaisies(prev => {
      const courant = prev[vehiculeId]
      if (!courant) return prev
      const copie = { ...courant.damages }
      if (flagId in copie) delete copie[flagId]
      else {
        const dejaChiffre = parId.get(vehiculeId)?.damages.find(d => d.id === flagId)?.quote_amount
        copie[flagId] = dejaChiffre != null ? String(dejaChiffre) : ''
      }
      return { ...prev, [vehiculeId]: { ...courant, damages: copie } }
    })
  }

  function majDevis(vehiculeId: string, flagId: string, valeur: string) {
    setSaisies(prev => ({
      ...prev,
      [vehiculeId]: { ...prev[vehiculeId], damages: { ...prev[vehiculeId].damages, [flagId]: valeur } },
    }))
  }

  const nombre = (txt: string) => parseFloat((txt || '').replace(',', '.')) || null

  function envoyer(e: React.FormEvent<HTMLFormElement>, statutDevis: 'brouillon' | 'valide') {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('quote_status', statutDevis)
    // Le véhicule de l'écran en premier : c'est lui qui reçoit le justificatif.
    formData.set('vehicles', JSON.stringify([
      {
        id: vehicleId,
        km: (formData.get('km_at_intervention') as string) ?? '',
        amount: (formData.get('amount') as string) ?? '',
        damages: ids.map(id => ({ flagId: id, quote: nombre(choisis[id]) })),
      },
      ...ajoutes.map(id => ({
        id,
        km: saisies[id]?.km ?? '',
        amount: saisies[id]?.amount ?? '',
        damages: Object.keys(saisies[id]?.damages ?? {}).map(f => ({
          flagId: f, quote: nombre(saisies[id].damages[f]),
        })),
      })),
    ]))
    startTransition(async () => {
      const res = await createMaintenanceRecord(formData)
      if (res?.error) setError(res.error)
      else router.push(`/maintenance/${vehicleId}`)
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <form onSubmit={e => envoyer(e, enReparation ? 'valide' : 'brouillon')} className="space-y-4">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      {/* Aucun dégât en attente : le DIRE, plutôt que de n'afficher rien du tout.
          Remarque de Jeff du 01/08/2026 : l'écran doit permettre de juger l'état
          d'un véhicule sans aller le regarder, et un écran vide ne distingue pas
          « tout est réparé » de « rien n'a été saisi ». */}
      {damages.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-900">Aucun dégât en attente</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {repairedCount > 0
              ? `Les ${repairedCount} dégât${repairedCount > 1 ? 's' : ''} de ce véhicule ${repairedCount > 1 ? 'ont' : 'a'} déjà été réparé${repairedCount > 1 ? 's' : ''}.`
              : "Rien n'a été signalé sur ce véhicule, ni par un état des lieux, ni à la main."}
            {' '}Cette intervention sera un entretien courant.
          </p>
        </div>
      )}

      {/* ── Dégâts en attente de réparation ─────────────────────────────────── */}
      {damages.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                {damages.length} dégât{damages.length > 1 ? 's' : ''} en attente
              </p>
              <p className="text-[11px] text-gray-400">
                Cochez ceux qui partent au garage, et saisissez le devis de chacun.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {damages.map(d => {
              const coche = d.id in choisis
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border p-3 transition-colors ${coche ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() => basculer(d.id)}
                      className="mt-0.5 w-4 h-4 accent-gray-900 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">{d.label}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5">
                        {damageTypeLabel(d.damage_type)} · {damageOriginLabel(d.origin)}
                        {canSeeAmounts && d.billed_amount != null && (
                          <> · facturé {formatPrice(d.billed_amount)} au client</>
                        )}
                      </span>
                    </span>
                  </label>

                  {coche && (
                    <div className="mt-2.5 pl-6.5 flex items-center gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 shrink-0" htmlFor={`devis-${d.id}`}>
                        Devis
                      </label>
                      <input
                        id={`devis-${d.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="montant du garage"
                        value={choisis[d.id]}
                        onChange={e => setChoisis(prev => ({ ...prev, [d.id]: e.target.value }))}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400"
                      />
                      <span className="text-sm text-gray-400">€</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {enReparation && totalDevis > 0 && (
            <p className="text-xs text-gray-500 pt-1">
              Devis total : <span className="font-bold text-gray-900">{formatPrice(totalDevis)}</span>.
              Rien n&apos;est enregistré en comptabilité tant que le garage n&apos;a pas été payé.
            </p>
          )}
        </div>
      )}

      {/* ── Les autres voitures du même rendez-vous (38.C) ────────────────────
          Une seule ligne au calendrier, une intervention par voiture. Chaque
          voiture ajoutée porte son kilométrage, son montant et ses dégâts. */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 flex-1 min-w-0">
            Véhicules du rendez-vous
          </span>
          <span className="text-[11px] text-gray-400 flex-shrink-0">
            {ajoutes.length + 1} voiture{ajoutes.length > 0 ? 's' : ''}
          </span>
        </div>

        <div className="rounded-xl border border-gray-100 px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900">{vehicleLabel}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {vehiclePlate ?? 'Sans plaque'} · saisi ci-dessus
          </p>
        </div>

        {ajoutes.map(id => {
          const v = parId.get(id)
          if (!v) return null
          const saisie = saisies[id]
          const cochesIci = Object.keys(saisie?.damages ?? {})
          return (
            <div key={id} className="rounded-xl border border-gray-200 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{v.label}</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">{v.plate ?? 'Sans plaque'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => retirerVehicule(id)}
                  className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 flex-shrink-0"
                  title="Retirer du rendez-vous"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls} htmlFor={`km-${id}`}>Km</label>
                  <input
                    id={`km-${id}`} type="number" min="0" inputMode="numeric"
                    value={saisie?.km ?? ''} onChange={e => majSaisie(id, 'km', e.target.value)}
                    placeholder="Kilométrage"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400"
                  />
                </div>
                {cochesIci.length === 0 && (
                  <div>
                    <label className={labelCls} htmlFor={`montant-${id}`}>Montant (€)</label>
                    <input
                      id={`montant-${id}`} type="number" step="0.01" min="0" inputMode="decimal"
                      value={saisie?.amount ?? ''} onChange={e => majSaisie(id, 'amount', e.target.value)}
                      placeholder="0"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400"
                    />
                  </div>
                )}
              </div>

              {v.damages.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-400">
                    {v.damages.length} dégât{v.damages.length > 1 ? 's' : ''} en attente sur cette voiture
                  </p>
                  {v.damages.map(d => {
                    const coche = d.id in (saisie?.damages ?? {})
                    return (
                      <div key={d.id} className={`rounded-lg border p-2.5 transition-colors ${coche ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox" checked={coche}
                            onChange={() => basculerDegat(id, d.id)}
                            className="mt-0.5 w-4 h-4 accent-gray-900 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-900">{d.label}</span>
                            <span className="block text-[11px] text-gray-400 mt-0.5">
                              {damageTypeLabel(d.damage_type)} · {damageOriginLabel(d.origin)}
                            </span>
                          </span>
                        </label>
                        {coche && (
                          <div className="mt-2 pl-6.5 flex items-center gap-2">
                            <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 shrink-0" htmlFor={`devis-${id}-${d.id}`}>
                              Devis
                            </label>
                            <input
                              id={`devis-${id}-${d.id}`} type="number" step="0.01" min="0" inputMode="decimal"
                              placeholder="montant du garage"
                              value={saisie.damages[d.id]}
                              onChange={e => majDevis(id, d.id, e.target.value)}
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400"
                            />
                            <span className="text-sm text-gray-400">€</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {listeOuverte ? (
          <div className="rounded-xl border border-gray-200 max-h-64 overflow-y-auto divide-y divide-gray-50">
            {disponibles.length === 0 ? (
              <p className="text-[11px] text-gray-400 px-3 py-3">Toutes les voitures sont déjà dans ce rendez-vous.</p>
            ) : disponibles.map(v => (
              <button
                key={v.id} type="button" onClick={() => ajouterVehicule(v.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{v.label}</span>
                  <span className="block text-[11px] text-gray-400">{v.plate ?? 'Sans plaque'}</span>
                </span>
                {v.damages.length > 0 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    {v.damages.length} dégât{v.damages.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setListeOuverte(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Ajouter un véhicule
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        {/* Type : masqué en réparation, il se déduit alors des dégâts cochés */}
        {!enReparation && (
          <div>
            <label className={labelCls} htmlFor="type">Type</label>
            <select id="type" name="type" className={inputCls} required
              value={type} onChange={e => setType(e.target.value)}>
              {MAINTENANCE_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="date">Date</label>
            <DatePickerField id="date" name="date" defaultValue={today} required className={inputCls} />
          </div>
          {/* L'heure du rendez-vous, saisissable depuis le 03/08/2026 (38.A).
              Tous les passages au garage se posaient à 8 h, quelle que soit
              l'heure réelle donnée par le garage. */}
          <div>
            <label className={labelCls} htmlFor="time">Heure</label>
            <TimePickerField id="time" name="time" defaultValue="08:00" className={inputCls} />
          </div>
        </div>

        {/* En réparation, le montant vient des devis ligne par ligne */}
        {!enReparation && (
          <div>
            <label className={labelCls} htmlFor="amount">Montant (€)</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0" className={inputCls} inputMode="decimal" />
          </div>
        )}

        {!enReparation && (
          <div>
            <label className={labelCls} htmlFor="description">Description</label>
            <input id="description" name="description" type="text" placeholder="Ex : remplacement plaquettes avant" className={inputCls} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="km_at_intervention">Km</label>
            {/* Prérempli avec le kilométrage connu du véhicule (demande de Jeff,
                01/08/2026) : il reste modifiable si le compteur a tourné depuis. */}
            <input id="km_at_intervention" name="km_at_intervention" type="number" min="0"
              defaultValue={currentKm ?? ''} placeholder="Kilométrage" className={inputCls} inputMode="numeric" />
          </div>
          <div>
            <label className={labelCls} htmlFor="provider">Garage</label>
            <input id="provider" name="provider" type="text" placeholder="Nom du garage…" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="notes">
            {!enReparation && type === 'autre' ? "Précisez le type d'intervention *" : 'Notes'}
          </label>
          <textarea id="notes" name="notes" rows={3} required={!enReparation && type === 'autre'}
            placeholder={!enReparation && type === 'autre' ? "Quel est ce type d'intervention ?" : 'Notes complémentaires…'}
            className={`${inputCls} resize-none ${!enReparation && type === 'autre' ? 'border-amber-200 bg-amber-50' : ''}`} />
        </div>

        {/* ── Le suivi du travail (02/08/2026) ───────────────────────────────
            Le gérant veut savoir qui fait quoi, pour quand, et à quel point ça
            presse. L'urgence décide de l'entrée dans les alertes : critique en
            urgent, haute en important, normale n'alerte pas. */}
        <div className="pt-1 border-t border-gray-100">
          <span className={`${labelCls} block pt-3`}>Urgence</span>
          <input type="hidden" name="urgency" value={urgence} />
          <div className="grid grid-cols-3 gap-2">
            {URGENCIES.map(u => (
              <button
                key={u.key}
                type="button"
                onClick={() => setUrgence(u.key)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  urgence === u.key
                    ? 'bg-[#111111] border-[#111111] text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgence === u.key ? 'bg-white' : u.dot}`} />
                {u.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {urgence === 'critique' ? 'Apparaîtra dans les alertes urgentes.'
              : urgence === 'haute' ? 'Apparaîtra dans les alertes importantes.'
              : "N'apparaîtra pas dans les alertes tant que la date limite n'est pas dépassée."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="due_date">Date limite (optionnel)</label>
            <DatePickerField id="due_date" name="due_date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="assigned_to">Confiée à</label>
            <select id="assigned_to" name="assigned_to" className={inputCls} defaultValue="">
              {/* Libellé court : « Personne pour l'instant » se coupait dans la
                  liste déroulante en largeur téléphone. */}
              <option value="">Personne</option>
              {equipe.map(m => (
                <option key={m.id} value={m.id}>{m.full_name ?? 'Sans nom'}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="justificatif">Justificatif (facture, devis…), optionnel</label>
          <input id="justificatif" name="justificatif" type="file" accept="image/*,application/pdf"
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:font-semibold file:text-xs" />
          <p className="text-[11px] text-gray-400 mt-1">Si joint, classé automatiquement dans Documents › Véhicule.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40"
        >
          {pending ? 'Enregistrement…' : enReparation ? 'Valider le devis' : "Enregistrer l'intervention"}
        </button>

        {enReparation && (
          <button
            type="submit"
            disabled={pending}
            onClick={e => {
              e.preventDefault()
              const form = (e.currentTarget as HTMLButtonElement).form
              if (form) envoyer({ preventDefault: () => {}, currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>, 'brouillon')
            }}
            className="w-full py-3 border border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Enregistrer en brouillon
          </button>
        )}
      </div>
    </form>
  )
}
