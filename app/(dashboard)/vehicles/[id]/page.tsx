import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Calendar, Wrench, AlertTriangle, FileText, TrendingUp } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { getVehicleStatusColor, getVehicleStatusLabel, formatDate, formatPrice } from '@/lib/utils'
import VehicleStatusButton from '../VehicleStatusButton'
import VehicleMaintenanceCard from './VehicleMaintenanceCard'
import DeleteButton from '@/components/ui/DeleteButton'
import { deleteVehicle } from '@/lib/actions/delete'
import { computeVehicleNeeds, buildLastByType } from '@/lib/maintenance-health'
import type { MaintenanceFlag } from '@/types/database'

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single()

  if (!vehicle) notFound()

  // Les données financières (CA, rentabilité, charges) sont réservées aux managers.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user?.id ?? '').single()
  const isManager = caller?.role === 'gerant' || caller?.role === 'associe'

  const { data: recentReservations } = await supabase
    .from('reservations')
    .select('id, reservation_number, status, start_datetime, end_datetime, client:clients(first_name, last_name)')
    .eq('vehicle_id', id)
    .order('start_datetime', { ascending: false })
    .limit(5)

  // ── Location en cours + réservations futures (vue rapide "et après ?") ──
  const { data: activeReservation } = await supabase
    .from('reservations')
    .select('id, reservation_number, status, start_datetime, end_datetime, client:clients(first_name, last_name)')
    .eq('vehicle_id', id)
    .in('status', ['en_cours', 'en_retard'])
    .limit(1)
    .maybeSingle()

  const { data: futureReservations } = await supabase
    .from('reservations')
    .select('id, reservation_number, start_datetime, end_datetime, client:clients(first_name, last_name)')
    .eq('vehicle_id', id)
    .in('status', ['confirmee', 'option'])
    .gt('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(5)

  // ── État mécanique : échéances + km depuis dernier entretien ──
  const { data: maintRecords } = await supabase
    .from('maintenance_records')
    .select('type, km_at_intervention, date, amount')
    .eq('vehicle_id', id)
    .order('date', { ascending: false })

  const needs = computeVehicleNeeds(vehicle, buildLastByType(maintRecords ?? []), new Date())
  const flags = (vehicle.maintenance_flags ?? []) as MaintenanceFlag[]
  const lastKmRecord = (maintRecords ?? []).find(r => r.km_at_intervention != null)
  const kmSinceService = lastKmRecord && vehicle.current_km != null
    ? vehicle.current_km - (lastKmRecord.km_at_intervention as number)
    : null

  // ── Historique & immobilisations ──
  const { count: totalRentals } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_id', id)
  const { count: completedRentals } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_id', id)
    .eq('status', 'terminee')
  const immobCount = (maintRecords ?? []).length

  // ── Performance commerciale (CA, occupation, rentabilité) ──
  const { data: allRes } = await supabase
    .from('reservations')
    .select('status, total_price, start_datetime, end_datetime')
    .eq('vehicle_id', id)

  const caGenere = (allRes ?? [])
    .filter(r => r.status === 'terminee')
    .reduce((s, r) => s + (r.total_price ?? 0), 0)

  // Taux d'occupation sur les 90 derniers jours (jours loués / 90)
  const now90      = new Date()
  const windowFrom = new Date(now90.getTime() - 90 * 86400000)
  let rentedDays = 0
  for (const r of allRes ?? []) {
    if (r.status === 'annulee') continue
    const s = new Date(r.start_datetime)
    const e = new Date(r.end_datetime)
    const from = s > windowFrom ? s : windowFrom
    const to   = e < now90 ? e : now90
    if (to > from) rentedDays += (to.getTime() - from.getTime()) / 86400000
  }
  const occupation90 = Math.min(100, Math.round((rentedDays / 90) * 100))

  // Charges : entretien (maintenance_records) + autres dépenses (compta)
  const entretienTotal = (maintRecords ?? []).reduce((s, r) => s + ((r as { amount?: number }).amount ?? 0), 0)
  const { data: vehicleExpenses } = await supabase
    .from('financial_transactions')
    .select('amount')
    .eq('vehicle_id', id)
    .eq('type', 'depense')
  const autresCharges = (vehicleExpenses ?? []).reduce((s, t) => s + (t.amount ?? 0), 0)
  const rentabilite   = caGenere - entretienTotal - autresCharges

  // ── Incidents (infractions + sinistres) — RLS gérant/associé ──
  const [{ data: vInfractions }, { data: vAccidents }] = await Promise.all([
    supabase
      .from('infractions')
      .select('id, infraction_date, type, amount, status')
      .eq('vehicle_id', id)
      .order('infraction_date', { ascending: false }),
    supabase
      .from('accidents')
      .select('id, accident_date, description, status')
      .eq('vehicle_id', id)
      .order('accident_date', { ascending: false }),
  ])

  // ── Documents administratifs rattachés au véhicule ──
  const { data: vDocuments } = await supabase
    .from('documents')
    .select('id, name, subcategory, file_url, expiry_date')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })

  // ── Utilisations internes + mises à disposition inter-agences (déjà en base,
  // jamais affichées sur la fiche véhicule) ──
  const { data: vInternalTrips } = await supabase
    .from('internal_trips')
    .select('id, purpose, start_datetime, end_datetime, user:profiles(full_name)')
    .eq('vehicle_id', id)
    .order('start_datetime', { ascending: false })
    .limit(5)

  const { data: vInterAgencyOps } = await supabase
    .from('inter_agency_rentals')
    .select('id, direction, status, start_date, end_date_expected, partner_agency:partner_agencies(name)')
    .eq('vehicle_id', id)
    .order('start_date', { ascending: false })
    .limit(5)

  // ── Photos de référence (bucket vehicle-photos) ──
  const photoPaths = (vehicle.reference_photos ?? []) as string[]
  const photoUrls = (await Promise.all(
    photoPaths.map(async p => {
      if (/^https?:\/\//.test(p)) return p
      const { data } = await supabase.storage.from('vehicle-photos').createSignedUrl(p, 3600)
      return data?.signedUrl ?? null
    })
  )).filter((u): u is string => !!u)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <BackButton fallbackHref="/vehicles" className="p-2 rounded-xl hover:bg-gray-100 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{vehicle.brand} {vehicle.model}</h1>
            <span className="bg-gray-100 text-gray-500 text-xs font-mono font-medium px-2.5 py-1 rounded-lg tracking-wider">
              {vehicle.plate}
            </span>
            <span className={`text-sm font-medium px-3 py-1 rounded-full border ${getVehicleStatusColor(vehicle.status)}`}>
              {getVehicleStatusLabel(vehicle.status)}
            </span>
          </div>
          {vehicle.version && <p className="text-gray-500 mt-0.5">{vehicle.version} {vehicle.year ? `· ${vehicle.year}` : ''}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/maintenance/${id}`} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Wrench className="w-4 h-4" /> Entretien
          </Link>
          <Link href={`/vehicles/${id}/edit`} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Edit className="w-4 h-4" /> Modifier
          </Link>
          <DeleteButton
            onConfirm={deleteVehicle.bind(null, id)}
            label="Supprimer le véhicule"
            confirmMessage={`Supprimer ${vehicle.brand} ${vehicle.model} (${vehicle.plate}) ? Le véhicule sera archivé.`}
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
              { label: 'Puissance moteur', value: vehicle.engine_power ? `${vehicle.engine_power} ch` : undefined },
              { label: 'Autonomie carburant', value: vehicle.current_fuel_range_km != null ? `${vehicle.current_fuel_range_km} km` : undefined },
            ]} />
          </InfoCard>

          <InfoCard title="Tarification">
            <InfoGrid items={[
              { label: 'Prix/jour', value: formatPrice(vehicle.daily_price) },
              { label: 'Prix/semaine', value: formatPrice(vehicle.weekly_price) },
              { label: 'Prix weekend', value: vehicle.price_weekend_full ? formatPrice(vehicle.price_weekend_full) : undefined },
              { label: 'Caution', value: formatPrice(vehicle.deposit_amount) },
              { label: 'KM inclus/jour', value: vehicle.km_included_daily?.toString() },
              { label: 'KM inclus/semaine', value: vehicle.km_included_week?.toString() },
              { label: 'Supplément KM', value: vehicle.extra_km_price ? `${vehicle.extra_km_price}€/km` : undefined },
              { label: 'Mise en location', value: vehicle.rental_start_date ? formatDate(vehicle.rental_start_date) : undefined },
            ]} />
          </InfoCard>

          {/* Performance commerciale (managers uniquement) */}
          {isManager && (
          <InfoCard title="Performance commerciale">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">CA généré</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">{formatPrice(caGenere)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{completedRentals ?? 0} location{(completedRentals ?? 0) > 1 ? 's' : ''} terminée{(completedRentals ?? 0) > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Occupation 90j</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">{occupation90}%</p>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2">
                  <div className="h-full bg-[#111111] rounded-full" style={{ width: `${occupation90}%` }} />
                </div>
              </div>
            </div>
            <InfoGrid items={[
              { label: 'Charges entretien', value: formatPrice(entretienTotal) },
              { label: 'Autres charges', value: formatPrice(autresCharges) },
            ]} />
            <div className={`mt-3 flex items-center justify-between rounded-xl px-4 py-3 ${rentabilite >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <TrendingUp className={`w-4 h-4 ${rentabilite >= 0 ? 'text-green-600' : 'text-red-500'}`} /> Rentabilité
              </span>
              <span className={`text-lg font-black ${rentabilite >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {rentabilite >= 0 ? '+' : ''}{formatPrice(rentabilite)}
              </span>
            </div>
          </InfoCard>
          )}

          {/* Photos du véhicule */}
          {photoUrls.length > 0 && (
            <InfoCard title="Photos du véhicule">
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Véhicule ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </InfoCard>
          )}

          <InfoCard title="Assurance & entretien">
            <InfoGrid items={[
              { label: 'Assureur', value: vehicle.insurance_company },
              { label: 'N° contrat', value: vehicle.insurance_contract_ref },
              { label: 'Expiration assurance', value: vehicle.insurance_expiry ? formatDate(vehicle.insurance_expiry) : undefined },
              { label: 'Contrôle technique', value: vehicle.ct_date ? formatDate(vehicle.ct_date) : undefined },
              { label: 'Prochain entretien KM', value: vehicle.next_service_km?.toLocaleString('fr-FR') },
              { label: 'Prochain entretien date', value: vehicle.next_service_date ? formatDate(vehicle.next_service_date) : undefined },
              { label: 'KM actuels', value: vehicle.current_km.toLocaleString('fr-FR') },
              { label: 'Km depuis entretien', value: kmSinceService != null ? `${kmSinceService.toLocaleString('fr-FR')} km` : undefined },
            ]} />
          </InfoCard>

          {vehicle.notes && (
            <InfoCard title="Notes">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{vehicle.notes}</p>
            </InfoCard>
          )}
        </div>

        {/* Side */}
        <div className="space-y-4">
          <InfoCard title="Statut">
            <VehicleStatusButton vehicleId={vehicle.id} currentStatus={vehicle.status} />
          </InfoCard>

          {(activeReservation || (futureReservations && futureReservations.length > 0)) && (
            <InfoCard title="Location">
              <div className="space-y-3">
                {activeReservation ? (
                  <Link
                    href={`/reservations/${activeReservation.id}`}
                    className={`block p-3 rounded-xl ${activeReservation.status === 'en_retard' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${activeReservation.status === 'en_retard' ? 'text-red-600' : 'text-green-700'}`}>
                        {activeReservation.status === 'en_retard' ? 'En retard' : 'En cours'}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{activeReservation.reservation_number}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {(activeReservation.client as any)?.first_name} {(activeReservation.client as any)?.last_name}
                    </p>
                    <p className="text-xs text-gray-400">Retour prévu : {formatDate(activeReservation.end_datetime)}</p>
                  </Link>
                ) : (
                  <p className="text-xs text-gray-400">Pas de location en cours</p>
                )}

                {futureReservations && futureReservations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Réservé ensuite</p>
                    <div className="space-y-1.5">
                      {futureReservations.map(r => (
                        <Link key={r.id} href={`/reservations/${r.id}`} className="block p-2 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors">
                          <p className="text-xs font-semibold text-blue-800">
                            {(r.client as any)?.first_name} {(r.client as any)?.last_name}
                          </p>
                          <p className="text-[11px] text-blue-500">{formatDate(r.start_datetime)} → {formatDate(r.end_datetime)}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </InfoCard>
          )}

          <VehicleMaintenanceCard vehicleId={vehicle.id} status={vehicle.status} needs={needs} flags={flags} />

          <InfoCard title="Activité">
            <InfoGrid items={[
              { label: 'Locations totales', value: String(totalRentals ?? 0) },
              { label: 'Terminées', value: String(completedRentals ?? 0) },
              { label: 'Immobilisations', value: String(immobCount) },
              { label: 'Dernier lavage', value: vehicle.last_wash_date ? formatDate(vehicle.last_wash_date) : undefined },
            ]} />
            <Link href={`/maintenance/${id}`} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Wrench className="w-3 h-3" /> Détail des immobilisations
            </Link>
          </InfoCard>

          {/* Historique des locations */}
          <InfoCard title="Historique des locations">
            {recentReservations?.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune réservation</p>
            ) : (
              <div className="space-y-2">
                {recentReservations?.map(r => (
                  <Link key={r.id} href={`/reservations/${r.id}`} className="block p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-500">{r.reservation_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'en_cours' ? 'bg-green-100 text-green-700' : r.status === 'terminee' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">
                      {(r.client as any)?.first_name} {(r.client as any)?.last_name}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(r.start_datetime)} → {formatDate(r.end_datetime)}</p>
                  </Link>
                ))}
              </div>
            )}
            <Link href={`/reservations?vehicle=${vehicle.id}`} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Calendar className="w-3 h-3" /> Voir toutes
            </Link>
          </InfoCard>

          {/* Utilisations internes */}
          {(vInternalTrips?.length ?? 0) > 0 && (
            <InfoCard title="Utilisations internes">
              <div className="space-y-2">
                {vInternalTrips?.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 capitalize truncate">{t.purpose}</p>
                      <p className="text-xs text-gray-400">{t.user?.full_name} · {formatDate(t.start_datetime)}</p>
                    </div>
                    {!t.end_datetime && (
                      <span className="text-xs font-bold text-green-600 flex-shrink-0">En cours</span>
                    )}
                  </div>
                ))}
              </div>
              <Link href="/internal-trips" className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Calendar className="w-3 h-3" /> Voir tout
              </Link>
            </InfoCard>
          )}

          {/* Mises à disposition inter-agences */}
          {(vInterAgencyOps?.length ?? 0) > 0 && (
            <InfoCard title="Mises à disposition inter-agences">
              <div className="space-y-2">
                {vInterAgencyOps?.map((op: any) => (
                  <Link key={op.id} href={`/partnerships/${op.id}`} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {op.direction === 'out' ? '→' : '←'} {op.partner_agency?.name ?? 'Partenaire'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(op.start_date)} → {formatDate(op.end_date_expected)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 flex-shrink-0">{op.status}</span>
                  </Link>
                ))}
              </div>
              <Link href="/partnerships" className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Calendar className="w-3 h-3" /> Voir tout
              </Link>
            </InfoCard>
          )}

          {/* Historique des incidents (managers uniquement) */}
          {isManager && (
          <InfoCard title="Incidents">
            {(vInfractions?.length ?? 0) === 0 && (vAccidents?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">Aucun incident</p>
            ) : (
              <div className="space-y-2">
                {vInfractions?.map((inf: any) => (
                  <Link key={inf.id} href={`/incidents/infractions/${inf.id}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">Amende · {inf.type}</p>
                      <p className="text-xs text-gray-400">{formatDate(inf.infraction_date)}</p>
                    </div>
                    {inf.amount > 0 && <span className="text-xs font-bold text-gray-600 flex-shrink-0">{formatPrice(inf.amount)}</span>}
                  </Link>
                ))}
                {vAccidents?.map((acc: any) => (
                  <Link key={acc.id} href={`/incidents/sinistres/${acc.id}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-red-50 hover:bg-red-100 transition-colors">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">Sinistre · {acc.description}</p>
                      <p className="text-xs text-gray-400">{formatDate(acc.accident_date)} · {acc.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InfoCard>
          )}

          {/* Documents administratifs */}
          <InfoCard title="Documents">
            {(vDocuments?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">Aucun document rattaché</p>
            ) : (
              <div className="space-y-2">
                {vDocuments?.map((doc: any) => (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {doc.subcategory}
                        {doc.expiry_date && ` · exp. ${formatDate(doc.expiry_date)}`}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
            <Link href="/documents" className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <FileText className="w-3 h-3" /> Bibliothèque documentaire
            </Link>
          </InfoCard>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="font-semibold text-gray-800 text-sm mb-3">{title}</h3>
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
          <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
          <dd className="text-sm font-medium text-gray-800 mt-0.5 capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
