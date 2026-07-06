'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteAgency } from '@/lib/actions/partnerships'
import { useToast } from '@/components/Toast'

export default function DeleteAgencyButton({ agencyId }: { agencyId: string }) {
  const router = useRouter()
  const { show } = useToast()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => setConfirm(false)}
          disabled={pending}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40"
        >
          Annuler
        </button>
        <button
          onClick={() => startTransition(async () => {
            const r = await deleteAgency(agencyId)
            if (r?.error) { show(r.error, 'error'); setConfirm(false) }
            else { show('Agence supprimée', 'success'); router.refresh() }
          })}
          disabled={pending}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-40"
        >
          {pending ? '…' : 'Supprimer'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
      title="Supprimer l'agence"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
