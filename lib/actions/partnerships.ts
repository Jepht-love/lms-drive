'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate, generateReservationNumber, calculateRentalDays } from '@/lib/utils'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'

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

/**
 * Supprime une agence partenaire — bloqué s'il reste des opérations de mise à
 * disposition ou des véhicules partenaires rattachés (sinon on orpheline des
 * données). Il faut d'abord traiter/supprimer ces éléments liés.
 */
export async function deleteAgency(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { count: opsCount } = await supabase
    .from('inter_agency_rentals')
    .select('id', { count: 'exact', head: true })
    .eq('partner_agency_id', id)
  if (opsCount && opsCount > 0) {
    return { error: `Suppression impossible : ${opsCount} opération(s) de mise à disposition liée(s) à cette agence.` }
  }

  const { count: vehCount } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('partner_agency_id', id)
  if (vehCount && vehCount > 0) {
    return { error: `Suppression impossible : ${vehCount} véhicule(s) partenaire(s) rattaché(s) à cette agence.` }
  }

  const { error } = await supabase.from('partner_agencies').delete().eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'partner_agency_deleted',
    entity_type: 'partner_agencies', entity_id: id, metadata: {},
  })

  revalidatePath('/partnerships')
  revalidatePath('/partnerships/agencies')
  return { success: true }
}

/**
 * Supprime une opération de mise à disposition (sortante ou entrante) et TOUT ce
 * qui lui est rattaché : contrat(s) de convention + états des lieux + PDF, document
 * archivé (« convention_ia »), écritures comptables. Un véhicule sortant est remis
 * disponible. Une opération entrante DÉJÀ démarrée en location réelle (réservation
 * + EDL) est bloquée : on supprime d'abord la réservation liée pour ne pas casser
 * cette chaîne.
 */
export async function deleteOperation(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: op } = await supabase
    .from('inter_agency_rentals')
    .select('id, direction, vehicle_id, client_reservation_id')
    .eq('id', id).single()
  if (!op) return { error: 'Opération introuvable' }

  if (op.client_reservation_id) {
    return { error: 'Cette opération entrante a été démarrée en location. Supprimez d\'abord la réservation liée, puis l\'opération.' }
  }

  // 1) Contrats de convention liés → EDL puis PDF puis contrat
  const { data: convContracts } = await supabase
    .from('contracts')
    .select('id, pdf_storage_path')
    .eq('inter_agency_rental_id', id)
  for (const c of convContracts ?? []) {
    await supabase.from('inspections').delete().eq('contract_id', c.id)
    if (c.pdf_storage_path) await supabase.storage.from('contracts-pdf').remove([c.pdf_storage_path])
  }
  if (convContracts?.length) {
    await supabase.from('contracts').delete().eq('inter_agency_rental_id', id)
  }

  // 2) Document archivé de la convention (subcategory convention_ia, tag = opId)
  await supabase.from('documents').delete().eq('subcategory', 'convention_ia').contains('tags', [id])

  // 3) Reste éventuel du dossier PDF conventions/<id>/
  const { data: convFiles } = await supabase.storage.from('contracts-pdf').list(`conventions/${id}`)
  if (convFiles?.length) {
    await supabase.storage.from('contracts-pdf').remove(convFiles.map(f => `conventions/${id}/${f.name}`))
  }

  // 4) Écritures comptables liées (recette sortante / dépense + recette client)
  await supabase.from('financial_transactions').delete().in('reference', [id, `${id}:client`])

  // 5) Véhicule sortant remis disponible (puis recalcul du vrai statut)
  if (op.direction === 'out' && op.vehicle_id) {
    await supabase.from('vehicles').update({ status: 'disponible', availability_note: null }).eq('id', op.vehicle_id)
    await recomputeVehicleStatus(supabase, op.vehicle_id)
  }

  // 6) L'opération elle-même
  const { error } = await supabase.from('inter_agency_rentals').delete().eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'inter_agency_rental_deleted',
    entity_type: 'inter_agency_rentals', entity_id: id, metadata: { direction: op.direction },
  })

  revalidatePath('/partnerships')
  revalidatePath('/accounting')
  revalidatePath('/documents')
  if (op.vehicle_id) { revalidatePath('/vehicles'); revalidatePath(`/vehicles/${op.vehicle_id}`) }
  return { success: true }
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

  // Possibilité de créer le client à la volée (les deux sens) plutôt que d'en
  // choisir un existant — pour enregistrer l'opération au nom d'un nouveau client.
  let clientId = str(formData, 'client_id')
  const newFirstName = str(formData, 'new_client_first_name')
  const newLastName = str(formData, 'new_client_last_name')
  const newPhone = str(formData, 'new_client_phone')
  if (newFirstName && newLastName && newPhone) {
    const { data: newClient, error: clientError } = await supabase.from('clients').insert({
      first_name: newFirstName, last_name: newLastName, phone: newPhone, created_by: user.id,
    }).select('id').single()
    if (clientError) return { error: clientError.message }
    clientId = newClient.id
  }

  const { data, error } = await supabase.from('inter_agency_rentals').insert({
    direction,
    partner_agency_id:            partnerId,
    vehicle_id:                   direction === 'out' ? vehicleId : null,
    external_vehicle_description: direction === 'in' ? str(formData, 'external_vehicle_description') : null,
    client_reservation_id:        str(formData, 'client_reservation_id'),
    client_id:                    clientId,
    start_date:                   startDate,
    end_date_expected:            endExpected,
    departure_km:                 int(formData, 'departure_km'),
    fuel_level_departure:         int(formData, 'fuel_level_departure'),
    rental_cost:                  num(formData, 'rental_cost'),
    client_price:                 num(formData, 'client_price'),
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

  // Inscription comptable immédiate (recette sortante / dépense entrante).
  await bookOperationTransaction(supabase, data.id, user.id)

  revalidatePath('/partnerships')
  revalidatePath('/accounting')
  return { success: true, id: data.id }
}

// Le CA/dépense inter-agences est booké dès la CRÉATION de l'opération (et non
// au retour/clôture, deux actions manuelles facilement oubliées) → la recette
// apparaît immédiatement dans la compta. Daté sur le jour de l'opération
// (start_date) pour tomber dans "recettes du jour" quand l'opération est du jour.
// Garde anti-doublon sur `reference` : retour et clôture rappellent la fonction
// par sécurité (no-op si déjà écrit), ce qui rattrape aussi les opérations
// créées avant ce correctif quand on les fait avancer.
async function bookOperationTransaction(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data: op } = await supabase
    .from('inter_agency_rentals')
    .select('direction, vehicle_id, rental_cost, client_price, start_date, partner_agencies(name)')
    .eq('id', id).single()
  if (!op) return

  const partner = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
  const partnerName = partner?.name ?? ''
  const date = (op.start_date ?? new Date().toISOString()).slice(0, 10)

  // Lignes comptables selon le sens. Référence distincte par ligne (anti-doublon)
  // car une entrante en génère deux : la dépense versée au partenaire ET la
  // recette facturée au client (sinon le CA de l'entrante reste invisible).
  type Line = { reference: string; type: 'recette' | 'depense'; category: string; amount: number; vehicle_id: string | null; notes: string }
  const lines: Line[] = []
  if (op.direction === 'out') {
    if ((op.rental_cost ?? 0) > 0) lines.push({
      reference: id, type: 'recette', category: 'mise_a_disposition_sortante',
      amount: op.rental_cost, vehicle_id: op.vehicle_id,
      notes: `Inter-agences sortant — ${partnerName}`,
    })
  } else {
    if ((op.rental_cost ?? 0) > 0) lines.push({
      reference: id, type: 'depense', category: 'location_vehicule_partenaire',
      amount: op.rental_cost, vehicle_id: null,
      notes: `Inter-agences entrant (coût partenaire) — ${partnerName}`,
    })
    if ((op.client_price ?? 0) > 0) lines.push({
      reference: `${id}:client`, type: 'recette', category: 'location',
      amount: op.client_price, vehicle_id: null,
      notes: `Inter-agences entrant (facturé client) — ${partnerName}`,
    })
  }
  if (lines.length === 0) return

  const { data: existing } = await supabase
    .from('financial_transactions').select('reference').in('reference', lines.map(l => l.reference))
  const existingRefs = new Set((existing ?? []).map(e => e.reference))
  const toInsert = lines.filter(l => !existingRefs.has(l.reference))
  if (toInsert.length === 0) return

  const { error } = await supabase.from('financial_transactions').insert(
    toInsert.map(l => ({ date, type: l.type, category: l.category, amount: l.amount, vehicle_id: l.vehicle_id, notes: l.notes, reference: l.reference, created_by: userId })),
  )
  if (error) console.error('Échec enregistrement comptable opération inter-agence', id, error.message)
}

export async function recordReturn(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const returnKm = int(formData, 'return_km')

  const { error } = await supabase.from('inter_agency_rentals').update({
    return_km:         returnKm,
    fuel_level_return: int(formData, 'fuel_level_return'),
    end_date_actual:   new Date().toISOString(),
    status:            'termine',
  }).eq('id', id)
  if (error) return { error: error.message }

  // Le km relevé au retour remonte immédiatement sur le compteur du véhicule
  // (opération sortante uniquement) — sans attendre la clôture, qui restait une
  // 2e action manuelle souvent oubliée : le compteur ne reflétait pas la réalité.
  if (returnKm != null && returnKm > 0) {
    const { data: op } = await supabase
      .from('inter_agency_rentals')
      .select('direction, vehicle_id')
      .eq('id', id).single()
    if (op?.direction === 'out' && op.vehicle_id) {
      await supabase.from('vehicles').update({ current_km: returnKm }).eq('id', op.vehicle_id)
      revalidatePath('/vehicles')
      revalidatePath(`/vehicles/${op.vehicle_id}`)
    }
  }

  await bookOperationTransaction(supabase, id, user.id)

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
      .select('direction, vehicle_id, return_km')
      .eq('id', id).single()
    if (op?.direction === 'out' && op.vehicle_id) {
      const update: Record<string, unknown> = { status: 'disponible', availability_note: null }
      if (op.return_km != null) update.current_km = op.return_km
      await supabase.from('vehicles').update(update).eq('id', op.vehicle_id)
      // Recalcule le vrai statut : si le véhicule a une réservation en cours/à
      // venir, il repasse loué/réservé au lieu de rester figé sur disponible.
      await recomputeVehicleStatus(supabase, op.vehicle_id)
    }
    // Filet de sécurité : booke aussi les opérations déjà bloquées à "termine"
    // avant ce correctif (bookOperationTransaction est anti-doublon).
    await bookOperationTransaction(supabase, id, user.id)
  }

  revalidatePath(`/partnerships/${id}`)
  return { success: true }
}

// Découpe "Marque Modèle - immat" (external_vehicle_description, format libre) en
// composants exploitables pour créer le véhicule temporaire. Best-effort : tout
// ce qui n'est pas reconnu retombe dans brand pour ne jamais perdre l'info.
function parseExternalVehicle(desc: string | null): { brand: string; model: string; plate: string } {
  const raw = (desc ?? '').trim()
  if (!raw) return { brand: 'Véhicule partenaire', model: '', plate: '' }
  // Sépare une éventuelle immatriculation (après un tiret, une virgule ou « immat »)
  const m = raw.match(/^(.*?)[\s,·-]+(?:immat[:\s]*)?([A-Z0-9-]{5,})\s*$/i)
  if (m) {
    const words = m[1].trim().split(/\s+/)
    return { brand: words[0] ?? m[1].trim(), model: words.slice(1).join(' '), plate: m[2].toUpperCase() }
  }
  const words = raw.split(/\s+/)
  return { brand: words[0], model: words.slice(1).join(' '), plate: '' }
}

// ENTRANT — démarre la location sur le véhicule partenaire : crée un véhicule
// temporaire (is_external, visible dans la flotte puis archivé à la clôture) et
// une réservation, puis réutilise tout le flux EDL → contrat → signature →
// clôture. Redirige vers l'EDL de départ.
export async function startEntrantRental(operationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: op } = await supabase
    .from('inter_agency_rentals')
    .select('id, direction, client_id, client_reservation_id, partner_agency_id, external_vehicle_description, start_date, end_date_expected, departure_km, client_price, deposit_amount')
    .eq('id', operationId).single()
  if (!op) return { error: 'Opération introuvable' }
  if (op.direction !== 'in') return { error: 'Action réservée aux opérations entrantes' }
  if (!op.client_id) return { error: 'Associez d\'abord un client à cette opération' }
  if (op.client_reservation_id) redirect(`/reservations/${op.client_reservation_id}`)

  const ext = parseExternalVehicle(op.external_vehicle_description)
  const days = Math.max(1, calculateRentalDays(op.start_date, op.end_date_expected))
  const clientPrice = op.client_price ?? 0
  const dailyPrice = clientPrice > 0 ? Math.round((clientPrice / days) * 100) / 100 : 0

  // Véhicule temporaire représentant le véhicule du partenaire.
  const { data: vehicle, error: vErr } = await supabase.from('vehicles').insert({
    plate: ext.plate || `EXT-${operationId.slice(0, 6).toUpperCase()}`,
    brand: ext.brand, model: ext.model || '—',
    current_km: op.departure_km ?? 0,
    daily_price: dailyPrice,
    deposit_amount: op.deposit_amount ?? null,
    status: 'loue',
    is_active: true,
    is_external: true,
    partner_agency_id: op.partner_agency_id,
  }).select('id').single()
  if (vErr || !vehicle) return { error: vErr?.message ?? 'Création du véhicule temporaire impossible' }

  const { data: reservation, error: rErr } = await supabase.from('reservations').insert({
    reservation_number: generateReservationNumber(),
    vehicle_id: vehicle.id,
    client_id: op.client_id,
    start_datetime: op.start_date,
    end_datetime: op.end_date_expected,
    status: 'en_cours',
    daily_price: dailyPrice,
    total_price: clientPrice,
    deposit_amount: op.deposit_amount ?? null,
    internal_notes: `Opération inter-agences entrante — véhicule de l'agence partenaire.`,
    created_by: user.id,
  }).select('id').single()
  if (rErr || !reservation) return { error: rErr?.message ?? 'Création de la réservation impossible' }

  await supabase.from('inter_agency_rentals').update({ client_reservation_id: reservation.id }).eq('id', operationId)

  // Dédoublonnage comptable : la recette client est désormais portée par la
  // réservation (postRentalRevenue à la clôture), plus par l'opération.
  await supabase.from('financial_transactions').delete().eq('reference', `${operationId}:client`)

  revalidatePath(`/partnerships/${operationId}`)
  redirect(`/inspections/departure/${reservation.id}`)
}

// SORTANT — clôture de la convention : exige les 2 EDL signés (comme un contrat
// de location), passe le contrat ET l'opération à 'cloture'. updateOperationStatus
// remet le véhicule disponible et sécurise l'écriture comptable (anti-doublon).
export async function validateConvention(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, inter_agency_rental_id')
    .eq('id', contractId).single()
  if (!contract || !contract.inter_agency_rental_id) return { error: 'Convention introuvable' }
  if (contract.status === 'cloture') return { error: 'Convention déjà clôturée' }

  const { data: dep } = await supabase.from('inspections').select('id')
    .eq('contract_id', contractId).eq('type', 'depart').not('client_signature_svg', 'is', null).limit(1).maybeSingle()
  if (!dep) return { error: "L'état des lieux de départ signé est requis pour clôturer." }
  const { data: arr } = await supabase.from('inspections').select('id')
    .eq('contract_id', contractId).eq('type', 'arrivee').not('client_signature_svg', 'is', null).limit(1).maybeSingle()
  if (!arr) return { error: "L'état des lieux de retour signé est requis pour clôturer." }

  await supabase.from('contracts').update({ status: 'cloture' }).eq('id', contractId)
  await updateOperationStatus(contract.inter_agency_rental_id, 'cloture')

  revalidatePath(`/partnerships/${contract.inter_agency_rental_id}`)
  return { success: true }
}
