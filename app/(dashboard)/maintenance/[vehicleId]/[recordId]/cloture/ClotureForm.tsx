'use client'

// ─── Formulaire de compte rendu d'intervention ────────────────────────────────
//
// À quoi sert ce fichier : saisir ce qui a été fait au garage, une fois le
// véhicule revenu. C'est la liste exacte demandée par le gérant le 02/08/2026.
//
// Ce qu'il produit : un appel à `cloturerIntervention`, qui complète
// l'intervention, enregistre ses pièces, range la facture dans Documents et
// passe le travail en « terminée ».
//
// Le coût total se calcule tout seul (pièces + main d'œuvre) mais reste
// modifiable : un garage facture parfois un forfait qui ne se décompose pas.
// Sur une réparation de dégâts, il vient du règlement et n'apparaît pas ici.

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import DatePickerField from '@/components/ui/DatePickerField'
import { formatPrice } from '@/lib/utils'
import { totalPieces, type MaintenancePart, type MaintenanceRecord } from '@/lib/maintenance'
import { cloturerIntervention } from '@/lib/actions/maintenance'
import { useToast } from '@/components/Toast'

interface Props {
  vehicleId: string
  record: MaintenanceRecord
  parts: MaintenancePart[]
  currentKm: number | null
  reparationDeDegats: boolean
}

export default function ClotureForm({ vehicleId, record, parts, currentKm, reparationDeDegats }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lignes, setLignes] = useState<MaintenancePart[]>(parts)
  const [labor, setLabor] = useState(record.labor_cost != null ? String(record.labor_cost) : '')
  const [total, setTotal] = useState(record.amount ? String(record.amount) : '')
  /** Le total suit le détail tant que personne ne l'a écrit à la main. */
  const [totalForce, setTotalForce] = useState(Boolean(record.amount))

  const prixPieces = useMemo(() => totalPieces(lignes), [lignes])
  const prixLabor = parseFloat((labor || '0').replace(',', '.')) || 0
  const totalCalcule = prixPieces + prixLabor
  const totalAffiche = totalForce ? total : (totalCalcule > 0 ? String(totalCalcule) : '')

  function ajouterLigne() {
    setLignes(l => [...l, { label: '', quantity: 1, unit_price: 0 }])
  }
  function majLigne(i: number, champ: keyof MaintenancePart, valeur: string) {
    setLignes(l => l.map((p, j) => j === i
      ? { ...p, [champ]: champ === 'label' ? valeur : (parseFloat(valeur.replace(',', '.')) || 0) }
      : p))
  }
  function retirerLigne(i: number) {
    setLignes(l => l.filter((_, j) => j !== i))
  }

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('parts', JSON.stringify(lignes))
    formData.set('amount', totalAffiche || '0')
    startTransition(async () => {
      const res = await cloturerIntervention(record.id, formData)
      if (res?.error) { setError(res.error); return }
      toast('Intervention clôturée')
      router.push(`/maintenance/${vehicleId}`)
    })
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <form onSubmit={envoyer} className="space-y-4">

      {/* ── Ce qui a été fait ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <label className={labelCls} htmlFor="description">Nature exacte de l&apos;intervention *</label>
          <input id="description" name="description" type="text" required className={inputCls}
            defaultValue={record.description ?? ''}
            placeholder="Ex : remplacement des plaquettes et disques avant" />
        </div>

        {/* Une seule colonne sur téléphone : à 390 px, « Garage ou prestataire »
            passait sur deux lignes et son champ ne tombait plus à la même
            hauteur que celui de la date juste à côté. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="provider">Garage ou prestataire *</label>
            <input id="provider" name="provider" type="text" required className={inputCls}
              defaultValue={record.provider ?? ''} placeholder="Nom du garage…" />
          </div>
          <div>
            <label className={labelCls} htmlFor="date">Date de l&apos;intervention *</label>
            <DatePickerField id="date" name="date" defaultValue={record.date} required className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="km_at_intervention">Kilométrage du véhicule *</label>
          <input id="km_at_intervention" name="km_at_intervention" type="number" min="0" required
            inputMode="numeric" className={inputCls}
            defaultValue={record.km_at_intervention ?? currentKm ?? ''} placeholder="Kilométrage relevé" />
        </div>
      </div>

      {/* ── Pièces remplacées ou réparées ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Pièces remplacées ou réparées
          </span>
          <button type="button" onClick={ajouterLigne}
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>

        {lignes.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            Rien pour l&apos;instant. Une ligne par pièce : son nom, la quantité, son prix unitaire.
          </p>
        ) : (
          <div className="space-y-2">
            {lignes.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={p.label} onChange={e => majLigne(i, 'label', e.target.value)}
                  placeholder="Nom de la pièce"
                  className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400" />
                <input type="number" step="0.5" min="0" inputMode="decimal" aria-label="Quantité"
                  value={p.quantity} onChange={e => majLigne(i, 'quantity', e.target.value)}
                  className="w-14 flex-shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-900 text-center focus:outline-none focus:border-gray-400" />
                <input type="number" step="0.01" min="0" inputMode="decimal" aria-label="Prix unitaire"
                  value={p.unit_price} onChange={e => majLigne(i, 'unit_price', e.target.value)}
                  className="w-20 flex-shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-900 focus:outline-none focus:border-gray-400" />
                <button type="button" onClick={() => retirerLigne(i)}
                  className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 flex-shrink-0"
                  title="Retirer cette pièce">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ce que ça a coûté ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Prix des pièces</span>
          <span className="text-sm font-black text-gray-900">{formatPrice(prixPieces)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="labor_cost">Main d&apos;œuvre (€)</label>
            <input id="labor_cost" name="labor_cost" type="number" step="0.01" min="0" inputMode="decimal"
              value={labor} onChange={e => setLabor(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          {!reparationDeDegats && (
            <div>
              <label className={labelCls} htmlFor="amount">Coût total (€)</label>
              <input id="amount" type="number" step="0.01" min="0" inputMode="decimal"
                value={totalAffiche}
                onChange={e => { setTotalForce(true); setTotal(e.target.value) }}
                className={inputCls} />
            </div>
          )}
        </div>

        {!reparationDeDegats && totalForce && Math.abs((parseFloat(total || '0') || 0) - totalCalcule) > 0.5 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
            Le détail fait {formatPrice(totalCalcule)}, vous avez saisi {formatPrice(parseFloat(total || '0') || 0)}.
            Ce n&apos;est pas bloquant, mais vérifiez que rien ne manque.
          </p>
        )}

        {reparationDeDegats && (
          <p className="text-[11px] text-gray-400">
            Le coût total de cette réparation vient du règlement, dégât par dégât. Il ne se
            saisit pas ici.
          </p>
        )}
      </div>

      {/* ── Observations et justificatif ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <label className={labelCls} htmlFor="notes">Observations complémentaires</label>
          <textarea id="notes" name="notes" rows={3} className={`${inputCls} resize-none`}
            defaultValue={record.notes ?? ''}
            placeholder="Ce que le garage a signalé, ce qu'il faudra surveiller…" />
        </div>

        <div>
          <label className={labelCls} htmlFor="justificatif">Facture ou justificatif, si disponible</label>
          <input id="justificatif" name="justificatif" type="file" accept="image/*,application/pdf"
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:font-semibold file:text-xs" />
          <p className="text-[11px] text-gray-400 mt-1">Classé automatiquement dans Documents › Véhicule.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      <button type="submit" disabled={pending}
        className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
        {pending ? 'Enregistrement…' : "Clôturer l'intervention"}
      </button>
      <p className="text-[11px] text-gray-400 text-center">
        L&apos;intervention passera en « terminée » et sortira des alertes. Le règlement du
        garage reste un geste à part.
      </p>
    </form>
  )
}
