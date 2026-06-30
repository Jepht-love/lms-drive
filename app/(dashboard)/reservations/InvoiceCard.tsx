'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt, Plus, Trash2, Mail, Check, Loader2, AlertTriangle, Eye } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { updateInvoiceLines, sendInvoice } from '@/lib/actions/invoices'
import type { InvoiceLineItem } from '@/lib/pdf/invoice-template'

interface Invoice {
  id: string
  invoice_number: string
  line_items: InvoiceLineItem[]
  total_amount: number
  sent_at: string | null
  payment_term_days?: number
  due_date?: string | null
}

export default function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const router = useRouter()
  const [lines, setLines] = useState<InvoiceLineItem[]>(invoice.line_items)
  const [termDays, setTermDays] = useState(invoice.payment_term_days ?? 30)
  const [saving, startSaving] = useTransition()
  const [sending, startSending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const total = lines.reduce((s, l) => s + l.total, 0)
  const hasZeroPrice = lines.some(l => l.total <= 0)

  function update(i: number, patch: Partial<InvoiceLineItem>) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, ...patch }
      next.total = Math.round(next.quantity * next.unit_price * 100) / 100
      return next
    }))
    setDirty(true)
  }

  function addLine() {
    setLines(prev => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0 }])
    setDirty(true)
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  function onSave() {
    setError(null)
    startSaving(async () => {
      const res = await updateInvoiceLines(invoice.id, lines, termDays)
      if (res?.error) setError(res.error)
      else { setDirty(false); router.refresh() }
    })
  }

  function onSend() {
    if (!confirm(`Envoyer la facture ${invoice.invoice_number} (${formatPrice(total)}) par email au client ?`)) return
    setError(null)
    startSending(async () => {
      const res = await sendInvoice(invoice.id)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  const input = 'text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-gray-400'

  if (invoice.sent_at) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Facture de restitution</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
          <Check className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">
            {invoice.invoice_number} envoyée le {new Date(invoice.sent_at).toLocaleDateString('fr-FR')} — {formatPrice(invoice.total_amount)}
            {invoice.due_date && <> · échéance {new Date(invoice.due_date).toLocaleDateString('fr-FR')}</>}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Facture de restitution — {invoice.invoice_number}
        </span>
      </div>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={l.description}
              onChange={e => update(i, { description: e.target.value })}
              placeholder="Description"
              className={`${input} flex-1 min-w-0`}
            />
            <input
              type="number" min="0" step="1" value={l.quantity}
              onChange={e => update(i, { quantity: Number(e.target.value) })}
              className={`${input} w-14 text-center`}
              title="Quantité"
            />
            <input
              type="number" min="0" step="0.01" value={l.unit_price}
              onChange={e => update(i, { unit_price: Number(e.target.value) })}
              className={`${input} w-20 text-center ${l.unit_price <= 0 ? 'border-amber-400 bg-amber-50' : ''}`}
              title="Prix unitaire (€)"
            />
            <span className="w-20 text-sm font-bold text-gray-900 text-right flex-shrink-0">
              {formatPrice(l.total)}
            </span>
            <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addLine} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
        <Plus className="w-3.5 h-3.5" /> Ajouter une ligne (fourrière, lavage, carburant...)
      </button>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Délai de règlement accordé au client</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number" min="1" step="1" value={termDays}
            onChange={e => { setTermDays(Number(e.target.value)); setDirty(true) }}
            className={`${input} w-16 text-center`}
          />
          <span className="text-xs text-gray-400">jours</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-sm font-bold text-gray-500">Total</span>
        <span className="text-lg font-extrabold text-gray-900">{formatPrice(total)}</span>
      </div>

      {hasZeroPrice && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Au moins une ligne (dommage constaté) attend un tarif — complète-la avant l&apos;envoi.</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-2">
        <a
          href={`/api/invoices/${invoice.id}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => { if (dirty) { e.preventDefault(); setError('Enregistre tes modifications avant de prévisualiser le PDF.') } }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 ${dirty ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <Eye className="w-3.5 h-3.5" /> Prévisualiser
        </a>
        {dirty && (
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        )}
        <button onClick={onSend} disabled={sending || dirty || hasZeroPrice || lines.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
          Envoyer la facture au client
        </button>
      </div>
      {dirty && <p className="text-[11px] text-gray-400">Enregistre tes modifications avant d&apos;envoyer.</p>}
    </div>
  )
}
