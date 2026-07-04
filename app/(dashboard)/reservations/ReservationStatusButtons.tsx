'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateReservationStatus } from '@/lib/actions/reservations'
import { getReservationStatusLabel, getReservationStatusColor } from '@/lib/utils'
import type { ReservationStatus } from '@/types/database'
import { ClipboardList, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'

export default function ReservationStatusButtons({
  reservationId,
  contractId,
  currentStatus,
  contractClosed = false,
}: {
  reservationId: string
  contractId?: string
  currentStatus: ReservationStatus
  contractClosed?: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<ReservationStatus>(currentStatus)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => { setStatus(currentStatus) }, [currentStatus])

  async function handleChange(newStatus: ReservationStatus) {
    setLoading(true)
    setErrorMsg(null)
    const result = await updateReservationStatus(reservationId, newStatus)
    if (result?.error) {
      setErrorMsg(result.error)
    } else {
      setStatus(newStatus)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      {errorMsg && (
        <div className="px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{errorMsg}</div>
      )}
      {/* Statut actuel */}
      <div className={`px-3 py-2 rounded-xl text-sm font-medium text-center ${getReservationStatusColor(status)}`}>
        {getReservationStatusLabel(status)}
      </div>

      {/* Option → confirmer ou démarrer */}
      {status === 'option' && (
        <>
          <button
            onClick={() => handleChange('confirmee')}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all disabled:opacity-50"
          >
            {loading ? '…' : 'Confirmer la réservation'}
          </button>
          <button
            onClick={() => router.push(`/inspections/departure/${reservationId}`)}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            Démarrer + état des lieux départ
          </button>
          <button
            onClick={() => handleChange('annulee')}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
          >
            {loading ? '…' : 'Annuler'}
          </button>
        </>
      )}

      {/* Confirmée → démarrer via EDL départ */}
      {status === 'confirmee' && (
        <>
          <button
            onClick={() => router.push(`/inspections/departure/${reservationId}`)}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            Démarrer + état des lieux départ
          </button>
          <button
            onClick={() => handleChange('annulee')}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
          >
            {loading ? '…' : 'Annuler'}
          </button>
        </>
      )}

      {/* En cours → EDL retour obligatoire */}
      {status === 'en_cours' && contractId && (
        <button
          onClick={() => router.push(`/inspections/arrival/${contractId}`)}
          className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold bg-[#111111] text-white hover:bg-gray-900 flex items-center justify-center gap-2 transition-all"
        >
          <ClipboardList className="w-4 h-4" />
          État des lieux retour — rendre le véhicule
        </button>
      )}

      {/* En retard */}
      {status === 'en_retard' && contractId && (
        <>
          <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-200 text-orange-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">Retard constaté. Faites l'état des lieux de retour dès que le véhicule est rendu.</p>
          </div>
          <button
            onClick={() => router.push(`/inspections/arrival/${contractId}`)}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold bg-[#111111] text-white hover:bg-gray-900 flex items-center justify-center gap-2 transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            État des lieux retour — rendre le véhicule
          </button>
        </>
      )}

      {/* Terminée → selon état du contrat */}
      {status === 'terminee' && (
        contractClosed ? (
          <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-semibold">Véhicule rendu</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-semibold">Contrat clôturé</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-1">
            Véhicule rendu — validez le contrat ci-dessous pour libérer la caution
          </p>
        )
      )}

      {/* Annulée */}
      {status === 'annulee' && (
        <p className="text-xs text-gray-400 text-center py-1">Réservation annulée</p>
      )}
    </div>
  )
}
