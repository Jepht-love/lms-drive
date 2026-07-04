'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateDepositInfo } from '@/lib/actions/delete'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

const METHOD_LABELS: Record<string, string> = {
  especes:  'Espèces',
  virement: 'Virement',
  cb:       'Carte bancaire',
  cheque:   'Chèque',
}

interface Props {
  reservationId: string
  depositMethod: string | null
  depositRef: string | null
}

export default function DepositInfoEditor({ reservationId, depositMethod, depositRef }: Props) {
  const router = useRouter()

  const [editing, setEditing] = useState(false)
  const [method, setMethod] = useState(depositMethod ?? '')
  const [ref, setRef] = useState(depositRef ?? '')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setErrorMsg(null)
    const result = await updateDepositInfo(reservationId, method || null, ref || null)
    setLoading(false)
    if (result?.error) {
      setErrorMsg(result.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between group">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Mode de dépôt</dt>
            <dd className="text-sm font-medium text-gray-800 mt-0.5">
              {METHOD_LABELS[depositMethod ?? ''] ?? <span className="text-gray-400 italic">Non renseigné</span>}
            </dd>
          </div>
          {depositRef && (
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Référence</dt>
              <dd className="text-sm font-medium text-gray-800 mt-0.5">{depositRef}</dd>
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 transition-all ml-2 flex-shrink-0"
          title="Modifier"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-1">
      <div>
        <label className="block text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Mode de dépôt</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 bg-white"
        >
          <option value="">— Non renseigné —</option>
          <option value="especes">Espèces</option>
          <option value="virement">Virement</option>
          <option value="cb">Carte bancaire</option>
          <option value="cheque">Chèque</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Référence</label>
        <input
          type="text"
          value={ref}
          onChange={e => setRef(e.target.value)}
          placeholder="N° virement, référence…"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
        />
      </div>
      {errorMsg && (
        <div className="px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{errorMsg}</div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111111] text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Enregistrer
        </button>
        <button
          onClick={() => { setMethod(depositMethod ?? ''); setRef(depositRef ?? ''); setEditing(false); setErrorMsg(null) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
