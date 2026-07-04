'use client'

import { useState } from 'react'
import { updateVehicleStatus } from '@/lib/actions/vehicles'
import { getVehicleStatusColor, getVehicleStatusLabel } from '@/lib/utils'
import type { VehicleStatus } from '@/types/database'

const STATUSES: VehicleStatus[] = ['disponible', 'reserve', 'maintenance', 'hors_service']

export default function VehicleStatusButton({ vehicleId, currentStatus }: {
  vehicleId: string
  currentStatus: VehicleStatus
}) {
  const [status, setStatus] = useState<VehicleStatus>(currentStatus)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleChange(newStatus: VehicleStatus) {
    if (newStatus === status) return
    setLoading(true)
    setErrorMsg(null)
    const result = await updateVehicleStatus(vehicleId, newStatus)
    setLoading(false)
    if (result?.error) {
      setErrorMsg(result.error)
      return
    }
    setStatus(newStatus)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-2">Changer le statut manuellement :</p>
      {STATUSES.map(s => (
        <button
          key={s}
          onClick={() => handleChange(s)}
          disabled={loading || s === status}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 ${
            s === status
              ? getVehicleStatusColor(s) + ' cursor-default'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="capitalize">{getVehicleStatusLabel(s)}</span>
          {s === status && <span className="text-xs">● Actuel</span>}
        </button>
      ))}
      {loading && <p className="text-xs text-gray-400 text-center">Mise à jour...</p>}
      {errorMsg && <p className="text-xs text-red-500 text-center">{errorMsg}</p>}
    </div>
  )
}
