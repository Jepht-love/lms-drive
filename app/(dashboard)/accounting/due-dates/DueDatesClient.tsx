'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES, getCategoryLabel } from '@/lib/accounting/categories'
import { createDueDate, markDuePaid, deleteDueDate } from '@/lib/actions/dueDates'

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
  vehicles?: { plate: string } | { plate: string }[] | null
}

export default function DueDatesClient({ dueDates, vehicles }: { dueDates: DueDate[]; vehicles: Vehicle[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<'recette' | 'depense'>('depense')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const unpaid = dueDates.filter(d => !d.is_paid)
  const overdue = unpaid.filter(d => d.due_date < today)
  const upcoming = unpaid.filter(d => d.due_date >= today)
  const paid = dueDates.filter(d => d.is_paid).slice(0, 10)
  const categories = type === 'recette' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    startTransition(async () => {
      const res = await createDueDate(fd)
      if (res?.error) { setError(res.error); return }
      setShowForm(false)
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

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteDueDate(id)
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
            <button onClick={() => onDelete(d.id)} disabled={pending}
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
          <div>
            <label className={label} htmlFor="description">Description</label>
            <input id="description" name="description" type="text" required placeholder="Loyer local, assurance flotte..." className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="category">Catégorie</label>
              <select id="category" name="category" required className={input}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className={input} inputMode="decimal" />
            </div>
            <div>
              <label className={label} htmlFor="due_date">Échéance</label>
              <input id="due_date" name="due_date" type="date" required defaultValue={today} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="vehicle_id">Véhicule (optionnel)</label>
              <select id="vehicle_id" name="vehicle_id" className={input}>
                <option value="">Aucun</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="notes">Notes</label>
            <input id="notes" name="notes" type="text" className={input} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={pending}
            className="w-full py-3 bg-[#111111] text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors disabled:opacity-40">
            {pending ? 'Enregistrement…' : 'Ajouter l’échéance'}
          </button>
        </form>
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
    </div>
  )
}
