'use client'

import { useEffect, useState } from 'react'
import { cancelReservationOnPaymentTimeout } from '@/lib/actions/reservations'

interface Props {
  reservationId: string
  deadline: string // ISO timestamp
}

function pad(n: number) { return String(n).padStart(2, '0') }

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

export default function PaymentCountdown({ reservationId, deadline }: Props) {
  const deadlineMs = new Date(deadline).getTime()
  const [remaining, setRemaining] = useState(() => deadlineMs - Date.now())
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (remaining <= 0) {
      cancelReservationOnPaymentTimeout(reservationId).then(() => setDone(true))
      return
    }
    const tick = setInterval(() => {
      const r = deadlineMs - Date.now()
      setRemaining(r)
      if (r <= 0) {
        clearInterval(tick)
        cancelReservationOnPaymentTimeout(reservationId).then(() => setDone(true))
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [deadlineMs, reservationId]) // eslint-disable-line

  if (done) {
    return (
      <div className="rounded-2xl bg-red-600 p-5 text-white text-center">
        <p className="text-lg font-extrabold">⛔ Délai expiré</p>
        <p className="text-sm mt-1 text-red-100">Réservation annulée — véhicule remis en disponibilité.</p>
      </div>
    )
  }

  const { h, m, s } = split(remaining)
  const pct = Math.max(0, remaining / (2 * 60 * 60 * 1000))
  const urgent = remaining < 30 * 60 * 1000

  return (
    <div className={`rounded-2xl p-5 ${urgent ? 'bg-red-600' : 'bg-orange-500'}`}>
      {/* Label */}
      <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${urgent ? 'text-red-200' : 'text-orange-100'}`}>
        ⏳ Délai de paiement — réservation en attente
      </p>

      {/* Chiffres */}
      <div className="flex items-end gap-1 justify-center mb-4">
        {[{ v: h, u: 'h' }, { v: m, u: 'm' }, { v: s, u: 's' }].map(({ v, u }, i) => (
          <div key={u} className="flex items-end gap-1">
            {i > 0 && <span className="text-white/50 text-3xl font-black mb-1">:</span>}
            <div className="text-center">
              <span className="text-5xl font-black tabular-nums text-white leading-none">{pad(v)}</span>
              <p className="text-xs text-white/60 mt-0.5 font-semibold">{u}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barre */}
      <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-white transition-all duration-1000"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <p className="text-xs text-white/70 text-center">
        Sans paiement ni contact avant{' '}
        <strong className="text-white">
          {new Date(deadline).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </strong>
        , le véhicule sera remis en disponibilité.
      </p>
    </div>
  )
}
