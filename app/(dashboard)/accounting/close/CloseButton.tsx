'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { closeDailyAccounting, closeMonthlyAccounting, closeAnnualAccounting } from '@/lib/actions/accounting'

export default function CloseButton({
  mode, date, month, year,
}: {
  mode: 'daily' | 'monthly' | 'annual'
  date?: string
  month?: number
  year?: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClose() {
    setError(null)
    startTransition(async () => {
      const res = mode === 'daily'
        ? await closeDailyAccounting(date!)
        : mode === 'monthly'
          ? await closeMonthlyAccounting(month!, year!)
          : await closeAnnualAccounting(year!)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  const labels = { daily: 'Clôturer la journée', monthly: 'Clôturer le mois', annual: "Clôturer l'année" }

  return (
    <div className="space-y-2">
      <button onClick={onClose} disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
        <Lock className="w-4 h-4" /> {pending ? 'Clôture…' : labels[mode]}
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
