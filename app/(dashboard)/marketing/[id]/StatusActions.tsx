'use client'

import { useTransition } from 'react'
import { updateCampaignStatus } from '@/lib/actions/campaigns'

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  planifiee: [{ label: 'Démarrer', next: 'en_cours' }, { label: 'Suspendre', next: 'suspendue' }],
  en_cours:  [{ label: 'Suspendre', next: 'suspendue' }],
  suspendue: [{ label: 'Reprendre', next: 'en_cours' }],
  terminee:  [],
}

export default function StatusActions({ campaignId, currentStatus }: { campaignId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition()
  const actions = TRANSITIONS[currentStatus] ?? []
  if (!actions.length) return null

  return (
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
  )
}
