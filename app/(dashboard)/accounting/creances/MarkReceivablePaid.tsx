'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { markDuePaid } from '@/lib/actions/dueDates'
import { formatPrice } from '@/lib/utils'
import { useToast } from '@/components/Toast'

// Solder une créance = encaissement reçu → markDuePaid crée la recette réelle
// (datée du jour) et marque l'échéance réglée. La créance disparaît alors de la
// liste (annulation demandée par Jepht).
export default function MarkReceivablePaid({ id, amount }: { id: string; amount: number }) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  function onPaid() {
    startTransition(async () => {
      const res = await markDuePaid(id)
      if (res?.error) { toast(res.error, 'error'); return }
      toast('Créance soldée — recette enregistrée')
      router.refresh()
    })
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="mt-3 w-full h-10 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-bold hover:bg-green-100 transition-colors"
      >
        Marquer encaissée
      </button>
    )
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={onPaid}
        disabled={pending}
        className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Confirmer {formatPrice(amount)} reçus
      </button>
      <button
        onClick={() => setConfirm(false)}
        disabled={pending}
        className="px-4 h-10 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Annuler
      </button>
    </div>
  )
}
