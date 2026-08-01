'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { reportVehicleIssues } from '@/lib/actions/vehicle-issues'
import { useToast } from '@/components/Toast'
import type { MaintenanceFlag } from '@/types/database'
import DamageRow from '@/components/vehicles/DamageRow'
import { formatPrice } from '@/lib/utils'
import {
  DAMAGE_TYPES_FACTURABLES, DAMAGE_TYPES_PANNES, damageTypeLabel,
  DAMAGE_ORIGINS_MANUELLES, damageOriginLabel,
} from '@/lib/vehicles/damage-catalog'

// « Dommages » — la liste des dégâts d'un véhicule et leur saisie à la main. Les
// dégâts constatés à un état des lieux de retour arrivent ici tout seuls, avec
// leur type, leur origine et ce qui a été facturé au client.
//
// Ce bloc s'affiche AVANT le bouton d'intervention (demande de Jeff du
// 01/08/2026) : on constate les dommages d'abord, on planifie le garage ensuite.
// Le vocabulaire « fait » a disparu au profit de « dommage », le seul mot employé
// partout ailleurs dans l'application.
//
// Ce que l'écran attend : la liste rangée dans `vehicles.maintenance_flags`.
// Ce qu'il produit : un dégât de plus, via reportVehicleIssues.
//
// Trois choses à ne pas casser :
//   · Le TYPE est obligatoire à la saisie. Sans lui, on ne saurait ni chiffrer le
//     dégât, ni le ranger dans le bon poste comptable au moment de le réparer.
//   · L'ORIGINE dit qui paie. « Location » ne se choisit pas ici : elle est posée
//     par l'état des lieux ou le sinistre. Un fait saisi à la main est forcément
//     de l'usure, de l'usage interne, ou d'origine inconnue.
//   · Un dégât RÉPARÉ reste affiché, dans sa propre section : c'est l'historique
//     du véhicule, et ce qui permet de comparer encaissé et dépensé.
//
// Les montants ne sont visibles que du gérant et des associés (`canSeeAmounts`).

const SEVERITIES: { id: MaintenanceFlag['severity']; label: string; cls: string }[] = [
  { id: 'attention', label: 'À surveiller', cls: 'bg-orange-100 text-orange-700' },
  { id: 'rayure',    label: 'Rayure',       cls: 'bg-yellow-100 text-yellow-700' },
  { id: 'dommage',   label: 'Dommage',      cls: 'bg-red-100 text-red-700' },
]

interface Props {
  vehicleId: string
  flags: MaintenanceFlag[]
  canSeeAmounts: boolean
}

export default function VehicleFacts({ vehicleId, flags, canSeeAmounts }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [damageType, setDamageType] = useState('')
  const [origin, setOrigin] = useState('usure')
  const [severity, setSeverity] = useState<MaintenanceFlag['severity']>('attention')
  const [showRepaired, setShowRepaired] = useState(false)
  const [pending, startTransition] = useTransition()

  const actifs = flags.filter(f => !f.repaired_at)
  const repares = flags.filter(f => f.repaired_at)

  function add() {
    const l = label.trim()
    if (!l || !damageType) return
    startTransition(async () => {
      const r = await reportVehicleIssues(vehicleId, [{
        category: 'manuel',
        label: l,
        severity,
        source: 'manuel',
        source_id: null,
        damage_type: damageType,
        origin,
        // Un fait saisi à la main n'est rattaché à aucune réservation et n'a rien
        // été facturé : c'est un coût pour la société, pas une recette.
        reservation_id: null,
        billed_amount: null,
      }])
      if (r?.error) { toast(r.error, 'error'); return }
      setLabel(''); setDamageType(''); setOrigin('usure'); setSeverity('attention'); setAdding(false)
      router.refresh()
      toast('Dommage ajouté')
    })
  }

  return (
    <>
      {/* Le bouton vit HORS de l'encadré, pour faire exactement la même largeur que
          « Ajouter une intervention » et que les blocs de la page. Il tient aussi
          lieu de titre : un intitulé au-dessus ferait doublon. Demandes de Jeff du
          01/08/2026. */}
      {!adding && (
        <button type="button"
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99]"
        >
          <Plus className="w-4 h-4" /> Déclarer un dommage
        </button>
      )}

    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {adding && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
          <div>
            <label htmlFor="vehicle-fact-label" className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Dommage constaté</label>
            <input
              id="vehicle-fact-label"
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex : plaquette de frein avant usée"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          <div>
            <label htmlFor="vehicle-fact-type" className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">De quoi il s&apos;agit</label>
            <select
              id="vehicle-fact-type"
              value={damageType}
              onChange={e => setDamageType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">Choisir…</option>
              <optgroup label="Dégâts facturables au client">
                {DAMAGE_TYPES_FACTURABLES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Pannes mécaniques (jamais facturées)">
                {DAMAGE_TYPES_PANNES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <p className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">D&apos;où ça vient</p>
            <div className="flex flex-wrap gap-1.5">
              {DAMAGE_ORIGINS_MANUELLES.map(o => (
                <button type="button"
                  key={o.id}
                  onClick={() => setOrigin(o.id)}
                  title={o.hint}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                    origin === o.id ? 'border-[#111111] bg-[#111111] text-white' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Gravité</p>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITIES.map(s => (
                <button type="button"
                  key={s.id}
                  onClick={() => setSeverity(s.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                    severity === s.id ? `border-[#111111] ${s.cls}` : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button"
              onClick={() => { setAdding(false); setLabel(''); setDamageType('') }}
              disabled={pending}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40"
            >
              Annuler
            </button>
            <button type="button"
              onClick={add}
              disabled={pending || !label.trim() || !damageType}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {actifs.length === 0 ? (
        !adding && <p className="text-xs text-gray-400">Aucun dommage en attente. Ajoutez une usure ou un point à surveiller.</p>
      ) : (
        <div className="space-y-1.5">
          {actifs.map(f => (
            <div key={f.id} className="space-y-0.5">
              <DamageRow flag={f} />
              <p className="text-[10px] text-gray-400 px-1">
                {damageTypeLabel(f.damage_type)} · {damageOriginLabel(f.origin)}
                {canSeeAmounts && f.billed_amount != null && (
                  <span className="text-emerald-600 font-semibold"> · facturé {formatPrice(f.billed_amount)}</span>
                )}
                {canSeeAmounts && f.origin === 'location' && f.billed_amount == null && (
                  <span className="text-gray-400"> · non facturé</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}


      {/* Les dégâts réparés restent consultables, repliés par défaut : ils ne sont
          plus une action à mener, mais ils portent l'historique du véhicule et la
          comparaison entre ce qui a été facturé et ce que la réparation a coûté. */}
      {repares.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <button type="button"
            onClick={() => setShowRepaired(v => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 py-1"
          >
            <span>Déjà réparés ({repares.length})</span>
            {showRepaired ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showRepaired && (
            <div className="space-y-1.5 pt-1.5">
              {repares.map(f => (
                <div key={f.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-600">{f.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {damageTypeLabel(f.damage_type)} · {damageOriginLabel(f.origin)} · réparé le{' '}
                    {new Date(f.repaired_at as string).toLocaleDateString('fr-FR')}
                    {canSeeAmounts && (
                      <>
                        {f.billed_amount != null && (
                          <span className="text-emerald-600 font-semibold"> · facturé {formatPrice(f.billed_amount)}</span>
                        )}
                        {f.repair_cost != null && (
                          <span className="text-red-500 font-semibold"> · coûté {formatPrice(f.repair_cost)}</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
