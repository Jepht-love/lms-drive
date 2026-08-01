'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTripToCalendar } from '@/lib/calendar/syncInternalTrip'
import { instantDepuisSaisie, jourHeureAgence } from '@/lib/format/heureAgence'
import { vehiculesIndisponibles, type RaisonIndisponibilite } from '@/lib/reservations/disponibilite'

export async function startTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Gérant/associé peuvent démarrer un déplacement au nom d'un collaborateur ;
  // un employé ne peut le démarrer que pour lui-même. Défaut = soi-même.
  const isManager = isManagerRole(await getRole(supabase, user.id))
  const assigneeRaw = formData.get('user_id') as string | null
  const assignee = isManager && assigneeRaw ? assigneeRaw : user.id

  const purpose = formData.get('purpose') as string
  const purposeNotes = ((formData.get('purpose_notes') as string) || '').trim()
  if (purpose === 'autre' && !purposeNotes) return { error: 'Précisez le motif du déplacement' }

  const payload = {
    vehicle_id: formData.get('vehicle_id') as string,
    user_id: assignee,
    start_datetime: new Date().toISOString(),
    purpose,
    purpose_notes: purposeNotes || null,
    status: 'en_cours' as const,
    km_start: Number(formData.get('km_start')),
    fuel_start: formData.get('fuel_start') ? Number(formData.get('fuel_start')) : null,
    notes: formData.get('notes') as string || null,
  }

  const { data, error } = await supabase.from('internal_trips').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await syncTripToCalendar(data.id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_started',
    entity_type: 'internal_trips',
    entity_id: data.id,
    metadata: { vehicle_id: payload.vehicle_id, purpose: payload.purpose, assigned_to: assignee },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

export async function endTrip(tripId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const kmEnd = Number(formData.get('km_end'))
  const tolls = formData.get('tolls_amount') ? Number(formData.get('tolls_amount')) : 0
  const expenses = formData.get('expenses_amount') ? Number(formData.get('expenses_amount')) : 0

  const { data: trip } = await supabase
    .from('internal_trips')
    .select('vehicle_id, km_start')
    .eq('id', tripId)
    .single()

  if (!trip) return { error: 'Déplacement introuvable' }
  if (trip.km_start != null && kmEnd < trip.km_start) return { error: 'Le KM retour doit être supérieur au KM départ' }

  const { error } = await supabase.from('internal_trips').update({
    status: 'termine',
    end_datetime: new Date().toISOString(),
    km_end: kmEnd,
    fuel_end: formData.get('fuel_end') ? Number(formData.get('fuel_end')) : null,
    tolls_amount: tolls || null,
    expenses_amount: expenses || null,
  }).eq('id', tripId)

  if (error) return { error: error.message }

  // Écritures cross-module réservées au gérant/associé par RLS (vehicles_write_managers,
  // ft_managers). Un employé peut clôturer son déplacement → on passe par le client admin
  // pour que le km ET la compta soient réellement écrits (sinon échec silencieux).
  const admin = createAdminClient()

  // Mise à jour du km véhicule
  await admin.from('vehicles').update({ current_km: kmEnd }).eq('id', trip.vehicle_id)

  // Transmission auto en comptabilité : péages + frais du déplacement interne
  // deviennent des charges (anti-doublon par `reference` si endTrip rejoué).
  const today = new Date().toISOString().slice(0, 10)
  const tollsRef = `trip-tolls:${tripId}`
  const expRef = `trip-exp:${tripId}`
  const { data: alreadyBooked } = await admin
    .from('financial_transactions').select('reference').in('reference', [tollsRef, expRef])
  const booked = new Set((alreadyBooked ?? []).map(r => r.reference))
  const charges = []
  if (tolls > 0 && !booked.has(tollsRef)) {
    charges.push({ date: today, type: 'depense', category: 'peages', amount: tolls,
      vehicle_id: trip.vehicle_id, reference: tollsRef,
      notes: 'Péages, déplacement interne', created_by: user.id })
  }
  if (expenses > 0 && !booked.has(expRef)) {
    charges.push({ date: today, type: 'depense', category: 'deplacement_interne', amount: expenses,
      vehicle_id: trip.vehicle_id, reference: expRef,
      notes: 'Frais, déplacement interne', created_by: user.id })
  }
  if (charges.length) {
    const { error: chargeErr } = await admin.from('financial_transactions').insert(charges)
    if (chargeErr) console.error('endTrip, écritures compta échouées:', chargeErr.message)
  }

  await syncTripToCalendar(tripId)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_ended',
    entity_type: 'internal_trips',
    entity_id: tripId,
    metadata: { km_end: kmEnd },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Planification
// ─────────────────────────────────────────────────────────────────────────────

async function getRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

const isManagerRole = (role: string | null) => role === 'gerant' || role === 'associe'

/**
 * Planifie un déplacement pour une date (future ou non), assigné à un
 * collaborateur OU laissé non assigné. Gérant/associé planifient pour n'importe
 * qui ; un employé ne planifie que pour lui-même. Aucun km n'est saisi ici — il
 * le sera au démarrage réel (startPlannedTrip).
 */
export async function planTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const isManager = isManagerRole(await getRole(supabase, user.id))

  const vehicleId = formData.get('vehicle_id') as string
  const purpose = formData.get('purpose') as string
  const startRaw = formData.get('start_datetime') as string
  const endRaw = formData.get('end_datetime') as string
  const purposeNotes = ((formData.get('purpose_notes') as string) || '').trim()
  if (!vehicleId || !purpose) return { error: 'Véhicule et motif requis' }
  if (!startRaw) return { error: 'Date de début requise' }
  // Fin obligatoire à la planification : c'est elle qui borne l'indisponibilité du
  // véhicule (calendrier, compteurs flotte, blocage de réservation). Sans fin, le
  // véhicule resterait bloqué jusqu'à une clôture manuelle.
  if (!endRaw) return { error: 'Date de fin requise' }
  // Motif « autre » : le mot ne dit rien, la précision est donc obligatoire.
  if (purpose === 'autre' && !purposeNotes) return { error: 'Précisez le motif du déplacement' }

  // Heures saisies dans le fuseau de l'agence, pas dans celui du serveur.
  const startIso = instantDepuisSaisie(startRaw)
  const endIso = instantDepuisSaisie(endRaw)
  if (endIso <= startIso) return { error: 'La fin doit être après le début' }

  // Employé : forcé sur lui-même. Manager : valeur du select ('' ou 'none' = non assigné).
  const assigneeRaw = (formData.get('user_id') as string | null) ?? ''
  const assignee = isManager
    ? (assigneeRaw && assigneeRaw !== 'none' ? assigneeRaw : null)
    : user.id

  const payload = {
    vehicle_id: vehicleId,
    user_id: assignee,
    start_datetime: startIso,
    end_datetime: endIso,
    purpose,
    purpose_notes: purposeNotes || null,
    status: 'planifie' as const,
    notes: (formData.get('notes') as string) || null,
  }

  const { data, error } = await supabase.from('internal_trips').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await syncTripToCalendar(data.id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_planned',
    entity_type: 'internal_trips',
    entity_id: data.id,
    metadata: { vehicle_id: vehicleId, purpose, assigned_to: assignee },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/** (Ré)assigner un déplacement planifié à un conducteur — gérant/associé uniquement. */
export async function assignTrip(tripId: string, userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!isManagerRole(await getRole(supabase, user.id))) return { error: 'Action réservée au gérant/associé' }

  const { error } = await supabase
    .from('internal_trips')
    .update({ user_id: userId })
    .eq('id', tripId)
    .eq('status', 'planifie')
  if (error) return { error: error.message }

  await syncTripToCalendar(tripId)
  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_assigned',
    entity_type: 'internal_trips', entity_id: tripId, metadata: { assigned_to: userId },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/**
 * Démarre un déplacement planifié : passe à "en cours", enregistre le km/carburant
 * réels et fixe l'heure de départ effective. Un non-assigné doit d'abord recevoir
 * un conducteur.
 */
export async function startPlannedTrip(tripId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: trip } = await supabase
    .from('internal_trips')
    .select('user_id, status')
    .eq('id', tripId)
    .single()
  if (!trip) return { error: 'Déplacement introuvable' }
  if (trip.status !== 'planifie') return { error: 'Ce déplacement n’est pas planifié' }
  if (!trip.user_id) return { error: 'Assignez un conducteur avant de démarrer' }

  const { error } = await supabase.from('internal_trips').update({
    status: 'en_cours',
    start_datetime: new Date().toISOString(),
    km_start: Number(formData.get('km_start')),
    fuel_start: formData.get('fuel_start') ? Number(formData.get('fuel_start')) : null,
  }).eq('id', tripId)
  if (error) return { error: error.message }

  await syncTripToCalendar(tripId)
  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_started',
    entity_type: 'internal_trips', entity_id: tripId, metadata: { from: 'planifie' },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

// Message affiché selon ce qui occupe déjà le véhicule. Les règles elles-mêmes
// ne sont pas réécrites ici : elles viennent de `vehiculesIndisponibles`, le même
// code que celui qui refuse une réservation ou une prolongation.
const CONFLIT_MESSAGES: Record<RaisonIndisponibilite, string> = {
  reservation: 'Ce véhicule est déjà réservé sur la période demandée, ajustez les dates.',
  garage:      'Ce véhicule a un rendez-vous garage sur la période demandée, ajustez les dates.',
  deplacement: 'Ce véhicule part sur un autre déplacement interne sur la période demandée, ajustez les dates.',
}

/**
 * Modifie un déplacement PLANIFIÉ ou EN COURS.
 *
 * Ce qui s'ouvre dépend de ce que le statut permet réellement :
 *  - planifié : début prévu, fin prévue, motif, précision, conducteur (managers).
 *    Aucun km : il ne sera relevé qu'au démarrage (startPlannedTrip) ;
 *  - en cours : heure de départ RÉELLE, retour prévu, motif, précision,
 *    conducteur (managers) et km de départ déjà relevé.
 *
 * Ce qui reste fermé dans tous les cas : le véhicule (il est physiquement dehors,
 * avec un relevé pris dessus — le changer libérerait une voiture qui roule et
 * collerait le relevé sur la mauvaise), le statut, et tout ce qui se saisit à la
 * clôture (km retour, carburant retour, péages, frais).
 */
export async function updateTrip(tripId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const isManager = isManagerRole(await getRole(supabase, user.id))

  const { data: trip } = await supabase
    .from('internal_trips')
    .select('vehicle_id, user_id, start_datetime, end_datetime, status, km_start')
    .eq('id', tripId)
    .single()
  if (!trip) return { error: 'Déplacement introuvable' }
  if (trip.status !== 'planifie' && trip.status !== 'en_cours') {
    return { error: 'Seul un déplacement planifié ou en cours peut être modifié' }
  }
  const enCours = trip.status === 'en_cours'

  const purpose = formData.get('purpose') as string
  const purposeNotes = ((formData.get('purpose_notes') as string) || '').trim()
  if (!purpose) return { error: 'Motif requis' }
  // Motif « autre » : le mot ne dit rien, la précision est donc obligatoire.
  if (purpose === 'autre' && !purposeNotes) return { error: 'Précisez le motif du déplacement' }

  // Départ et retour bornent l'indisponibilité du véhicule (calendrier, blocage
  // de réservation) — même règle qu'à la planification, les deux sont exigés.
  const startRaw = formData.get('start_datetime') as string
  const endRaw = formData.get('end_datetime') as string
  if (!startRaw) return { error: enCours ? 'Heure de départ requise' : 'Date de début requise' }
  if (!endRaw) return { error: 'Date de fin requise' }

  // Heures saisies dans le fuseau de l'agence, pas dans celui du serveur.
  const debutSaisi = instantDepuisSaisie(startRaw)
  const finSaisie = instantDepuisSaisie(endRaw)

  // Toutes les dates sont ramenées au même format (instant UTC) avant d'être
  // comparées : la base rend « +00:00 » et instantDepuisSaisie rend « Z », deux
  // écritures du même moment qui ne se comparent pas en texte.
  const ancienDebut = new Date(trip.start_datetime).toISOString()
  const ancienFin = trip.end_datetime ? new Date(trip.end_datetime).toISOString() : null
  // Les champs de saisie s'arrêtent à la minute : quand la minute n'a pas bougé,
  // on garde la valeur d'origine au lieu d'en raboter les secondes, sinon chaque
  // enregistrement décalerait légèrement le déplacement.
  const debutIso = debutSaisi.slice(0, 16) === ancienDebut.slice(0, 16) ? ancienDebut : debutSaisi
  const finIso = ancienFin && finSaisie.slice(0, 16) === ancienFin.slice(0, 16) ? ancienFin : finSaisie

  if (finIso <= debutIso) return { error: 'Le retour doit être après le départ' }
  // Un départ RÉEL dans le futur ferait repasser le véhicule « disponible » dans
  // les compteurs de flotte alors qu'il est dehors (ils ne comptent que les
  // déplacements déjà commencés).
  if (enCours && new Date(debutIso).getTime() > Date.now()) {
    return { error: 'L’heure de départ réelle ne peut pas être dans le futur' }
  }

  // Fenêtre AJOUTÉE par la modification, c'est-à-dire ce que ce déplacement ne
  // bloquait pas déjà. Contrôler tout le créneau interdirait de corriger un
  // déplacement qui chevauche déjà quelque chose (« Démarrer maintenant » ne
  // contrôle rien à la création).
  const fenetres: Array<[string, string]> = []
  if (!ancienFin) {
    // Sans retour renseigné (cas de « Démarrer maintenant »), ce déplacement
    // n'avait aucune période de fin : la fenêtre posée aujourd'hui est entièrement
    // nouvelle et se contrôle depuis la date de départ.
    fenetres.push([debutIso, finIso])
  } else {
    if (debutIso < ancienDebut) fenetres.push([debutIso, finIso < ancienDebut ? finIso : ancienDebut])
    if (finIso > ancienFin) fenetres.push([debutIso > ancienFin ? debutIso : ancienFin, finIso])
  }

  // Client admin : il ne sert QU'À LIRE, ici pour voir les conflits et plus bas
  // pour nommer les conducteurs. L'enregistrement reste sur `supabase`, donc
  // sous les règles d'accès de la personne connectée.
  //
  // Pourquoi la lecture ne peut pas rester sur `supabase` : hors gérant et
  // associé, un salarié ne voit que SES déplacements (RLS `trips_own`) et que
  // les rendez-vous garage qui lui sont affectés (RLS `calendar_events_select`).
  // Le contrôle ne verrait alors que les réservations, et laisserait passer
  // sans un mot un chevauchement avec le garage ou avec la sortie d'un collègue.
  // Même détour que la synchronisation du calendrier (lib/calendar/).
  const admin = createAdminClient()

  for (const [debut, fin] of fenetres) {
    const indispo = await vehiculesIndisponibles(admin, debut, fin, {
      vehicleIds: [trip.vehicle_id],
      ignorerDeplacementId: tripId,
    })
    const conflit = indispo.get(trip.vehicle_id)
    if (conflit) return { error: CONFLIT_MESSAGES[conflit.raison] }
  }

  // Le conducteur désigne la personne à qui le logiciel impute une amende tombée
  // à cette date (lib/utils/findDriverAtDate.ts) : seuls gérant et associé le
  // changent, comme pour l'assignation d'un déplacement planifié.
  let assignee = trip.user_id
  if (isManager) {
    const assigneeRaw = ((formData.get('user_id') as string | null) ?? '').trim()
    assignee = assigneeRaw && assigneeRaw !== 'none' ? assigneeRaw : null
  }
  // Un déplacement en cours nomme forcément quelqu'un : le véhicule roule.
  if (enCours && !assignee) return { error: 'Assignez un conducteur à ce déplacement en cours' }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('plate, current_km')
    .eq('id', trip.vehicle_id)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    start_datetime: debutIso,
    end_datetime: finIso,
    user_id: assignee,
    purpose,
    purpose_notes: purposeNotes || null,
  }

  // KM de départ : seulement sur un déplacement en cours (sur un planifié, il
  // n'a pas encore été relevé). Champ laissé vide = valeur inchangée.
  let kmStart: number | null = null
  if (enCours) {
    const kmRaw = ((formData.get('km_start') as string | null) ?? '').trim()
    if (kmRaw) {
      kmStart = Number(kmRaw)
      if (!Number.isFinite(kmStart) || kmStart < 0) return { error: 'KM de départ invalide' }
      // Le compteur d'un véhicule ne recule jamais : un départ sous le compteur
      // ferait reculer la flotte à la clôture, où le KM retour est recopié sur
      // la fiche du véhicule (endTrip). Le compteur ayant pu monter entre-temps
      // (un entretien enregistré depuis), le message dit la sortie : laisser la
      // case vide enregistre le reste du formulaire.
      if (vehicle?.current_km != null && kmStart < vehicle.current_km) {
        return { error: `Le compteur de ce véhicule affiche ${vehicle.current_km.toLocaleString('fr-FR')} km : le KM de départ ne peut pas être inférieur. Laissez la case vide pour enregistrer le reste sans y toucher.` }
      }
      payload.km_start = kmStart
    }
  }

  // Filtre sur le statut : une clôture ou une annulation arrivée entre la lecture
  // et l'écriture ne doit pas se faire réécrire par le formulaire. `select` pour
  // ne pas annoncer « modifié » quand aucune ligne n'a bougé.
  const { data: updated, error } = await supabase
    .from('internal_trips')
    .update(payload)
    .eq('id', tripId)
    .eq('status', trip.status)
    .select('id')
  if (error) return { error: error.message }
  if (!updated || updated.length === 0) {
    return { error: 'Ce déplacement a changé entre-temps, rouvrez-le avant de le modifier' }
  }

  // Le calendrier porte le motif dans le titre du bloc, le conducteur dans son
  // affectation et les dates dans sa position : sans cette resynchronisation,
  // l'agenda garderait les anciennes valeurs.
  await syncTripToCalendar(tripId)

  // Journal d'activité : phrase lisible, avec le changement de conducteur nommé
  // (ancien → nouveau). Les noms sont lus par le client admin — la table des
  // profils n'est lisible que par le gérant (RLS), sans quoi la ligne du journal
  // afficherait des identifiants à la place des personnes.
  const idsConducteurs = [trip.user_id, assignee].filter(Boolean) as string[]
  const { data: profils } = idsConducteurs.length
    ? await admin.from('profiles').select('id, full_name').in('id', idsConducteurs)
    : { data: [] as { id: string; full_name: string }[] }
  const nomConducteur = (id: string | null) =>
    id ? (profils?.find(p => p.id === id)?.full_name ?? 'conducteur inconnu') : 'non assigné'

  const changements: string[] = []
  if (debutIso !== ancienDebut) changements.push(`départ ${jourHeureAgence(debutIso)}`)
  if (finIso !== ancienFin) changements.push(`retour ${jourHeureAgence(finIso)}`)
  if (assignee !== trip.user_id) {
    changements.push(`conducteur : ${nomConducteur(trip.user_id)} → ${nomConducteur(assignee)}`)
  }
  if (kmStart != null && kmStart !== trip.km_start) {
    changements.push(`KM départ ${trip.km_start?.toLocaleString('fr-FR') ?? '—'} → ${kmStart.toLocaleString('fr-FR')}`)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_updated',
    entity_type: 'internal_trips', entity_id: tripId,
    metadata: {
      summary: `Déplacement interne modifié${vehicle?.plate ? ` · ${vehicle.plate}` : ''}${changements.length ? ` · ${changements.join(' · ')}` : ''}`,
      purpose, start_datetime: debutIso, end_datetime: finIso,
      previous_user_id: trip.user_id, user_id: assignee,
    },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/** Annule un déplacement encore planifié (propriétaire ou manager via RLS). */
export async function cancelTrip(tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('internal_trips')
    .update({ status: 'annule' })
    .eq('id', tripId)
    .eq('status', 'planifie')
  if (error) return { error: error.message }

  await syncTripToCalendar(tripId)
  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_cancelled',
    entity_type: 'internal_trips', entity_id: tripId, metadata: {},
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/**
 * Supprime définitivement un déplacement (propriétaire ou manager via RLS) et
 * nettoie ses artefacts liés : l'événement calendrier (source_key trip-<id>) et
 * les charges compta générées à la clôture (péages / frais). Le km du véhicule
 * n'est PAS reculé — supprimer la trace ne « dé-roule » pas le véhicule.
 */
export async function deleteTrip(tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('internal_trips').delete().eq('id', tripId)
  if (error) return { error: error.message }

  // Tables réservées aux managers par RLS → client admin pour le nettoyage.
  const admin = createAdminClient()
  await admin.from('calendar_events').delete().eq('source_key', `trip-${tripId}`)
  await admin.from('financial_transactions').delete().in('reference', [`trip-tolls:${tripId}`, `trip-exp:${tripId}`])

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_deleted',
    entity_type: 'internal_trips', entity_id: tripId, metadata: {},
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}
