'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ClipboardList, ArrowRight } from 'lucide-react'
import { startEntrantRental } from '@/lib/actions/partnerships'

interface Props {
  operationId: string
  reservationId: string | null
  hasClient: boolean
}

// ENTRANT — point d'entrée du flux location (EDL + contrat). Si une réservation
// existe déjà pour l'opération, on pointe simplement vers sa fiche (qui porte le
// suivi complet) ; sinon on lance startEntrantRental qui crée véhicule + résa et
// redirige vers l'EDL de départ.
export default function EntrantRentalLauncher({ operationId, reservationId, hasClient }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (reservationId) {
    return (
      <Link
        href={`/reservations/${reservationId}`}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-[#111111] text-white hover:bg-gray-800 transition-colors active:scale-[.99] w-full"
      >
        <ClipboardList className="w-4 h-4" /> Voir la location (EDL + contrat) <ArrowRight className="w-4 h-4" />
      </Link>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || !hasClient}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const res = await startEntrantRental(operationId)
            if (res?.error) setError(res.error)
          })
        }}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-[#111111] text-white hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40 w-full"
      >
        <ClipboardList className="w-4 h-4" />
        {pending ? 'Préparation…' : 'Démarrer la location (EDL + contrat)'}
      </button>
      {!hasClient && (
        <p className="text-xs text-gray-400 text-center">Associez d&apos;abord un client à cette opération.</p>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
