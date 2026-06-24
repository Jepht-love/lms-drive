'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { validateConvention } from '@/lib/actions/partnerships'

export default function ValidateConventionButton({ contractId }: { contractId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const res = await validateConvention(contractId)
            if (res?.error) setError(res.error)
            else router.refresh()
          })
        }}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors active:scale-[.99] disabled:opacity-40 w-full"
      >
        <Lock className="w-4 h-4" /> {pending ? 'Clôture…' : 'Clôturer la convention'}
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
