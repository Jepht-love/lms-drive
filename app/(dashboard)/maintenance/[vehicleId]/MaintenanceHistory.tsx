'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Check, BadgeEuro, Trash2 } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { MAINTENANCE_TYPES, MAINTENANCE_ANGLES, maintenanceType, angleOfType, type MaintenanceRecord } from '@/lib/maintenance'
import { PAYMENT_METHODS, paymentMethodLabel } from '@/lib/accounting/categories'
import { markMaintenancePaid, deleteMaintenanceRecord } from '@/lib/actions/maintenance'
import { useToast } from '@/components/Toast'

export default function MaintenanceHistory({ records }: { records: MaintenanceRecord[] }) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [filter, setFilter] = useState<string>('tous')
  const [openPay, setOpenPay] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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

      {/* Budget par angle — Réparation / Usure / Entretien, cliquable pour filtrer */}
      {byAngle.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {byAngle.map(a => {
            const active = filter === `angle:${a.id}`
            return (
              <button
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
        <button
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
            <button
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
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                    {t.label}
                  </span>
                  {r.description && (
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{r.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-sm font-black text-gray-900">{formatPrice(amount)}</span>
                  <button
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

              {/* Règlement → comptabilité (booké au paiement) */}
              {amount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {r.paid_at ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
                      <Check className="w-3.5 h-3.5" />
                      Payé{r.paid_method ? ` · ${paymentMethodLabel(r.paid_method)}` : ''} — comptabilisé
                    </span>
                  ) : openPay === r.id ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Mode de paiement</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_METHODS.map(m => (
                          <button
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
                    <button
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
                  <button onClick={() => setConfirmDel(null)} disabled={pending} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40">Annuler</button>
                  <button onClick={() => del(r.id)} disabled={pending} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-40">Supprimer</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
