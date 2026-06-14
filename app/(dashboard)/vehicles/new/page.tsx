import VehicleForm from '../VehicleForm'
import { createVehicle } from '@/lib/actions/vehicles'

export default function NewVehiclePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nouveau véhicule</h1>
        <p className="text-slate-500 mt-0.5">Ajoutez un véhicule à la flotte</p>
      </div>
      <VehicleForm action={createVehicle} />
    </div>
  )
}
