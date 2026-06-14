'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

const str = (fd: FormData, k: string) => (fd.get(k) as string)?.trim() || null
const num = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string)?.trim()
  if (!v) return 0
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const int = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string)?.trim()
  return v ? parseInt(v, 10) || null : null
}

export async function createAgency(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const name = str(formData, 'name')
  if (!name) return { error: 'Nom requis' }

  const { data, error } = await supabase.from('partner_agencies').insert({
    name,
    contact_name: str(formData, 'contact_name'),
    phone:        str(formData, 'phone'),
    email:        str(formData, 'email'),
    address:      str(formData, 'address'),
    siret:        str(formData, 'siret'),
    notes:        str(formData, 'notes'),
  }).select('id').single()
  if (error) return { error: error.message }

  revalidatePath('/partnerships/agencies')
  return { success: true, id: data.id }
}

export async function createOperation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const direction = str(formData, 'direction')
  const partnerId = str(formData, 'partner_agency_id')
  const startDate = str(formData, 'start_date')
  const endExpected = str(formData, 'end_date_expected')
  if (!direction || !partnerId || !startDate || !endExpected) {
    return { error: 'Direction, partenaire et dates requis' }
  }

  const vehicleId = str(formData, 'vehicle_id')

  const { data, error } = await supabase.from('inter_agency_rentals').insert({
    direction,
    partner_agency_id:            partnerId,
    vehicle_id:                   direction === 'out' ? vehicleId : null,
    external_vehicle_description: direction === 'in' ? str(formData, 'external_vehicle_description') : null,
    client_reservation_id:        direction === 'in' ? str(formData, 'client_reservation_id') : null,
    start_date:                   startDate,
    end_date_expected:            endExpected,
    departure_km:                 int(formData, 'departure_km'),
    fuel_level_departure:         int(formData, 'fuel_level_departure') ?? 8,
    rental_cost:                  num(formData, 'rental_cost'),
    client_price:                 direction === 'in' ? num(formData, 'client_price') : 0,
    deposit_amount:               num(formData, 'deposit_amount'),
    notes:                        str(formData, 'notes'),
    status:                       'en_cours',
  }).select('id').single()
  if (error) return { error: error.message }

  // D1 — véhicule sortant → mis à disposition
  if (direction === 'out' && vehicleId) {
    const { data: agency } = await supabase.from('partner_agencies').select('name').eq('id', partnerId).single()
    await supabase.from('vehicles').update({
      status: 'mis_a_disposition',
      availability_note: `Chez ${agency?.name ?? 'partenaire'} jusqu'au ${formatDate(endExpected)}`,
    }).eq('id', vehicleId)
  }

  revalidatePath('/partnerships')
  return { success: true, id: data.id }
}

export async function recordReturn(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('inter_agency_rentals').update({
    return_km:         int(formData, 'return_km'),
    fuel_level_return: int(formData, 'fuel_level_return'),
    end_date_actual:   new Date().toISOString(),
    status:            'termine',
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/partnerships/${id}`)
  return { success: true }
}

export async function updateOperationStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('inter_agency_rentals').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  // Clôture → si véhicule sortant, le remettre disponible
  if (status === 'cloture') {
    const { data: op } = await supabase
      .from('inter_agency_rentals')
      .select('direction, vehicle_id, return_km, rental_cost, partner_agencies(name)')
      .eq('id', id).single()
    if (op?.direction === 'out' && op.vehicle_id) {
      const update: Record<string, unknown> = { status: 'disponible', availability_note: null }
      if (op.return_km != null) update.current_km = op.return_km
      await supabase.from('vehicles').update(update).eq('id', op.vehicle_id)
    }
    // S6 — enregistrement automatique en comptabilité
    if (op && (op.rental_cost ?? 0) > 0) {
      const partner = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
      await supabase.from('financial_transactions').insert({
        date:       new Date().toISOString().slice(0, 10),
        type:       op.direction === 'out' ? 'recette' : 'depense',
        category:   op.direction === 'out' ? 'mise_a_disposition_sortante' : 'location_vehicule_partenaire',
        amount:     op.rental_cost,
        vehicle_id: op.direction === 'out' ? op.vehicle_id : null,
        notes:      `Inter-agences ${op.direction === 'out' ? 'sortant' : 'entrant'} — ${partner?.name ?? ''}`,
        reference:  id, created_by: user.id,
      })
    }
  }

  revalidatePath(`/partnerships/${id}`)
  return { success: true }
}
