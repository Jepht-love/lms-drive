'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, SlidersHorizontal, Search, X } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { getCategoryLabel } from '@/lib/accounting/categories'
import { toggleTransparence } from '@/lib/actions/accounting'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'
import SwipeableRow from '@/components/SwipeableRow'
import { useToast } from '@/components/Toast'
import InlineEditField from '@/components/InlineEditField'
import { updateTransactionNotes, deleteTransaction } from '@/lib/actions/accounting'

interface Tx {
  id: string
  date: string
  type: string
  category: string
  amount: number
  supplier_beneficiary: string | null
  notes: string | null
  is_transparent: boolean
  reservation_id: string | null
  vehicles?: VehicleRef | VehicleRef[] | null
}

interface VehicleRef { plate: string; brand?: string | null; model?: string | null }

// Libellé véhicule : « Marque Modèle » (le nom, demande Jepht 24/07) ; la plaque
// n'est plus le libellé principal mais un complément discret à côté.
function vehicleName(v: VehicleRef | null | undefined): string {
  if (!v) return ''
  return [v.brand, v.model].filter(Boolean).join(' ').trim() || v.plate
}

// Recherche insensible à la casse ET aux accents (« dépense » == « depense »).
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

// Un mouvement correspond à la recherche s'il matche sur sa catégorie, son
// bénéficiaire/fournisseur, sa note, la plaque du véhicule, son montant ou son
// sens (recette / dépense).
function matchesQuery(t: Tx, q: string): boolean {
  const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles
  const haystack = normalize([
    getCategoryLabel(t.category),
    t.supplier_beneficiary ?? '',
    t.notes ?? '',
    vehicleName(v),
    v?.plate ?? '',
    String(t.amount ?? ''),
    t.type === 'recette' ? 'recette' : 'depense',
  ].join(' '))
  return haystack.includes(q)
}

export default function AccountingTransactions({ transactions }: { transactions: Tx[] }) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [exportMode, setExportMode] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-gray-400 font-medium text-sm">Aucun mouvement sur la période</p>
      </div>
    )
  }

  const q = normalize(query)
  const filtered = q ? transactions.filter(t => matchesQuery(t, q)) : transactions

  const byDate = new Map<string, Tx[]>()
  for (const t of filtered) {
    if (!byDate.has(t.date)) byDate.set(t.date, [])
    byDate.get(t.date)!.push(t)
  }

  const visible = filtered.filter(t => !t.is_transparent)
  const visRev = visible.filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const visExp = visible.filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const hidden = filtered.filter(t => t.is_transparent)
  const hiddenAmount = hidden.reduce((s, t) => s + (t.amount ?? 0), 0)

  function onToggle(t: Tx) {
    startTransition(async () => {
      const result = await toggleTransparence(t.id, t.is_transparent)
      if (result?.error) { toast(result.error, 'error'); return }
      router.refresh()
      toast(t.is_transparent ? 'Transaction affichée' : 'Transaction masquée')
    })
  }

  function onDelete(t: Tx) {
    startTransition(async () => {
      const result = await deleteTransaction(t.id)
      if (result?.error) { toast(result.error, 'error'); return }
      router.refresh()
      toast('Écriture supprimée')
    })
  }

  return (
    <div className="space-y-3">
      {/* Recherche — filtre la liste de la période affichée */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une transaction, une dépense…"
          className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-9 pr-9 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
            title="Effacer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <button onClick={() => setExportMode(!exportMode)}
        className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
          exportMode ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 shadow-sm'
        }`}>
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {exportMode ? 'Quitter le mode export' : 'Préparer export'}
      </button>

      {exportMode && (
        <div className="bg-[#111111] text-white rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Total visible (export)</p>
          <p className="text-[30px] font-black leading-none">{formatPrice(visRev - visExp)}</p>
          <p className="text-xs text-white/60 mt-1.5">CA : {formatPrice(visRev)} · Dépenses : {formatPrice(visExp)}</p>
          {hidden.length > 0 && (
            <p className="text-[11px] text-white/40 mt-1">{hidden.length} ligne(s) masquée(s) · {formatPrice(hiddenAmount)} exclus</p>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400 font-medium text-sm">Aucun résultat pour « {query.trim()} »</p>
          <button onClick={() => setQuery('')} className="mt-2 text-xs font-semibold text-gray-500 underline">Effacer la recherche</button>
        </div>
      ) : (
        <AnimatedList className="space-y-3">
          {[...byDate.entries()].map(([date, items]) => (
            <AnimatedListItem key={date}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{formatDate(date)}</p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {items.map(t => {
                  const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles
                  const isRev = t.type === 'recette'
                  const row = (
                    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-opacity ${t.is_transparent ? 'opacity-40' : ''}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-black ${isRev ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {isRev ? '+' : '−'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">
                          {getCategoryLabel(t.category)}
                          {v && (
                            <span className="text-gray-400 font-normal"> · {vehicleName(v)}
                              {v.plate ? <span className="text-gray-300"> ({v.plate})</span> : null}
                            </span>
                          )}
                        </p>
                        <InlineEditField
                          value={t.notes ?? ''}
                          onSave={async (val) => { const r = await updateTransactionNotes(t.id, val); if (r?.error) return { error: r.error }; router.refresh() }}
                          placeholder={t.supplier_beneficiary ?? 'Note...'}
                          displayClassName="text-[11px] text-gray-400 truncate block w-full text-left"
                        />
                      </div>
                      <p className={`text-sm font-black flex-shrink-0 ${isRev ? 'text-green-600' : 'text-red-500'}`}>
                        {isRev ? '+' : '−'}{formatPrice(t.amount)}
                      </p>
                      {exportMode && (
                        <button onClick={() => onToggle(t)} disabled={pending}
                          className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center border ${t.is_transparent ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
                          title={t.is_transparent ? "Inclure dans l'export" : "Exclure de l'export"}>
                          {t.is_transparent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )
                  if (exportMode) return <div key={t.id}>{row}</div>
                  return (
                    <SwipeableRow
                      key={t.id}
                      actions={[
                        { label: t.is_transparent ? 'Afficher' : 'Masquer', color: '#7C3AED', onClick: () => onToggle(t) },
                        // Écriture liée à une réservation : non supprimable ici (gérée via la réservation).
                        ...(t.reservation_id ? [] : [{ label: 'Supprimer', color: '#DC2626', onClick: () => onDelete(t) }]),
                      ]}
                    >
                      {row}
                    </SwipeableRow>
                  )
                })}
              </div>
            </AnimatedListItem>
          ))}
        </AnimatedList>
      )}
    </div>
  )
}
