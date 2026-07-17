'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle2, AlertTriangle, Trash2, X, Undo2 } from 'lucide-react'
import Toggle from '@/components/ui/Toggle'
import { formatPrice, formatDate } from '@/lib/utils'
import { REVENUE_CATEGORIES, getCategoryLabel, expenseCategoriesByFamily } from '@/lib/accounting/categories'
import { createDueDate, createRecurringDueDates, markDuePaid, deleteDueDate, restoreDueDate } from '@/lib/actions/dueDates'

interface Vehicle { id: string; plate: string; brand: string; model: string }
interface DueDate {
  id: string
  description: string
  type: 'recette' | 'depense'
  category: string
  amount: number
  due_date: string
  is_paid: boolean
  notes: string | null
  vehicle_id?: string | null
  vehicles?: { plate: string } | { plate: string }[] | null
}

export default function DueDatesClient({ dueDates, vehicles }: { dueDates: DueDate[]; vehicles: Vehicle[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<'recette' | 'depense'>('depense')
  const [recurring, setRecurring] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  // Suppression protégée : d'abord une confirmation (évite la suppression
  // accidentelle), puis une bannière « Annuler » qui restaure l'échéance.
  const [confirmDelete, setConfirmDelete] = useState<DueDate | null>(null)
  const [deleted, setDeleted] = useState<DueDate | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const unpaid = dueDates.filter(d => !d.is_paid)
  const overdue = unpaid.filter(d => d.due_date < today)
  const upcoming = unpaid.filter(d => d.due_date >= today)
  const paid = dueDates.filter(d => d.is_paid).slice(0, 10)
  const expenseGroups = expenseCategoriesByFamily()

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    startTransition(async () => {
      const res = recurring ? await createRecurringDueDates(fd) : await createDueDate(fd)
      if (res?.error) { setError(res.error); return }
      setShowForm(false)
      if (recurring && 'count' in res) setSuccessMsg(`${res.count} mensualités ajoutées`)
      router.refresh()
    })
  }

  function onMarkPaid(id: string) {
    startTransition(async () => {
      const res = await markDuePaid(id)
      if (res?.error) setError(res.error)
      router.refresh()
    })
  }

  function onConfirmDelete() {
    const d = confirmDelete
    if (!d) return
    setConfirmDelete(null)
    setError(null)
    startTransition(async () => {
      const res = await deleteDueDate(d.id)
      if (res?.error) { setError(res.error); return }
      setDeleted(d)          // ouvre la bannière « Annuler / Restaurer »
      router.refresh()
    })
  }

  function onRestore() {
    const d = deleted
    if (!d) return
    setDeleted(null)
    setError(null)
    startTransition(async () => {
      const res = await restoreDueDate({
        description: d.description,
        type: d.type,
        category: d.category,
        amount: d.amount,
        due_date: d.due_date,
        vehicle_id: d.vehicle_id ?? null,
        notes: d.notes,
      })
      if (res?.error) { setError(res.error); return }
      router.refresh()
    })
  }

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  function Row({ d }: { d: DueDate }) {
    const v = Array.isArray(d.vehicles) ? d.vehicles[0] : d.vehicles
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{d.description}</p>
          <p className="text-xs text-gray-400">
            {formatDate(d.due_date)} · {getCategoryLabel(d.category)}{v?.plate ? ` · ${v.plate}` : ''}
          </p>
        </div>
        <span className={`text-sm font-black flex-shrink-0 ${d.type === 'recette' ? 'text-green-600' : 'text-red-500'}`}>
          {d.type === 'recette' ? '+' : '−'}{formatPrice(d.amount)}
        </span>
        {!d.is_paid && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => onMarkPaid(d.id)} disabled={pending}
              className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100" title="Marquer réglée">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button onClick={() => setConfirmDelete(d)} disabled={pending}
              className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500" title="Supprimer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors active:scale-[.98]">
        <Plus className="w-4 h-4" /> Nouvelle échéance
      </button>

      {showForm && (
        <form onSubmit={onCreate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setType('recette')}
              className={`py-3 rounded-xl border-2 font-bold text-sm transition-colors ${type === 'recette' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>
              Paiement attendu
            </button>
            <button type="button" onClick={() => setType('depense')}
              className={`py-3 rounded-xl border-2 font-bold text-sm transition-colors ${type === 'depense' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500'}`}>
              Facture à régler
            </button>
          </div>
          <Toggle
            label="Échéancier récurrent (plusieurs mensualités — ex. loyer véhicule sur 36 mois)"
            checked={recurring}
            onChange={setRecurring}
          />
          <div>
            <label className={label} htmlFor="description">Description</label>
            <input id="description" name="description" type="text" required placeholder="Loyer local, assurance flotte..." className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="category">Catégorie</label>
              <select id="category" name="category" required className={input} defaultValue="">
                <option value="" disabled>Choisir…</option>
                {type === 'recette'
                  ? REVENUE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)
                  : expenseGroups.map(g => (
                      <optgroup key={g.family.id} label={`${g.family.nature === 'fixe' ? '[Fixe] ' : '[Var.] '}${g.family.label}`}>
                        {g.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </optgroup>
                    ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="amount">Montant {recurring ? 'par mensualité' : ''} (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className={input} inputMode="decimal" />
            </div>
            <div>
              <label className={label} htmlFor="due_date">{recurring ? '1ère échéance' : 'Échéance'}</label>
              <input id="due_date" name="due_date" type="date" required defaultValue={today} className={input} />
            </div>
            {recurring ? (
              <div>
                <label className={label} htmlFor="installments">Nombre de mensualités</label>
                <input id="installments" name="installments" type="number" min="1" max="120" step="1" required placeholder="36" className={input} inputMode="numeric" />
              </div>
            ) : (
              <div>
                <label className={label} htmlFor="vehicle_id">Véhicule (optionnel)</label>
                <select id="vehicle_id" name="vehicle_id" className={input}>
                  <option value="">Aucun</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
                </select>
              </div>
            )}
            {recurring && (
              <div className="col-span-2">
                <label className={label} htmlFor="vehicle_id">Véhicule (optionnel)</label>
                <select id="vehicle_id" name="vehicle_id" className={input}>
                  <option value="">Aucun</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={label} htmlFor="notes">Notes</label>
            <input id="notes" name="notes" type="text" className={input} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={pending}
            className="w-full py-3 bg-[#111111] text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors disabled:opacity-40">
            {pending ? 'Enregistrement…' : recurring ? 'Créer toutes les mensualités' : 'Ajouter l’échéance'}
          </button>
        </form>
      )}

      {successMsg && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">{successMsg}</p>
      )}

      {overdue.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> En retard — {overdue.length}
          </p>
          <div className="space-y-2">{overdue.map(d => <Row key={d.id} d={d} />)}</div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">À venir — {upcoming.length}</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune échéance à venir</p>
        ) : (
          <div className="space-y-2">{upcoming.map(d => <Row key={d.id} d={d} />)}</div>
        )}
      </div>

      {paid.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Réglées récemment</p>
          <div className="space-y-2 opacity-60">{paid.map(d => <Row key={d.id} d={d} />)}</div>
        </div>
      )}

      {/* Modale de confirmation de suppression — protège contre les suppressions
          accidentelles (« j'ai supprimé un échéancier sans faire exprès »). */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-gray-900">Supprimer cette échéance ?</h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{confirmDelete.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(confirmDelete.due_date)} · {confirmDelete.type === 'recette' ? '+' : '−'}{formatPrice(confirmDelete.amount)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Vous pourrez la restaurer juste après si c’est une erreur.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button onClick={onConfirmDelete} disabled={pending}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-40">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bannière « Annuler » — restaure la dernière échéance supprimée. */}
      {deleted && (
        <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-6 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-[#111111] text-white rounded-2xl shadow-2xl px-4 py-3 w-full sm:max-w-md">
            <span className="flex-1 text-sm font-medium truncate">Échéance supprimée</span>
            <button onClick={onRestore} disabled={pending}
              className="flex items-center gap-1.5 text-sm font-bold text-white bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
              <Undo2 className="w-4 h-4" /> Restaurer
            </button>
            <button onClick={() => setDeleted(null)} aria-label="Fermer"
              className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
