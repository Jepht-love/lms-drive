'use client'

import { useState } from 'react'
import { Mail, CheckCircle, Loader2 } from 'lucide-react'
import { sendPaymentInfoEmail } from '@/lib/actions/reservations'

interface Props {
  reservationId: string
  clientEmail: string | null
  clientName: string
  reservationNumber: string
  onDeadlineSet?: (deadline: string) => void
}

export default function SendPaymentEmailButton({
  reservationId,
  clientEmail,
  clientName,
  reservationNumber,
  onDeadlineSet,
}: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    if (!clientEmail) return
    setState('loading')
    const res = await sendPaymentInfoEmail(reservationId, clientEmail, clientName, reservationNumber)
    if (res.error) { setErrorMsg(res.error); setState('error') }
    else {
      setState('done')
      if (res.deadline) onDeadlineSet?.(res.deadline)
    }
  }

  if (!clientEmail) return null

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
        <CheckCircle className="w-4 h-4" />
        Email de modalités de paiement envoyé à {clientEmail}
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-50">
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors active:scale-[.98] disabled:opacity-60"
      >
        {state === 'loading'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Mail className="w-4 h-4" />}
        Envoyer les modalités de paiement par email
      </button>
      {state === 'error' && <p className="text-xs text-red-500 mt-1">{errorMsg}</p>}
    </div>
  )
}
