import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Calendar, Wrench } from 'lucide-react'
import { getVehicleStatusColor, getVehicleStatusLabel, formatDate, formatPrice } from '@/lib/utils'
import VehicleStatusButton from '../VehicleStatusButton'
import DeleteButton from '@/components/ui/DeleteButton'
import { deleteVehicle } from '@/lib/actions/delete'

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single()

  if (!vehicle) notFound()

  const { data: recentReservations } = await supabase
    .from('reservations')
    .select('id, reservation_number, status, start_datetime, end_datetime, client:clients(first_name, last_name)')
    .eq('vehicle_id', id)
    .order('start_datetime', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/vehicles" className="p-2 rounded-xl hover:bg-slate-100 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.brand} {vehicle.model}</h1>
            <span className="bg-slate-900 text-white text-sm font-mono font-bold px-3 py-1 rounded-lg tracking-wider">
              {vehicle.plate}
            </span>
            <span className={`text-sm font-medium px-3 py-1 rounded-full border ${getVehicleStatusColor(vehicle.status)}`}>
              {getVehicleStatusLabel(vehicle.status)}
            </span>
          </div>
          {vehicle.version && <p className="text-slate-500 mt-0.5">{vehicle.version} {vehicle.year ? `· ${vehicle.year}` : ''}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/maintenance/${id}`} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Wrench className="w-4 h-4" /> Entretien
          </Link>
          <Link href={`/vehicles/${id}/edit`} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Edit className="w-4 h-4" /> Modifier
          </Link>
          <DeleteButton
            onConfirm={deleteVehicle.bind(null, id)}
            label="Supprimer le véhicule"
            confirmMessage={`Supprimer ${vehicle.plate} — ${vehicle.brand} ${vehicle.model} ? Le véhicule sera archivé.`}
            variant="text"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <InfoCard title="Informations générales">
            <InfoGrid items={[
              { label: 'Immatriculation', value: vehicle.plate },
              { label: 'Marque / Modèle', value: `${vehicle.brand} ${vehicle.model}` },
              { label: 'Version', value: vehicle.version },
              { label: 'Année', value: vehicle.year?.toString() },
              { label: 'Couleur', value: vehicle.color },
              { label: 'VIN', value: vehicle.vin },
              { label: 'Carburant', value: vehicle.fuel_type },
              { label: 'Catégorie', value: vehicle.category },
              { label: 'Transmission', value: vehicle.transmission },
              { label: 'Places', value: vehicle.seats?.toString() },
              { label: 'Portes', value: vehicle.doors?.toString() },
              { label: 'Puissance fiscale', value: vehicle.fiscal_power ? `${vehicle.fiscal_power} CV` : undefined },
            ]} />
          </InfoCard>

          <InfoCard title="Tarification">
            <InfoGrid items={[
              { label: 'Prix/jour', value: formatPrice(vehicle.daily_price) },
              { label: 'Prix/semaine', value: formatPrice(vehicle.weekly_price) },
              { label: 'Caution', value: formatPrice(vehicle.deposit_amount) },
              { label: 'KM inclus/jour', value: vehicle.km_included_daily?.toString() },
              { label: 'Supplément KM', value: vehicle.extra_km_price ? `${vehicle.extra_km_price}€/km` : undefined },
            ]} />
          </InfoCard>

          <InfoCard title="Assurance & entretien">
            <InfoGrid items={[
              { label: 'Assureur', value: vehicle.insurance_company },
              { label: 'N° contrat', value: vehicle.insurance_contract_ref },
              { label: 'Expiration assurance', value: vehicle.insurance_expiry ? formatDate(vehicle.insurance_expiry) : undefined },
              { label: 'Contrôle technique', value: vehicle.ct_date ? formatDate(vehicle.ct_date) : undefined },
              { label: 'Prochain entretien KM', value: vehicle.next_service_km?.toLocaleString('fr-FR') },
              { label: 'Prochain entretien date', value: vehicle.next_service_date ? formatDate(vehicle.next_service_date) : undefined },
              { label: 'KM actuels', value: vehicle.current_km.toLocaleString('fr-FR') },
            ]} />
          </InfoCard>

          {vehicle.notes && (
            <InfoCard title="Notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{vehicle.notes}</p>
            </InfoCard>
          )}
        </div>

        {/* Side */}
        <div className="space-y-4">
          <InfoCard title="Statut">
            <VehicleStatusButton vehicleId={vehicle.id} currentStatus={vehicle.status} />
          </InfoCard>

          {/* Recent reservations */}
          <InfoCard title="Réservations récentes">
            {recentReservations?.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune réservation</p>
            ) : (
              <div className="space-y-2">
                {recentReservations?.map(r => (
                  <Link key={r.id} href={`/reservations/${r.id}`} className="block p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-500">{r.reservation_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'en_cours' ? 'bg-green-100 text-green-700' : r.status === 'terminee' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-1">
                      {(r.client as any)?.first_name} {(r.client as any)?.last_name}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(r.start_datetime)} → {formatDate(r.end_datetime)}</p>
                  </Link>
                ))}
              </div>
            )}
            <Link href={`/reservations?vehicle=${vehicle.id}`} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Calendar className="w-3 h-3" /> Voir toutes
            </Link>
          </InfoCard>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 text-sm mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InfoGrid({ items }: { items: { label: string; value?: string | null }[] }) {
  const visible = items.filter(i => i.value)
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {visible.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs text-slate-400 uppercase tracking-wide">{label}</dt>
          <dd className="text-sm font-medium text-slate-800 mt-0.5 capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
