'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Toggle from '@/components/ui/Toggle'

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

  return <Toggle checked={active} onChange={() => toggle()} disabled={pending} />
}
