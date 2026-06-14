'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES, PAYMENT_METHODS } from '@/lib/accounting/categories'
import { createTransaction } from '@/lib/actions/accounting'

interface Vehicle { id: string; plate: string; brand: string; model: string }

export default function NewTransactionPage() {
  const router = useRouter()
  const [type, setType] = useState<'recette' | 'depense'>('depense')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand')
      .then(({ data }) => setVehicles((data as Vehicle[]) ?? []))
  }, [])

  const categories = type === 'recette' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES
  const today = new Date().toISOString().slice(0, 10)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    startTransition(async () => {
      const res = await createTransaction(fd)
      if (res?.error) setError(res.error)
      else router.push('/accounting')
    })
  }

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4 pb-4">
      <Link href="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>
      <h1 className="text-xl font-black text-gray-900">Nouveau mouvement</h1>

      {/* Type */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setType('recette')}
          className={`py-4 rounded-2xl border-2 font-bold text-sm transition-colors ${type === 'recette' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>
          + Recette
        </button>
        <button type="button" onClick={() => setType('depense')}
          className={`py-4 rounded-2xl border-2 font-bold text-sm transition-colors ${type === 'depense' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500'}`}>
          − Dépense
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="category">Catégorie</label>
              <select id="category" name="category" required className={input}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0" className={input} inputMode="decimal" />
            </div>
            <div>
              <label className={label} htmlFor="date">Date</label>
              <input id="date" name="date" type="date" defaultValue={today} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="payment_method">Mode de paiement</label>
              <select id="payment_method" name="payment_method" className={input}>
                <option value="">—</option>
                {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="vehicle_id">Véhicule concerné (optionnel)</label>
            <select id="vehicle_id" name="vehicle_id" className={input}>
              <option value="">Aucun</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="supplier_beneficiary">Fournisseur / Bénéficiaire</label>
            <input id="supplier_beneficiary" name="supplier_beneficiary" type="text" className={input} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="reference">Référence</label>
              <input id="reference" name="reference" type="text" placeholder="N° facture…" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="notes">Notes</label>
              <input id="notes" name="notes" type="text" className={input} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
          {pending ? 'Enregistrement…' : 'Enregistrer le mouvement'}
        </button>
      </form>
    </div>
  )
}
