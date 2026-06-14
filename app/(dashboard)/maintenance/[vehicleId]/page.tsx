import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { MaintenanceRecord } from '@/lib/maintenance'
import MaintenanceHistory from './MaintenanceHistory'

export default async function VehicleMaintenancePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, current_km, next_service_km, next_service_date, last_wash_date')
    .eq('id', vehicleId)
    .single()

  if (!vehicle) notFound()

  const { data: records } = await supabase
    .from('maintenance_records')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false })

  const list  = (records ?? []) as MaintenanceRecord[]
  const total = list.reduce((s, r) => s + (r.amount ?? 0), 0)
  const count = list.length
  const last  = list[0]

  return (
    <div className="space-y-4">

      {/* Retour */}
      <Link href="/maintenance" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Entretien
      </Link>

      {/* En-tête véhicule */}
      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className="bg-white/15 border border-white/20 text-white text-sm font-mono font-bold px-2.5 py-1 rounded-lg tracking-wider">
            {vehicle.plate}
          </span>
          <h1 className="text-white text-lg font-extrabold">{vehicle.brand} {vehicle.model}</h1>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-white">{formatPrice(total)}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Total dépensé</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{count}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Interventions</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-white">
              {vehicle.current_km != null ? `${vehicle.current_km.toLocaleString('fr-FR')}` : '—'}
            </div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Km actuel</div>
          </div>
        </div>
      </div>

      {/* Ajouter */}
      <Link
        href={`/maintenance/${vehicleId}/new`}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99]"
      >
        <Plus className="w-4 h-4" /> Ajouter une intervention
      </Link>

      {/* Historique filtrable */}
      <MaintenanceHistory records={list} />

    </div>
  )
}
