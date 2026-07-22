'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteOperation } from '@/lib/actions/partnerships'

// Suppression d'une opération inter-agences (sortante avec convention). L'entrante
// passe par OperationActions qui embarque déjà son propre bouton de suppression.
export default function DeleteOperationButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onDelete() {
    if (!confirm('Supprimer définitivement cette opération et tout ce qui lui est lié (convention, PDF, écritures comptables) ?')) return
    setError(null)
    startTransition(async () => {
      const res = await deleteOperation(id)
      if (res?.error) setError(res.error)
      else router.push('/partnerships')
    })
  }

  return (
    <div className="space-y-2">
      <button onClick={onDelete} disabled={pending}
        className="flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm text-red-600 border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-40 w-full">
        <Trash2 className="w-4 h-4" /> Supprimer l'opération
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
