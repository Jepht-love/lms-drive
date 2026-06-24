import VehicleForm from '../VehicleForm'
import { createVehicle } from '@/lib/actions/vehicles'
import BackButton from '@/components/ui/BackButton'

export default function NewVehiclePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/vehicles" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouveau véhicule</h1>
          <p className="text-slate-500 mt-0.5">Ajoutez un véhicule à la flotte</p>
        </div>
      </div>
      <VehicleForm action={createVehicle} />
    </div>
  )
}
