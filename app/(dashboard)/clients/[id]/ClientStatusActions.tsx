'use client'

import { useState, useTransition } from 'react'
import { Star, Ban, RotateCcw } from 'lucide-react'
import { updateClientStatus } from '@/lib/actions/clients'
import type { ClientStatus } from '@/types/database'
import { useToast } from '@/components/Toast'

export default function ClientStatusActions({ clientId, status }: { clientId: string; status: ClientStatus }) {
  const [pending, startTransition] = useTransition()
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [reason, setReason] = useState('')
  const { show } = useToast()

  function setStatus(next: ClientStatus, blacklistReason?: string) {
    startTransition(async () => {
      const result = await updateClientStatus(clientId, next, blacklistReason)
      if (result?.error) {
        show(result.error, 'error')
        return
      }
      const messages: Record<ClientStatus, string> = {
        vip: 'Client marqué VIP',
        blackliste: 'Client blacklisté',
        standard: 'Statut réinitialisé',
      }
      show(messages[next] ?? 'Statut mis à jour', 'success')
      setShowReasonInput(false)
      setReason('')
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {status !== 'vip' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus('vip')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Star className="w-4 h-4" /> VIP
          </button>
        )}
        {status !== 'blackliste' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowReasonInput(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Ban className="w-4 h-4" /> Blacklister
          </button>
        )}
        {status !== 'standard' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus('standard')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Retirer le statut
          </button>
        )}
      </div>

      {showReasonInput && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
          <label className="block text-xs font-bold text-red-700 uppercase tracking-wide">Motif du blacklistage</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
            placeholder="Impayé, dégradation, comportement…"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowReasonInput(false)}
              className="flex-1 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => setStatus('blackliste', reason.trim())}
              className="flex-1 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
