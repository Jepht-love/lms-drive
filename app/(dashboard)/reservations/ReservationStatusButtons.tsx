'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateReservationStatus, updatePaymentInfo } from '@/lib/actions/reservations'
import { getReservationStatusLabel, getReservationStatusColor, formatPrice } from '@/lib/utils'
import type { ReservationStatus } from '@/types/database'
import { ClipboardList, AlertTriangle, CheckCircle2, ShieldCheck, X } from 'lucide-react'

export default function ReservationStatusButtons({
  reservationId,
  contractId,
  currentStatus,
  contractClosed = false,
  totalPrice,
}: {
  reservationId: string
  contractId?: string
  currentStatus: ReservationStatus
  contractClosed?: boolean
  totalPrice?: number | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<ReservationStatus>(currentStatus)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showAcompteModal, setShowAcompteModal] = useState(false)
  const [acompteAmount, setAcompteAmount] = useState('')

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

  async function handleConfirmerWithAcompte(skipAcompte = false) {
    setLoading(true)
    setErrorMsg(null)
    setShowAcompteModal(false)

    const amount = skipAcompte ? 0 : Number(acompteAmount)
    const result = await updateReservationStatus(reservationId, 'confirmee')
    if (result?.error) {
      setErrorMsg(result.error)
      setLoading(false)
      return
    }

    if (amount > 0) {
      const payStatus = totalPrice && amount >= totalPrice ? 'paye' : 'partiel'
      await updatePaymentInfo(reservationId, {
        payment_status: payStatus,
        payment_method: null,
        payment_amount: amount,
        payment_ref: null,
        payment_date: new Date().toISOString(),
      })
    }

    setStatus('confirmee')
    setAcompteAmount('')
    router.refresh()
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
            onClick={() => setShowAcompteModal(true)}
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

      {/* Modal acompte */}
      {showAcompteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setShowAcompteModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Acompte à encaisser</h3>
              <button onClick={() => setShowAcompteModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Montant (€)</label>
              <input
                type="number"
                value={acompteAmount}
                onChange={e => setAcompteAmount(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0"
                autoFocus
                inputMode="decimal"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
              />
              {totalPrice && Number(acompteAmount) > 0 && (
                <div className="mt-2 p-3 bg-blue-50 rounded-xl">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Total</span>
                    <span className="font-bold text-blue-900">{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-blue-700">Acompte</span>
                    <span className="font-bold text-blue-900">− {formatPrice(Number(acompteAmount))}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 pt-1 border-t border-blue-100">
                    <span className="text-blue-800 font-semibold">Reste à payer</span>
                    <span className="font-extrabold text-blue-900">{formatPrice(Math.max(0, totalPrice - Number(acompteAmount)))}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmerWithAcompte(true)}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl disabled:opacity-50"
              >
                Passer
              </button>
              <button
                onClick={() => handleConfirmerWithAcompte(false)}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
              >
                {loading ? '…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
