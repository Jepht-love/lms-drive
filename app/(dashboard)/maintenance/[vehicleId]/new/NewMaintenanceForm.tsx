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
// Ce qu'il ne faut pas casser : le devis n'écrit RIEN en comptabilité. La dépense
// n'existe qu'une fois le garage payé (règle de Jeff du 01/08/2026). Ne jamais
// ajouter ici d'écriture comptable.

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import DatePickerField from '@/components/ui/DatePickerField'
import { MAINTENANCE_TYPES, URGENCIES, type UrgencyKey } from '@/lib/maintenance'
import { createMaintenanceRecord } from '@/lib/actions/maintenance'
import { damageTypeLabel, damageOriginLabel } from '@/lib/vehicles/damage-catalog'
import { formatPrice } from '@/lib/utils'
import type { MaintenanceFlag } from '@/types/database'

interface Props {
  vehicleId: string
  currentKm: number | null
  damages: MaintenanceFlag[]
  /** Dégâts déjà réparés : sert à distinguer « rien à réparer » de « rien saisi ». */
  repairedCount: number
  canSeeAmounts: boolean
  /** L'équipe à qui confier l'intervention, prestataires exclus. */
  equipe: { id: string; full_name: string | null }[]
}

export default function NewMaintenanceForm({ vehicleId, currentKm, damages, repairedCount, canSeeAmounts, equipe }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('revision')
  const [urgence, setUrgence] = useState<UrgencyKey>('normale')
  /** flagId → devis saisi (chaîne, pour laisser le champ vide tant qu'on ne sait pas). */
  const [choisis, setChoisis] = useState<Record<string, string>>({})

  const ids = Object.keys(choisis)
  const enReparation = ids.length > 0

  const totalDevis = useMemo(
    () => ids.reduce((s, id) => s + (parseFloat((choisis[id] || '').replace(',', '.')) || 0), 0),
    [ids, choisis],
  )

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

  function envoyer(e: React.FormEvent<HTMLFormElement>, statutDevis: 'brouillon' | 'valide') {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('quote_status', statutDevis)
    formData.set(
      'damage_flags',
      JSON.stringify(ids.map(id => ({
        flagId: id,
        quote: parseFloat((choisis[id] || '').replace(',', '.')) || null,
      }))),
    )
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
          {/* En réparation, le montant vient des devis ligne par ligne */}
          {!enReparation && (
            <div>
              <label className={labelCls} htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0" className={inputCls} inputMode="decimal" />
            </div>
          )}
        </div>

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
