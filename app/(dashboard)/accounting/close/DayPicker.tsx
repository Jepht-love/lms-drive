'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import DatePickerField from '@/components/ui/DatePickerField'
import { toYMD } from '@/lib/utils'

export default function DayPicker({ date }: { date: string }) {
  const router = useRouter()
  const today = toYMD(new Date())

  function shift(days: number) {
    // `T00:00:00` force la lecture sur le calendrier local, comme toYMD l'écrit.
    const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days)
    router.push(`/accounting/close/daily?date=${toYMD(d)}`)
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Jour précédent" onClick={() => shift(-1)}
        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <DatePickerField
        value={date} max={today}
        onChange={v => v && router.push(`/accounting/close/daily?date=${v}`)}
        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
      />
      <button type="button" aria-label="Jour suivant" onClick={() => shift(1)} disabled={date >= today}
        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
