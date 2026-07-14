'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Check, ShieldAlert, RotateCcw } from 'lucide-react'
import { NEED_BADGE, type VehicleNeed } from '@/lib/maintenance-health'
import type { MaintenanceFlag } from '@/types/database'
import { setVehicleRepairStatus } from '@/lib/actions/vehicle-issues'
import ResolveDamageRow from '@/components/vehicles/ResolveDamageRow'

export default function VehicleMaintenanceCard({
  vehicleId,
  status,
  needs,
  flags,
}: {
  vehicleId: string
  status: string
  needs: VehicleNeed[]
  flags: MaintenanceFlag[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const serviceNeeds = needs.filter(n => n.key !== 'degradation')
  // « En réparation » couvre aussi le passage au garage (statut `maintenance`,
  // posé automatiquement à la création d'une intervention atelier) : un véhicule
  // au garage doit pouvoir être marqué « réparé » sans passer par le réglage manuel.
  const inRepair = status === 'a_reparer' || status === 'maintenance'
  const nothing = serviceNeeds.length === 0 && flags.length === 0

  function toggleRepair() {
    startTransition(async () => {
      setErrorMsg(null)
      const result = await setVehicleRepairStatus(vehicleId, !inRepair)
      if (result && 'error' in result) { setErrorMsg(result.error ?? null); return }
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-gray-400" /> État mécanique
      </h3>

      {nothing ? (
        <p className="text-sm text-green-600 flex items-center gap-1.5">
          <Check className="w-4 h-4" /> Aucune échéance ni dégradation
        </p>
      ) : (
        <div className="space-y-3">
          {/* Échéances d'entretien (vidange / pneus / révision / CT) */}
          {serviceNeeds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {serviceNeeds.map(n => (
                <span key={n.key} className={`text-xs px-2 py-0.5 rounded-lg font-semibold border ${NEED_BADGE[n.severity]}`}>
                  {n.label} · {n.detail}
                </span>
              ))}
            </div>
          )}

          {/* Dommages actifs — chacun soldé individuellement avec son coût de réparation */}
          {flags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Dommages à solder ({flags.length})
              </p>
              {flags.map(f => (
                <ResolveDamageRow key={f.id} vehicleId={vehicleId} flag={f} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bascule manuelle de la catégorie « À réparer » */}
      <button
        onClick={toggleRepair}
        disabled={pending}
        className={`mt-3 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
          inRepair
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
        }`}
      >
        {inRepair
          ? (<><RotateCcw className="w-4 h-4" /> Remettre en service</>)
          : (<><ShieldAlert className="w-4 h-4" /> Marquer à réparer</>)}
      </button>
      {errorMsg && <p className="text-xs text-red-500 text-center mt-1">{errorMsg}</p>}
    </div>
  )
}
