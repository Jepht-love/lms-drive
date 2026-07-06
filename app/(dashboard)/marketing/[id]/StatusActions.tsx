'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { updateCampaignStatus, deleteCampaign } from '@/lib/actions/campaigns'

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  planifiee: [{ label: 'Démarrer', next: 'en_cours' }, { label: 'Suspendre', next: 'suspendue' }],
  en_cours:  [{ label: 'Suspendre', next: 'suspendue' }],
  suspendue: [{ label: 'Reprendre', next: 'en_cours' }],
  terminee:  [],
}

export default function StatusActions({ campaignId, currentStatus }: { campaignId: string; currentStatus: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const actions = TRANSITIONS[currentStatus] ?? []

  return (
    <div className="space-y-2">
      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map(a => (
            <button
              key={a.next}
              disabled={isPending}
              onClick={() => { startTransition(() => { void updateCampaignStatus(campaignId, a.next) }) }}
              className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-gray-700 disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {confirmDelete ? (
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmDelete(false)}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-gray-700 disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            onClick={() => startTransition(async () => { const r = await deleteCampaign(campaignId); if (!r?.error) router.push('/marketing') })}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold disabled:opacity-40 active:scale-[.98]"
          >
            {isPending ? 'Suppression...' : 'Confirmer la suppression'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-red-600 flex items-center justify-center gap-1.5 hover:bg-red-50 hover:border-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Supprimer la campagne
        </button>
      )}
    </div>
  )
}
