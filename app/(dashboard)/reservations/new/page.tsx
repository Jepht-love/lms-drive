import { createClient } from '@/lib/supabase/server'
import ReservationForm from '../ReservationForm'
import { createReservation } from '@/lib/actions/reservations'
import BackButton from '@/components/ui/BackButton'

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; vehicle?: string; start?: string; end?: string }>
}) {
  const { client: clientId, vehicle: vehicleId, start, end } = await searchParams
  const supabase = await createClient()

  const [{ data: vehicles }, { data: clients }] = await Promise.all([
    supabase.from('vehicles').select('id, plate, brand, model, daily_price, weekly_price, deposit_amount, km_included_daily, extra_km_price').eq('is_active', true).order('brand'),
    supabase.from('clients').select('id, first_name, last_name, phone, status, address, id_doc_front_path, id_doc_back_path, license_front_path').order('last_name'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/reservations" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle réservation</h1>
          <p className="text-gray-500 mt-0.5">Créez une réservation pour un véhicule</p>
        </div>
      </div>
      <ReservationForm
        action={createReservation}
        vehicles={vehicles ?? []}
        clients={clients ?? []}
        defaultClientId={clientId}
        defaultVehicleId={vehicleId}
        defaultStartDatetime={start}
        defaultEndDatetime={end}
      />
    </div>
  )
}
