'use client'

import { useState } from 'react'
import { Send, Check, Loader2 } from 'lucide-react'

/**
 * Renvoi manuel du lien d'accès d'un membre (invitation ou réinitialisation,
 * décidé côté serveur selon l'état du compte). Retour visuel inline, sans script.
 */
export default function ResendInviteButton({ memberId }: { memberId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function resend() {
    setState('sending')
    setMessage(null)
    try {
      const res = await fetch('/api/team/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setMessage(data.error ?? "Échec de l'envoi.")
        return
      }
      setState('sent')
      // Même email « création d'espace » dans les deux cas — on ne surcharge pas
      // l'utilisateur avec la distinction technique invitation/ré-accès.
      setMessage(`Email de création d'espace envoyé à ${data.email}.`)
    } catch {
      setState('error')
      setMessage('Erreur réseau.')
    }
  }

  return (
    <div>
      <button type="button"
        onClick={resend}
        disabled={state === 'sending' || state === 'sent'}
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors disabled:opacity-60 text-left"
      >
        {state === 'sending' ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
        ) : state === 'sent' ? (
          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <Send className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        <span className="flex-1 text-sm font-semibold text-gray-700">
          {state === 'sent' ? 'Lien renvoyé' : state === 'sending' ? 'Envoi…' : "Renvoyer le lien d'accès"}
        </span>
      </button>
      {message && (
        <p className={`px-4 pb-3 -mt-1 text-xs font-medium ${state === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
