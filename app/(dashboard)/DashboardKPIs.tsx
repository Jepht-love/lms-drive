'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { value: '7', label: '7 jours' },
  { value: '15', label: '15 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '3 mois' },
  { value: 'current_month', label: 'Mois en cours' },
  { value: 'last_month', label: 'Mois dernier' },
]

export default function DashboardKPIs({ currentPeriod }: { currentPeriod: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function changePeriod(p: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', p)
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => changePeriod(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            currentPeriod === p.value
              ? 'bg-[#111111] text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
