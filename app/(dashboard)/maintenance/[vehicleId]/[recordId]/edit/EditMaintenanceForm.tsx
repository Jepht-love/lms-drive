'use client'

// ─── Formulaire de modification d'une intervention ────────────────────────────
//
// À quoi sert ce fichier : rouvrir une intervention pour la corriger, et
// détailler la facture du garage pièce par pièce.
//
// Trois règles portées par cet écran, toutes voulues par Jeff le 02/08/2026 :
//   · toucher au montant exige un motif écrit, le reste se modifie librement ;
//   · les pièces se saisissent ligne par ligne (nom, quantité, prix unitaire),
//     jamais en texte libre : c'est ce qui permettra de comparer deux garages ;
//   · au-delà de 20 % ou 20 € d'écart, et si l'agence a allumé le contrôle, la
//     correction part en demande de validation au lieu de s'appliquer.
//
// Ce qu'il ne faut pas casser : quand l'intervention répare des dégâts, le
// montant total vient du règlement dégât par dégât. Le champ est alors masqué,
// et le détail des pièces reste une information, pas une source de vérité.

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ShieldAlert } from 'lucide-react'
import DatePickerField from '@/components/ui/DatePickerField'
import { formatPrice } from '@/lib/utils'
import {
  URGENCIES, totalPieces, correctionSoumiseAControle, WORK_STATUSES_CLOS,
  type MaintenancePart, type MaintenanceRecord, type UrgencyKey,
} from '@/lib/maintenance'
import { updateMaintenanceRecord } from '@/lib/actions/maintenance'
import { useToast } from '@/components/Toast'

interface Props {
  vehicleId: string
  record: MaintenanceRecord
  parts: MaintenancePart[]
  equipe: { id: string; full_name: string | null }[]
  demandeEnAttente: { id: string; old_amount: number; new_amount: number; reason: string } | null
  reparationDeDegats: boolean
}

export default function EditMaintenanceForm({
  vehicleId, record, parts, equipe, demandeEnAttente, reparationDeDegats,
}: Props) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [urgence, setUrgence] = useState<UrgencyKey>(record.urgency ?? 'normale')
  const [lignes, setLignes] = useState<MaintenancePart[]>(
    parts.length > 0 ? parts : [],
  )
  const [labor, setLabor] = useState(record.labor_cost != null ? String(record.labor_cost) : '')
  const [montant, setMontant] = useState(record.amount != null ? String(record.amount) : '')

  // Une intervention encore ouverte n'a rien à facturer : le détail de la
  // facture appartient au compte rendu de clôture, pas à cet écran.
  const estOuverte = !WORK_STATUSES_CLOS.includes(record.work_status ?? 'a_traiter')
  const totalDesPieces = useMemo(() => totalPieces(lignes), [lignes])
  const totalDetaille = totalDesPieces + (parseFloat((labor || '0').replace(',', '.')) || 0)
  const ancien = record.amount ?? 0
  const nouveau = parseFloat((montant || '0').replace(',', '.')) || 0
  const montantChange = Math.abs(nouveau - ancien) > 0.004
  const passeAuControle = montantChange && ancien > 0 && correctionSoumiseAControle(ancien, nouveau)
  // Le détail doit expliquer le total. On le signale sans bloquer : un garage
  // facture parfois un forfait qui ne se décompose pas ligne à ligne.
  const ecartDetail = (lignes.length > 0 || labor)
    && Math.abs(totalDetaille - (reparationDeDegats ? ancien : nouveau)) > 0.5

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
    formData.set('urgency', urgence)
    if (reparationDeDegats) formData.delete('amount')
    startTransition(async () => {
      const res = await updateMaintenanceRecord(record.id, formData)
      if (res?.error) { setError(res.error); return }
      toast(res?.enAttente
        ? 'Correction envoyée pour validation'
        : 'Intervention modifiée')
      router.push(`/maintenance/${vehicleId}`)
    })
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <form onSubmit={envoyer} className="space-y-4">

      {demandeEnAttente && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" /> Une correction attend une validation
          </p>
          <p className="text-xs text-amber-800 mt-1">
            {formatPrice(demandeEnAttente.old_amount)} → {formatPrice(demandeEnAttente.new_amount)} ·
            {' '}{demandeEnAttente.reason}
          </p>
          <p className="text-[11px] text-amber-700 mt-1">
            Tant qu&apos;un autre gérant ou associé n&apos;a pas répondu, le montant reste inchangé.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <label className={labelCls} htmlFor="description">Description</label>
          <input id="description" name="description" type="text" className={inputCls}
            defaultValue={record.description ?? ''} placeholder="Ex : remplacement plaquettes avant" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="date">Date</label>
            <DatePickerField id="date" name="date" defaultValue={record.date} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="km_at_intervention">Km</label>
            <input id="km_at_intervention" name="km_at_intervention" type="number" min="0" inputMode="numeric"
              defaultValue={record.km_at_intervention ?? ''} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="provider">Garage</label>
          <input id="provider" name="provider" type="text" className={inputCls}
            defaultValue={record.provider ?? ''} placeholder="Nom du garage…" />
        </div>

        <div>
          <label className={labelCls} htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} className={`${inputCls} resize-none`}
            defaultValue={record.notes ?? ''} placeholder="Notes complémentaires…" />
        </div>
      </div>

      {/* ── Le détail de la facture ──────────────────────────────────────────
          Séparation voulue par le gérant le 02/08/2026 : tant que
          l'intervention n'est pas terminée, il n'y a rien à facturer, et ces
          champs n'ont pas à encombrer l'écran. Ils apparaissent une fois le
          compte rendu fait, pour permettre de le corriger. */}
      {!estOuverte && (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls.replace(' mb-1.5', '')}>Pièces remplacées</span>
          <button type="button" onClick={ajouterLigne}
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>

        {lignes.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            Aucune pièce saisie. Le détail sert à comparer deux garages plus tard, il reste facultatif.
          </p>
        ) : (
          <div className="space-y-2">
            {lignes.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text" value={p.label} onChange={e => majLigne(i, 'label', e.target.value)}
                  placeholder="Nom de la pièce"
                  className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400"
                />
                <input
                  type="number" step="0.5" min="0" inputMode="decimal"
                  value={p.quantity} onChange={e => majLigne(i, 'quantity', e.target.value)}
                  aria-label="Quantité"
                  className="w-14 flex-shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-900 text-center focus:outline-none focus:border-gray-400"
                />
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={p.unit_price} onChange={e => majLigne(i, 'unit_price', e.target.value)}
                  aria-label="Prix unitaire"
                  className="w-20 flex-shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-900 focus:outline-none focus:border-gray-400"
                />
                <button type="button" onClick={() => retirerLigne(i)}
                  className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 flex-shrink-0"
                  title="Retirer cette pièce">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-500">
              Total des pièces : <span className="font-bold text-gray-900">{formatPrice(totalDesPieces)}</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className={labelCls} htmlFor="labor_cost">Main d&apos;œuvre (€)</label>
            <input id="labor_cost" name="labor_cost" type="number" step="0.01" min="0" inputMode="decimal"
              value={labor} onChange={e => setLabor(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          {!reparationDeDegats && (
            <div>
              <label className={labelCls} htmlFor="amount">Montant total (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0" inputMode="decimal"
                value={montant} onChange={e => setMontant(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {reparationDeDegats && (
          <p className="text-[11px] text-gray-400">
            Le montant total de cette réparation vient du règlement, dégât par dégât. Il ne se
            modifie pas ici.
          </p>
        )}

        {ecartDetail && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
            Le détail fait {formatPrice(totalDetaille)}, le montant total {formatPrice(reparationDeDegats ? ancien : nouveau)}.
            Ce n&apos;est pas bloquant, mais vérifiez que rien ne manque.
          </p>
        )}
      </div>
      )}

      {estOuverte && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">
            Le détail de la facture (pièces, main d&apos;œuvre, coût total) se renseigne à la
            clôture, dans le compte rendu d&apos;intervention.
          </p>
        </div>
      )}

      {/* ── Le suivi du travail ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <span className={labelCls}>Urgence</span>
          <input type="hidden" name="urgency" value={urgence} />
          <div className="grid grid-cols-3 gap-2">
            {URGENCIES.map(u => (
              <button key={u.key} type="button" onClick={() => setUrgence(u.key)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  urgence === u.key
                    ? 'bg-[#111111] border-[#111111] text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgence === u.key ? 'bg-white' : u.dot}`} />
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="due_date">Date limite</label>
            <DatePickerField id="due_date" name="due_date" defaultValue={record.due_date ?? undefined} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="assigned_to">Confiée à</label>
            <select id="assigned_to" name="assigned_to" className={inputCls} defaultValue={record.assigned_to ?? ''}>
              <option value="">Personne</option>
              {equipe.map(m => <option key={m.id} value={m.id}>{m.full_name ?? 'Sans nom'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Le motif n'apparaît qu'à partir du moment où le montant bouge : sinon il
          encombrerait une simple correction de faute de frappe. */}
      {montantChange && !reparationDeDegats && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <label className={labelCls} htmlFor="reason">
            Pourquoi le montant change {passeAuControle ? '(sera soumis à validation)' : ''}
          </label>
          <input id="reason" name="reason" type="text" required className={inputCls}
            placeholder="Ex : le garage a refait sa facture, une pièce en moins" />
          <p className="text-[11px] text-gray-400 mt-1.5">
            {formatPrice(ancien)} → {formatPrice(nouveau)}.
            {passeAuControle
              ? " Au-delà de 20 % ou 20 € d'écart, un autre gérant ou associé doit valider si le contrôle est activé dans les paramètres."
              : ' La correction s’applique immédiatement, et reste tracée.'}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      <button type="submit" disabled={pending}
        className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
        {pending ? 'Enregistrement…' : 'Enregistrer les modifications'}
      </button>
    </form>
  )
}
