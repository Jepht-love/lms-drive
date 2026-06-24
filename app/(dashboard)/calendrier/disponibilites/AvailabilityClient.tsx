'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setWeeklyAvailability } from '@/lib/actions/availability'

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
]

interface Slot { day_of_week: number; start_time: string; end_time: string }
interface Profile { id: string; full_name: string; role: string }

function DaySlotForm({ userId, slots }: { userId: string; slots: Slot[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(() => DAYS.map(d => {
    const existing = slots.find(s => s.day_of_week === d.value)
    return {
      day_of_week: d.value,
      is_active: !!existing,
      start_time: existing?.start_time?.slice(0, 5) ?? '08:00',
      end_time: existing?.end_time?.slice(0, 5) ?? '18:00',
    }
  }))

  function update(dayValue: number, patch: Partial<typeof days[number]>) {
    setDays(prev => prev.map(d => d.day_of_week === dayValue ? { ...d, ...patch } : d))
  }

  function onSave() {
    setError(null)
    startTransition(async () => {
      const res = await setWeeklyAvailability(userId, days)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Mon planning hebdomadaire</p>
      {DAYS.map(d => {
        const day = days.find(x => x.day_of_week === d.value)!
        return (
          <div key={d.value} className="flex items-center gap-3 py-1.5">
            <button
              type="button"
              onClick={() => update(d.value, { is_active: !day.is_active })}
              className={`w-16 flex-shrink-0 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                day.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {d.label.slice(0, 3)}
            </button>
            {day.is_active ? (
              <div className="flex items-center gap-2">
                <input type="time" value={day.start_time} onChange={e => update(d.value, { start_time: e.target.value })}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="time" value={day.end_time} onChange={e => update(d.value, { end_time: e.target.value })}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
              </div>
            ) : (
              <span className="text-xs text-gray-400">Non disponible</span>
            )}
          </div>
        )
      })}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      <button onClick={onSave} disabled={pending}
        className="w-full mt-2 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-40">
        {pending ? 'Enregistrement…' : 'Enregistrer mon planning'}
      </button>
    </div>
  )
}

export default function AvailabilityClient({
  userId, mySlots, profiles, allSlots,
}: {
  userId: string
  mySlots: Slot[]
  profiles: Profile[]
  allSlots: (Slot & { user_id: string })[]
}) {
  const todayDow = new Date().getDay()

  return (
    <div className="space-y-4">
      <DaySlotForm userId={userId} slots={mySlots} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Qui est dispo aujourd&apos;hui
        </p>
        <div className="space-y-2">
          {profiles.map(p => {
            const slot = allSlots.find(s => s.user_id === p.id && s.day_of_week === todayDow)
            return (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.full_name}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{p.role}</p>
                </div>
                {slot ? (
                  <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                    Indisponible
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
