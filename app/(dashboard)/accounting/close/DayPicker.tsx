'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function DayPicker({ date }: { date: string }) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  function shift(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days)
    router.push(`/accounting/close/daily?date=${d.toISOString().slice(0, 10)}`)
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)}
        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <input
        type="date" value={date} max={today}
        onChange={e => e.target.value && router.push(`/accounting/close/daily?date=${e.target.value}`)}
        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
      />
      <button onClick={() => shift(1)} disabled={date >= today}
        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
