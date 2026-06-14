import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import VehicleForm from '../../VehicleForm'
import { updateVehicle } from '@/lib/actions/vehicles'

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', id).single()
  if (!vehicle) notFound()

  const action = updateVehicle.bind(null, id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/vehicles/${id}`} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modifier le véhicule</h1>
          <p className="text-slate-500 mt-0.5">{vehicle.brand} {vehicle.model} · {vehicle.plate}</p>
        </div>
      </div>
      <VehicleForm action={action} vehicle={vehicle} />
    </div>
  )
}
