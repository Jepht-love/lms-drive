'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// Interrupteur « Compte actif » façon réglages iPhone (ovale vert/gris).
// Active/désactive le compte via PATCH /api/team/[id] (best-effort, optimiste).
export default function MemberActiveToggle({
  memberId,
  initialActive,
}: {
  memberId: string
  initialActive: boolean
}) {
  const router = useRouter()
  const [active, setActive] = useState(initialActive)
  const [pending, startTransition] = useTransition()

  async function toggle() {
    const next = !active
    setActive(next) // optimiste
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) { setActive(!next); return }
      startTransition(() => router.refresh())
    } catch {
      setActive(!next)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={active}
      className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
        active ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          active ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
