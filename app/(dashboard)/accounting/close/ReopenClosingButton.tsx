'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Unlock } from 'lucide-react'
import { reopenMonthlyClosing, reopenAnnualClosing } from '@/lib/actions/accounting'

export default function ReopenClosingButton({ mode, month, year }: {
  mode: 'monthly' | 'annual'
  month?: number
  year: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onReopen() {
    setError(null)
    startTransition(async () => {
      const res = mode === 'monthly'
        ? await reopenMonthlyClosing(month!, year)
        : await reopenAnnualClosing(year)
      if (res?.error) setError(res.error); else router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <button onClick={onReopen} disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
        <Unlock className="w-4 h-4" /> {pending ? '…' : 'Rouvrir la clôture'}
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
