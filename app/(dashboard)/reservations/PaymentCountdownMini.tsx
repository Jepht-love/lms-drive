'use client'

import { useEffect, useState } from 'react'

function pad(n: number) { return String(n).padStart(2, '0') }

export default function PaymentCountdownMini({
  reservationId,
  deadline,
  onDark = false,
}: {
  reservationId: string
  deadline: string
  onDark?: boolean
}) {
  const deadlineMs = new Date(deadline).getTime()
  const [remaining, setRemaining] = useState(() => Math.max(0, deadlineMs - Date.now()))
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (remaining <= 0) { setExpired(true); return }
    const tick = setInterval(() => {
      const r = Math.max(0, deadlineMs - Date.now())
      setRemaining(r)
      if (r <= 0) { clearInterval(tick); setExpired(true) }
    }, 1000)
    return () => clearInterval(tick)
  }, [deadlineMs, reservationId]) // eslint-disable-line

  if (expired) {
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
        onDark ? 'text-white bg-red-500/50' : 'text-red-600 bg-red-50'
      }`}>
        ⏳ Délai dépassé
      </span>
    )
  }

  const total = Math.floor(remaining / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const urgent = remaining < 30 * 60 * 1000

  return (
    <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg flex-shrink-0 ${
      onDark
        ? urgent ? 'text-white bg-red-500/40' : 'text-white/90 bg-white/15'
        : urgent ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50'
    }`}>
      ⏳ {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  )
}
