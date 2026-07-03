'use client'

import { useState } from 'react'
import { Trash2, X, AlertTriangle } from 'lucide-react'

interface DeleteButtonProps {
  onConfirm: () => Promise<void | { error: string }>
  label?: string
  confirmMessage?: string
  variant?: 'icon' | 'text'
}

export default function DeleteButton({ onConfirm, label = 'Supprimer', confirmMessage = 'Cette action est irréversible.', variant = 'icon' }: DeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setErrorMsg(null)
    const result = await onConfirm()
    setLoading(false)
    if (result && 'error' in result) {
      setErrorMsg(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={variant === 'icon'
          ? 'p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-40 group-hover:opacity-100'
          : 'flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors w-full'
        }
        title={label}
      >
        <Trash2 className="w-4 h-4" />
        {variant === 'text' && <span>{label}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{label}</h3>
                <p className="text-sm text-gray-500 mt-1">{confirmMessage}</p>
              </div>
            </div>
            {errorMsg && (
              <div className="mb-3 px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">
                {errorMsg}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setOpen(false); setErrorMsg(null) }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {loading ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
