import { createClient } from '@/lib/supabase/server'
import ReservationForm from '../ReservationForm'
import { createReservation } from '@/lib/actions/reservations'

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; vehicle?: string }>
}) {
  const { client: clientId, vehicle: vehicleId } = await searchParams
  const supabase = await createClient()

  const [{ data: vehicles }, { data: clients }] = await Promise.all([
    supabase.from('vehicles').select('id, plate, brand, model, daily_price, weekly_price, deposit_amount, km_included_daily, extra_km_price').eq('is_active', true).order('brand'),
    supabase.from('clients').select('id, first_name, last_name, phone').order('last_name'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nouvelle réservation</h1>
        <p className="text-slate-500 mt-0.5">Créez une réservation pour un véhicule</p>
      </div>
      <ReservationForm
        action={createReservation}
        vehicles={vehicles ?? []}
        clients={clients ?? []}
        defaultClientId={clientId}
        defaultVehicleId={vehicleId}
      />
    </div>
  )
}
