'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_INTERVALS } from '@/lib/maintenance-health'
import {
  maintenanceType, URGENCIES, WORK_STATUSES, WORK_STATUSES_CLOS,
  correctionSoumiseAControle, type WorkStatusKey, type MaintenancePart,
} from '@/lib/maintenance'
import { instantDepuisSaisie } from '@/lib/format/heureAgence'
import { maintenanceTypeForDamageType, expenseCategoryForDamageType } from '@/lib/vehicles/damage-catalog'
import { assertPeriodOpen } from '@/lib/accounting/period-lock'
import type { MaintenanceFlag } from '@/types/database'

// Types qui correspondent à un passage en atelier (immobilisation + RDV
// visible au calendrier/tâches du jour) — carburant et lavage sont trop
// courts pour ça et restent gérés séparément ci-dessous.
const GARAGE_TYPES = new Set(['revision', 'vidange', 'pneus', 'freins', 'reparation', 'carrosserie', 'controle_technique', 'autre'])

/** Les valeurs acceptées, pour ne jamais écrire en base ce que la contrainte refuse. */
const URGENCY_KEYS: string[] = URGENCIES.map(u => u.key)
const WORK_STATUS_KEYS: string[] = WORK_STATUSES.map(s => s.key)

/** Rôles autorisés à clore ou annuler : la clôture engage un montant (Jeff, 02/08/2026). */
const ROLES_QUI_CLOTURENT = ['gerant', 'associe']

/**
 * Un véhicule du rendez-vous, tel que le formulaire l'envoie.
 *
 * Chaque véhicule porte SON kilométrage, SON montant et SES dégâts : un passage
 * au garage à trois voitures produit trois interventions distinctes, chacune
 * avec son argent (Jeff, remarque 38.C). Un montant global aurait obligé à le
 * répartir à la main, donc à inventer des chiffres.
 */
interface VehiculeDuRdv {
  id: string
  km?: string | null
  amount?: string | null
  damages?: { flagId: string; quote: number | null }[]
}

/** L'heure par défaut d'un passage au garage, si le formulaire n'en donne pas. */
const HEURE_GARAGE_DEFAUT = '08:00'

export async function createMaintenanceRecord(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // ─── Les véhicules du rendez-vous ────────────────────────────────────────────
  // Depuis le 03/08/2026 le formulaire envoie une liste. L'ancienne forme (un
  // `vehicle_id` seul) reste acceptée : d'autres écrans l'appellent encore.
  let vehicules: VehiculeDuRdv[] = []
  try {
    const brut = formData.get('vehicles') as string | null
    if (brut) vehicules = JSON.parse(brut)
  } catch {
    return { error: 'Véhicules illisibles' }
  }

  if (vehicules.length === 0) {
    const vehicleId = formData.get('vehicle_id') as string
    if (!vehicleId) return { error: 'Véhicule manquant' }
    let damages: { flagId: string; quote: number | null }[] = []
    try {
      const brut = formData.get('damage_flags') as string | null
      if (brut) damages = JSON.parse(brut)
    } catch {
      return { error: 'Dégâts illisibles' }
    }
    vehicules = [{
      id: vehicleId,
      km: formData.get('km_at_intervention') as string | null,
      amount: formData.get('amount') as string | null,
      damages,
    }]
  }

  const vus = new Set<string>()
  vehicules = vehicules.filter(v => v?.id && !vus.has(v.id) && vus.add(v.id))
  if (vehicules.length === 0) return { error: 'Véhicule manquant' }

  // ─── Ce qui est commun à tout le rendez-vous ─────────────────────────────────
  const dateRdv = (formData.get('date') as string) || new Date().toISOString().slice(0, 10)
  const heureRdv = ((formData.get('time') as string) || '').trim() || HEURE_GARAGE_DEFAUT
  const commun = {
    date:        dateRdv,
    provider:    (formData.get('provider') as string)?.trim() || null,
    notes:       (formData.get('notes') as string)?.trim() || null,
    urgency:     URGENCY_KEYS.includes(formData.get('urgency') as string)
                   ? (formData.get('urgency') as string) : 'normale',
    due_date:    (formData.get('due_date') as string) || null,
    assigned_to: (formData.get('assigned_to') as string) || null,
    // Désigner quelqu'un ne veut pas dire qu'il a pris l'intervention : il devra
    // s'en saisir lui-même, ce qui fera passer le statut à « prise en charge ».
    work_status: 'a_traiter' as const,
  }
  const typeSaisi = (formData.get('type') as string) || 'autre'
  const descriptionSaisie = (formData.get('description') as string)?.trim() || null
  const statutDevis = (formData.get('quote_status') as string) === 'valide' ? 'valide' : 'brouillon'

  const creees: { id: string; vehicleId: string; type: string; amount: number }[] = []

  for (const v of vehicules) {
    // ─── Dégâts rattachés à cette intervention ─────────────────────────────────
    // Ajouté le 01/08/2026. Une intervention peut réparer plusieurs dégâts, chacun
    // avec SON devis : le garage évalue séparément une portière et une vitre, et
    // c'est cette évaluation que la comptabilité doit pouvoir lire ensuite.
    // Aucun montant n'est écrit en comptabilité ici : un devis n'est pas une
    // dépense, elle n'existera qu'au règlement du garage.
    const choisis = v.damages ?? []

    const flagsVehicule = choisis.length > 0
      ? ((await supabase.from('vehicles').select('maintenance_flags').eq('id', v.id).single())
          .data?.maintenance_flags as MaintenanceFlag[] | null) ?? []
      : []
    const reparés = flagsVehicule.filter(f => choisis.some(c => c.flagId === f.id))

    // Un dégât déjà pris en charge ou déjà réparé ne doit jamais repartir au garage :
    // ce serait la même réparation payée deux fois.
    if (reparés.some(f => f.repaired_at || f.intervention_id)) {
      return { error: 'Un des dégâts est déjà réparé ou déjà rattaché à une intervention' }
    }
    if (choisis.length > 0 && reparés.length !== choisis.length) {
      return { error: 'Un des dégâts est introuvable sur ce véhicule' }
    }

    const enReparation = reparés.length > 0
    const devisTotal = choisis.reduce((s, c) => s + (c.quote ?? 0), 0)

    const kmRaw     = (v.km ?? '').trim()
    const amountRaw = (v.amount ?? '').trim()
    const km     = kmRaw ? parseInt(kmRaw, 10) : null
    const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0

    // Toutes les réparations d'une même location se rattachent à elle. Dès que les
    // dégâts viennent de locations différentes, on ne rattache rien : la ventilation
    // se fait alors dégât par dégât, pas au niveau de l'intervention.
    const locations = [...new Set(reparés.map(f => f.reservation_id).filter(Boolean))]

    const payload = {
      vehicle_id: v.id,
      // En réparation, le type se déduit du premier dégât : l'agent n'a pas à
      // rechoisir ce que le catalogue sait déjà.
      type: enReparation ? maintenanceTypeForDamageType(reparés[0].damage_type) : typeSaisi,
      description: enReparation ? reparés.map(f => f.label).join(' · ') : descriptionSaisie,
      km_at_intervention: Number.isFinite(km as number) ? km : null,
      // Le montant réel reste à 0 tant que le garage n'a pas facturé.
      amount: enReparation ? 0 : (Number.isFinite(amount) ? amount : 0),
      // ─── Le suivi du travail (migration 074, 02/08/2026) ───────────────────
      // Qui s'en occupe, pour quand, et à quel point ça presse. L'urgence décide
      // de l'entrée dans les alertes ; la date limite est facultative, mais une
      // fois dépassée elle fait monter l'intervention en urgent.
      ...commun,
      ...(enReparation ? {
        quote_amount: devisTotal > 0 ? devisTotal : null,
        quote_status: statutDevis,
        reservation_id: locations.length === 1 ? locations[0] : null,
      } : {}),
    }

    const { data, error } = await supabase
      .from('maintenance_records')
      .insert(payload)
      .select('id')
      .single()

    if (error) return { error: error.message }
    creees.push({ id: data.id, vehicleId: v.id, type: payload.type, amount: payload.amount })

    // Les dégâts pris en charge portent désormais l'intervention et leur devis.
    if (enReparation) {
      const majFlags = flagsVehicule.map(f => {
        const c = choisis.find(x => x.flagId === f.id)
        return c ? { ...f, intervention_id: data.id, quote_amount: c.quote ?? null } : f
      })
      const { error: flagErr } = await supabase
        .from('vehicles')
        .update({ maintenance_flags: majFlags })
        .eq('id', v.id)
      // Une intervention sans ses dégâts serait un fantôme : on annule plutôt que
      // de laisser les deux moitiés se désynchroniser.
      if (flagErr) {
        await supabase.from('maintenance_records').delete().eq('id', data.id)
        return { error: flagErr.message }
      }
    }

    // Avance le km courant du véhicule si l'intervention est plus récente
    if (payload.km_at_intervention != null) {
      await supabase
        .from('vehicles')
        .update({ current_km: payload.km_at_intervention })
        .eq('id', v.id)
        .lt('current_km', payload.km_at_intervention)
    }

    // Cycle d'entretien : un entretien (révision/vidange) planifie automatiquement
    // le prochain à +15 000 km (et +12 mois) → pilote les alertes 500/200 km.
    if ((payload.type === 'revision' || payload.type === 'vidange') && payload.km_at_intervention != null) {
      const nextDate = new Date(dateRdv)
      nextDate.setMonth(nextDate.getMonth() + SERVICE_INTERVALS.entretien.months)
      await supabase
        .from('vehicles')
        .update({
          next_service_km: payload.km_at_intervention + SERVICE_INTERVALS.entretien.km,
          next_service_date: nextDate.toISOString().slice(0, 10),
        })
        .eq('id', v.id)
    }

    // Met à jour la date de dernier lavage
    if (payload.type === 'lavage') {
      await supabase.from('vehicles').update({ last_wash_date: dateRdv }).eq('id', v.id)
    }
  }

  // ─── Le passage au garage, une seule ligne au calendrier ─────────────────────
  // Le créneau n'appartient plus à une intervention : c'est le passage lui-même,
  // partagé par toutes les voitures qui y vont et par toutes les réparations
  // qu'on y fait faire (remarque 43 de Jeff). Deux réparations de types
  // différents sur la même voiture le même jour donnaient deux lignes.
  const auGarage = creees.filter(c => GARAGE_TYPES.has(c.type))
  if (auGarage.length > 0) {
    const admin = createAdminClient()
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, brand, model, status')
      .in('id', auGarage.map(c => c.vehicleId))
    const parId = new Map((vehicles ?? []).map(v => [v.id, v]))

    // L'heure saisie est celle de l'agence, pas celle du fuseau du serveur.
    let startAt = new Date(instantDepuisSaisie(`${dateRdv}T${heureRdv}:00`))
    const today = new Date().toISOString().slice(0, 10)
    const isUpcoming = dateRdv >= today
    // Un rendez-vous noté pour AUJOURD'HUI sans qu'on touche à l'heure se posait
    // quand même à 8 h du matin : il naissait dépassé, quittait aussitôt
    // « Tâches du jour » et basculait en alerte sans que rien ne l'explique
    // (Jeff, remarque 5 du 03/08/2026). On le cale alors sur la prochaine
    // demi-heure ronde. Une heure choisie exprès, elle, est respectée telle
    // quelle : rattraper un rendez-vous passé du jour est un usage légitime.
    if (isUpcoming && heureRdv === HEURE_GARAGE_DEFAUT && startAt.getTime() < Date.now()) {
      const finDuJour = new Date(instantDepuisSaisie(`${dateRdv}T23:30:00`))
      const dans30min = new Date(Date.now() + 30 * 60_000)
      dans30min.setMinutes(dans30min.getMinutes() >= 30 ? 30 : 0, 0, 0)
      // Jamais au-delà du jour choisi : un rendez-vous saisi à 23 h 50 se
      // poserait sinon le lendemain, hors de la journée qu'on vient d'indiquer.
      startAt = dans30min > finDuJour ? finDuJour : dans30min
    }
    const endAt = new Date(startAt.getTime() + 60 * 60_000)

    // Un créneau déjà posé à cette date et à cette heure est le même passage :
    // on le complète au lieu d'en créer un second.
    const { data: existant } = await admin
      .from('calendar_events')
      .select('id, vehicle_ids, notes')
      .eq('event_type', 'rdv_garage')
      .eq('start_at', startAt.toISOString())
      .maybeSingle()

    const dejaOccupe = Boolean(existant)
    const idsVehicules = [...new Set([
      ...((existant?.vehicle_ids as string[] | null) ?? []),
      ...auGarage.map(c => c.vehicleId),
    ])]
    // Les notes s'ajoutent les unes aux autres : le gérant doit lire d'un coup
    // d'œil tout ce qui part au garage sur ce créneau, pas seulement la dernière
    // intervention saisie.
    const notes = [existant?.notes, descriptionSaisie]
      .map(n => (n ?? '').trim()).filter(Boolean)
      .filter((n, i, tous) => tous.indexOf(n) === i)
      .join(' · ') || null
    const titre = titreRdvGarage(idsVehicules, parId, auGarage, dejaOccupe)

    let eventId = existant?.id as string | undefined
    if (eventId) {
      await admin.from('calendar_events')
        .update({ title: titre, vehicle_ids: idsVehicules, notes })
        .eq('id', eventId)
    } else {
      const { data: cree } = await admin.from('calendar_events').insert({
        title: titre,
        event_type: 'rdv_garage',
        status: isUpcoming ? 'a_faire' : 'termine',
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        vehicle_ids: idsVehicules,
        notes,
      }).select('id').single()
      eventId = cree?.id
    }

    // Le lien retour : c'est lui qui permet de ne retirer qu'un véhicule quand on
    // supprime une intervention, au lieu d'effacer le rendez-vous des autres.
    if (eventId) {
      await admin.from('maintenance_records')
        .update({ calendar_event_id: eventId })
        .in('id', auGarage.map(c => c.id))
    }

    if (isUpcoming) {
      // Tous les véhicules du passage au garage s'immobilisent, y compris un
      // véhicule en location : déclarer une intervention pendant une location
      // signifie qu'un problème l'a interrompue (accident, fourrière), la voiture
      // doit donc apparaître immobilisée (Jeff, remarque 13 du 05/08/2026). Avant,
      // le filtre `status === 'disponible'` laissait libre tout véhicule qui n'était
      // pas disponible : le 2e véhicule d'un même rendez-vous restait « disponible ».
      // On saute seulement ceux déjà immobilisés, pour ne pas réécrire pour rien.
      const aImmobiliser = auGarage
        .map(c => parId.get(c.vehicleId))
        .filter(v => v && v.status !== 'maintenance')
        .map(v => v!.id)
      if (aImmobiliser.length > 0) {
        await admin.from('vehicles').update({ status: 'maintenance' }).in('id', aImmobiliser)
      }
    }
  }

  // Justificatif optionnel (facture garage, devis…) → rangé automatiquement dans
  // Documents › Véhicule. Choix gérant : le document n'apparaît QUE si un fichier
  // est réellement joint (la dépense, elle, va en compta au règlement).
  // Une seule pièce pour tout le rendez-vous : elle se range sur le premier
  // véhicule, celui depuis lequel le rendez-vous a été saisi.
  const principal = creees[0]
  const justificatif = formData.get('justificatif') as File | null
  if (principal && justificatif && justificatif.size > 0) {
    const ext = justificatif.name.split('.').pop() || 'pdf'
    const path = `vehicule/facture_entretien/${Date.now()}-${principal.vehicleId}.${ext}`
    const ab = await justificatif.arrayBuffer()
    const { error: upErr } = await supabase.storage.from('documents').upload(path, ab, { contentType: justificatif.type })
    if (!upErr) {
      const { data: veh } = await supabase.from('vehicles').select('brand, model, plate').eq('id', principal.vehicleId).single()
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.plate ? ` (${veh.plate})` : ''}` : ''
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'facture_entretien',
        name: `${maintenanceType(principal.type).label} · ${vehLabel} · ${dateRdv}`,
        file_url: path,
        file_type: justificatif.type,
        file_size: justificatif.size,
        entity_id: principal.vehicleId,
        entity_type: 'vehicle',
        is_auto_generated: false,
        created_by: user.id,
      })
    }
  }

  await supabase.from('audit_logs').insert(creees.map(c => ({
    user_id: user.id,
    action: 'maintenance_created',
    entity_type: 'maintenance_records',
    entity_id: c.id,
    metadata: { vehicle_id: c.vehicleId, type: c.type, amount: c.amount },
  })))

  for (const c of creees) revalidatePath(`/maintenance/${c.vehicleId}`)
  revalidatePath('/maintenance')
  revalidatePath('/')
  revalidatePath('/calendrier')
  revalidatePath('/vehicles')
  return { success: true }
}

/**
 * Le titre du créneau au calendrier.
 *
 * Un seul véhicule et une seule intervention : le titre d'avant, mot pour mot
 * (« Révision · Renault Captur »), pour ne rien changer à ce que le gérant lit
 * déjà. Dès qu'il y a plusieurs interventions ou plusieurs voitures, le créneau
 * n'appartient plus à une intervention : il devient le passage au garage.
 */
function titreRdvGarage(
  idsVehicules: string[],
  parId: Map<string, { brand: string; model: string }>,
  interventions: { vehicleId: string; type: string }[],
  dejaOccupe: boolean,
): string {
  if (idsVehicules.length > 1) return `Garage · ${idsVehicules.length} véhicules`
  const v = parId.get(idsVehicules[0])
  const nom = v ? `${v.brand} ${v.model}` : 'Véhicule'
  if (interventions.length === 1 && !dejaOccupe) {
    return `${maintenanceType(interventions[0].type).label} · ${nom}`
  }
  return `Garage · ${nom}`
}

/**
 * « Je prends en charge » : celui qui clique inscrit son nom sur l'intervention
 * et la fait passer de « à traiter » à « prise en charge ».
 *
 * Attend l'identifiant de l'intervention. Produit : `taken_by`, `taken_at` et le
 * statut de suivi. Ne touche à rien d'autre, et surtout pas à l'argent.
 *
 * Pourquoi une prise volontaire plutôt qu'une assignation par un gérant (Jeff,
 * 02/08/2026) : sur le terrain, celui qui voit le problème est celui qui s'en
 * occupe. Un gérant peut quand même désigner quelqu'un à la création
 * (`assigned_to`), ce qui n'empêche personne de se saisir de l'intervention.
 *
 * Ce qu'il ne faut pas casser : une intervention déjà prise ne se reprend pas en
 * silence, sinon deux personnes se croiraient chacune responsable.
 */
export async function prendreEnChargeIntervention(recordId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, work_status, taken_by, taken_by_profile:profiles!maintenance_records_taken_by_fkey(full_name)')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }
  if (rec.taken_by && rec.taken_by !== user.id) {
    const qui = Array.isArray((rec as any).taken_by_profile)
      ? (rec as any).taken_by_profile[0] : (rec as any).taken_by_profile
    return { error: `${qui?.full_name ?? 'Quelqu\'un'} s'en occupe déjà.` }
  }
  if (WORK_STATUSES_CLOS.includes(rec.work_status as WorkStatusKey)) {
    return { error: 'Cette intervention est close.' }
  }

  const { error } = await supabase
    .from('maintenance_records')
    .update({
      taken_by: user.id,
      taken_at: new Date().toISOString(),
      // On n'écrase pas un statut déjà plus avancé : quelqu'un peut se saisir
      // d'une intervention dont le rendez-vous est déjà pris.
      ...(rec.work_status === 'a_traiter' ? { work_status: 'prise_en_charge' } : {}),
    })
    .eq('id', recordId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'intervention_prise_en_charge',
    entity_type: 'maintenance_records',
    entity_id: recordId,
    metadata: {},
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/suivi')
  revalidatePath('/')
  return { success: true }
}

/**
 * Fait avancer le suivi du travail d'une intervention : à traiter, prise en
 * charge, rendez-vous programmé, en cours, terminée, annulée.
 *
 * Attend l'identifiant et le statut visé. Produit le nouveau statut et, pour une
 * clôture, l'heure de fermeture. **Ne touche jamais à l'argent** : une
 * intervention terminée n'est pas une intervention payée, le règlement reste un
 * geste à part (settleIntervention / markMaintenancePaid).
 *
 * Qui a le droit : tout le monde fait avancer une intervention, mais **seuls un
 * gérant, un associé ou un administrateur la terminent ou l'annulent** — la
 * clôture engage un montant (règle de Jeff du 02/08/2026).
 */
export async function changerStatutIntervention(recordId: string, statut: WorkStatusKey) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!WORK_STATUS_KEYS.includes(statut)) return { error: 'Statut inconnu' }

  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user.id).single()
  const peutClore = profile?.is_admin || ROLES_QUI_CLOTURENT.includes(profile?.role ?? '')
  if (WORK_STATUSES_CLOS.includes(statut) && !peutClore) {
    return { error: 'Seuls un gérant ou un associé peuvent terminer ou annuler une intervention.' }
  }

  const { data: rec } = await supabase
    .from('maintenance_records').select('id, vehicle_id').eq('id', recordId).single()
  if (!rec) return { error: 'Intervention introuvable' }

  const clos = WORK_STATUSES_CLOS.includes(statut)
  const { error } = await supabase
    .from('maintenance_records')
    .update({ work_status: statut, closed_at: clos ? new Date().toISOString() : null })
    .eq('id', recordId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'intervention_statut',
    entity_type: 'maintenance_records',
    entity_id: recordId,
    metadata: { statut },
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/suivi')
  revalidatePath('/')
  return { success: true }
}

/**
 * Clôture une intervention : le COMPTE RENDU de ce qui a réellement été fait.
 *
 * Attend l'identifiant et le formulaire de clôture. Produit l'intervention
 * complétée, ses pièces, son justificatif rangé dans Documents, le kilométrage
 * du véhicule avancé, et le statut de travail passé à « terminée ».
 *
 * **Pourquoi un écran à part** (demande du gérant, 02/08/2026) : planifier une
 * intervention et rendre compte de ce qui a été fait sont deux moments
 * différents, avec deux séries d'informations différentes. Les mélanger dans un
 * seul formulaire obligeait à tout ressaisir à l'avance, et laissait clore une
 * intervention sans rien renseigner du tout.
 *
 * Les onze informations qu'il exige : véhicule, nature exacte, pièces remplacées,
 * garage, date, prix des pièces, prix de la main d'œuvre, coût total,
 * kilométrage, observations, facture. Le véhicule est déjà connu, le prix des
 * pièces se calcule ; tout le reste se saisit ici.
 *
 * Qui a le droit : **gérant, associé ou administrateur**, comme toute clôture —
 * elle engage un montant.
 *
 * Ce qu'il ne faut pas casser : le coût total d'une réparation de dégâts vient
 * du règlement dégât par dégât (`settleIntervention`). Cette action ne l'écrase
 * jamais dans ce cas, elle ne complète que le reste.
 */
export async function cloturerIntervention(recordId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user.id).single()
  const peut = profile?.is_admin || ROLES_QUI_CLOTURENT.includes(profile?.role ?? '')
  if (!peut) return { error: 'Seuls un gérant ou un associé peuvent clôturer une intervention.' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, type, amount, work_status')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }

  let pieces: MaintenancePart[] = []
  try {
    const brut = formData.get('parts') as string | null
    if (brut) pieces = (JSON.parse(brut) as MaintenancePart[])
      .filter(p => (p.label ?? '').trim().length > 0)
      .map(p => ({
        label: String(p.label).trim(),
        quantity: Number(p.quantity) || 1,
        unit_price: Number(p.unit_price) || 0,
      }))
  } catch {
    return { error: 'Pièces illisibles' }
  }

  const nature   = (formData.get('description') as string)?.trim()
  const garage   = (formData.get('provider') as string)?.trim()
  const date     = (formData.get('date') as string)?.trim()
  const kmRaw    = (formData.get('km_at_intervention') as string)?.trim()
  const laborRaw = (formData.get('labor_cost') as string)?.trim()
  const totalRaw = (formData.get('amount') as string)?.trim()

  // Le gérant demande que ces informations soient renseignées, pas qu'elles
  // soient facultatives : sans elles, le compte rendu ne sert à rien.
  if (!nature)  return { error: "Indiquez la nature exacte de l'intervention." }
  if (!garage)  return { error: 'Indiquez le garage ou le prestataire.' }
  if (!date)    return { error: "Indiquez la date de l'intervention." }
  if (!kmRaw)   return { error: 'Indiquez le kilométrage du véhicule.' }

  const km    = parseInt(kmRaw, 10)
  const labor = laborRaw ? parseFloat(laborRaw.replace(',', '.')) : 0
  const total = totalRaw ? parseFloat(totalRaw.replace(',', '.')) : 0
  // Une réparation de dégâts garde le total venu du règlement.
  const degatsRattaches = ((await supabase
    .from('vehicles').select('maintenance_flags').eq('id', rec.vehicle_id).single())
    .data?.maintenance_flags as MaintenanceFlag[] | null ?? [])
    .some(f => f.intervention_id === recordId)

  const { error } = await supabase
    .from('maintenance_records')
    .update({
      description: nature,
      provider: garage,
      date,
      km_at_intervention: Number.isFinite(km) ? km : null,
      labor_cost: Number.isFinite(labor) ? labor : null,
      notes: (formData.get('notes') as string)?.trim() || null,
      work_status: 'terminee',
      closed_at: new Date().toISOString(),
      ...(degatsRattaches ? {} : { amount: Number.isFinite(total) ? total : 0 }),
    })
    .eq('id', recordId)
  if (error) return { error: error.message }

  await supabase.from('maintenance_parts').delete().eq('maintenance_id', recordId)
  if (pieces.length > 0) {
    const { error: pErr } = await supabase
      .from('maintenance_parts')
      .insert(pieces.map(p => ({ ...p, maintenance_id: recordId })))
    if (pErr) return { error: pErr.message }
  }

  // Le compteur du véhicule avance si l'intervention l'a vu plus loin.
  if (Number.isFinite(km)) {
    await supabase
      .from('vehicles').update({ current_km: km }).eq('id', rec.vehicle_id).lt('current_km', km)
  }

  // Facture ou justificatif, rangé dans Documents › Véhicule comme à la création.
  const justificatif = formData.get('justificatif') as File | null
  if (justificatif && justificatif.size > 0) {
    const ext = justificatif.name.split('.').pop() || 'pdf'
    const path = `vehicule/facture_entretien/${Date.now()}-${rec.vehicle_id}.${ext}`
    const ab = await justificatif.arrayBuffer()
    const { error: upErr } = await supabase.storage
      .from('documents').upload(path, ab, { contentType: justificatif.type })
    if (!upErr) {
      const { data: veh } = await supabase
        .from('vehicles').select('brand, model, plate').eq('id', rec.vehicle_id).single()
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.plate ? ` (${veh.plate})` : ''}` : ''
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'facture_entretien',
        name: `${maintenanceType(rec.type).label} · ${vehLabel} · ${date}`,
        file_url: path,
        file_type: justificatif.type,
        file_size: justificatif.size,
        entity_id: rec.vehicle_id,
        entity_type: 'vehicle',
        is_auto_generated: false,
        created_by: user.id,
      })
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'intervention_cloturee',
    entity_type: 'maintenance_records',
    entity_id: recordId,
    metadata: { total, labor, pieces: pieces.length },
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/suivi')
  revalidatePath('/documents')
  revalidatePath('/')
  return { success: true }
}

/**
 * Modifie une intervention déjà enregistrée.
 *
 * Attend l'identifiant et le formulaire complet, y compris les pièces
 * remplacées et le prix de la main d'œuvre. Produit l'intervention à jour, ses
 * pièces réécrites, et, quand le montant change, soit la correction de
 * l'écriture comptable, soit une demande de validation.
 *
 * Trois règles, toutes voulues par Jeff :
 *
 * 1. **Toucher à un montant exige un motif écrit.** Le reste se modifie
 *    librement.
 * 2. **Une intervention déjà réglée CORRIGE son écriture comptable**, elle n'en
 *    crée jamais une seconde : sinon la même réparation compterait deux fois
 *    dans les dépenses.
 * 3. **Au-delà de 20 % ou 20 € d'écart** (le plus petit des deux), et si
 *    l'agence a allumé le contrôle, rien ne bouge tant qu'un AUTRE gérant ou
 *    associé n'a pas répondu. L'ancien montant reste en place en attendant.
 *
 * Ce qu'il ne faut pas casser : la référence `maintenance:<id>` est l'unique
 * lien vers l'écriture comptable d'un entretien courant. Une réparation de
 * dégâts en a une PAR DÉGÂT (`maintenance:<id>:<dégât>`) et son montant total
 * ne se corrige pas ici : il vient du règlement, dégât par dégât.
 */
export async function updateMaintenanceRecord(recordId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, type, amount, paid_at, work_status')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }

  // Les pièces remplacées, réécrites en bloc : plus simple et plus sûr que de
  // suivre les ajouts et retraits ligne à ligne dans un formulaire.
  let pieces: MaintenancePart[] = []
  try {
    const brut = formData.get('parts') as string | null
    if (brut) pieces = (JSON.parse(brut) as MaintenancePart[])
      .filter(p => (p.label ?? '').trim().length > 0)
      .map(p => ({
        label: String(p.label).trim(),
        quantity: Number(p.quantity) || 1,
        unit_price: Number(p.unit_price) || 0,
      }))
  } catch {
    return { error: 'Pièces illisibles' }
  }

  const laborRaw = (formData.get('labor_cost') as string)?.trim()
  const labor = laborRaw ? parseFloat(laborRaw.replace(',', '.')) : null
  const amountRaw = (formData.get('amount') as string)?.trim()
  const amountSaisi = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0
  const kmRaw = (formData.get('km_at_intervention') as string)?.trim()
  const km = kmRaw ? parseInt(kmRaw, 10) : null

  const ancien = rec.amount ?? 0
  const nouveau = Number.isFinite(amountSaisi) ? amountSaisi : 0
  const montantChange = Math.abs(nouveau - ancien) > 0.004
  const motif = (formData.get('reason') as string)?.trim() || ''
  if (montantChange && motif.length < 3) {
    return { error: 'Indiquez pourquoi le montant change.' }
  }

  // Le contrôle ne s'applique que si l'agence l'a allumé, et jamais à la
  // première saisie : corriger 0 € en 250 € est une saisie, pas une correction.
  const { data: agence } = await supabase
    .from('agency_settings').select('require_amount_validation').limit(1).maybeSingle()
  const controleActif = Boolean(agence?.require_amount_validation)
  const enAttente = montantChange && ancien > 0 && controleActif
    && correctionSoumiseAControle(ancien, nouveau)

  const payload: Record<string, unknown> = {
    description: (formData.get('description') as string)?.trim() || null,
    date:        (formData.get('date') as string) || undefined,
    km_at_intervention: Number.isFinite(km as number) ? km : null,
    provider:    (formData.get('provider') as string)?.trim() || null,
    notes:       (formData.get('notes') as string)?.trim() || null,
    labor_cost:  Number.isFinite(labor as number) ? labor : null,
    urgency:     URGENCY_KEYS.includes(formData.get('urgency') as string)
                   ? (formData.get('urgency') as string) : undefined,
    due_date:    (formData.get('due_date') as string) || null,
    assigned_to: (formData.get('assigned_to') as string) || null,
  }
  // Le montant n'est écrit tout de suite que si personne n'a à valider.
  if (montantChange && !enAttente) payload.amount = nouveau

  const { error } = await supabase.from('maintenance_records').update(payload).eq('id', recordId)
  if (error) return { error: error.message }

  await supabase.from('maintenance_parts').delete().eq('maintenance_id', recordId)
  if (pieces.length > 0) {
    const { error: pErr } = await supabase
      .from('maintenance_parts')
      .insert(pieces.map(p => ({ ...p, maintenance_id: recordId })))
    if (pErr) return { error: pErr.message }
  }

  if (enAttente) {
    const { error: dErr } = await supabase.from('maintenance_amount_requests').insert({
      maintenance_id: recordId,
      requested_by: user.id,
      old_amount: ancien,
      new_amount: nouveau,
      reason: motif,
    })
    if (dErr) return { error: dErr.message }
    await supabase.from('audit_logs').insert({
      user_id: user.id, action: 'intervention_correction_demandee',
      entity_type: 'maintenance_records', entity_id: recordId,
      metadata: { ancien, nouveau, motif },
    })
    revalidatePath(`/maintenance/${rec.vehicle_id}`)
    return { success: true, enAttente: true }
  }

  // Intervention déjà réglée : son écriture comptable doit suivre le nouveau
  // montant, sans jamais être dupliquée.
  if (montantChange && rec.paid_at) {
    const admin = createAdminClient()
    await admin
      .from('financial_transactions')
      .update({ amount: nouveau })
      .eq('reference', `maintenance:${recordId}`)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'maintenance_updated',
    entity_type: 'maintenance_records',
    entity_id: recordId,
    metadata: montantChange ? { ancien, nouveau, motif } : {},
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/suivi')
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Répond à une demande de correction de montant : la valider applique le
 * nouveau montant et corrige l'écriture comptable ; la refuser laisse tout en
 * l'état.
 *
 * **Personne ne valide sa propre demande** — c'est tout l'intérêt du contrôle.
 * Réservé aux gérants, associés et administrateurs.
 */
export async function repondreDemandeMontant(
  requestId: string,
  decision: 'validee' | 'refusee',
  note?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user.id).single()
  const peut = profile?.is_admin || ROLES_QUI_CLOTURENT.includes(profile?.role ?? '')
  if (!peut) return { error: 'Seuls un gérant ou un associé peuvent répondre à une demande.' }

  const { data: dem } = await supabase
    .from('maintenance_amount_requests')
    .select('id, maintenance_id, requested_by, new_amount, status')
    .eq('id', requestId)
    .single()
  if (!dem) return { error: 'Demande introuvable' }
  if (dem.status !== 'en_attente') return { error: 'Cette demande a déjà été traitée.' }
  if (dem.requested_by === user.id) {
    return { error: 'Vous ne pouvez pas valider votre propre correction.' }
  }

  const { error } = await supabase
    .from('maintenance_amount_requests')
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note?.trim() || null,
    })
    .eq('id', requestId)
  if (error) return { error: error.message }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, paid_at')
    .eq('id', dem.maintenance_id)
    .single()

  if (decision === 'validee' && rec) {
    await supabase
      .from('maintenance_records')
      .update({ amount: dem.new_amount })
      .eq('id', rec.id)
    if (rec.paid_at) {
      const admin = createAdminClient()
      await admin
        .from('financial_transactions')
        .update({ amount: dem.new_amount })
        .eq('reference', `maintenance:${rec.id}`)
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: decision === 'validee' ? 'intervention_correction_validee' : 'intervention_correction_refusee',
    entity_type: 'maintenance_records',
    entity_id: dem.maintenance_id,
    metadata: { montant: dem.new_amount, note: note ?? null },
  })

  if (rec) revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Supprime une intervention d'entretien et nettoie ses artefacts : la charge
 * comptable liée (reference `maintenance:<id>`, si l'intervention avait été
 * réglée) et, best-effort, le RDV garage au calendrier (même véhicule / même
 * jour — ces événements n'ont pas de source_key). Le km véhicule et le prochain
 * entretien planifié ne sont PAS recalculés.
 */
export async function deleteMaintenanceRecord(recordId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, type, date, calendar_event_id')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }

  const admin = createAdminClient()
  await admin.from('financial_transactions').delete().eq('reference', `maintenance:${recordId}`)

  if (GARAGE_TYPES.has(rec.type)) {
    await retirerDuRdvGarage(admin, rec)
  }

  const { error } = await supabase.from('maintenance_records').delete().eq('id', recordId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'maintenance_deleted',
    entity_type: 'maintenance_records', entity_id: recordId, metadata: {},
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/maintenance')
  revalidatePath('/accounting')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/**
 * Retire une intervention de son passage au garage.
 *
 * Attend l'intervention qu'on supprime. Produit : le véhicule quitte le créneau
 * du calendrier **seulement s'il n'a plus rien à y faire**, et le créneau ne
 * disparaît que s'il ne reste personne dessus.
 *
 * Pourquoi c'est écrit à part (Jeff, remarque 43 du 03/08/2026) : la suppression
 * effaçait le créneau entier. Avec un rendez-vous partagé, annuler la révision
 * d'une voiture aurait fait disparaître du calendrier le passage des trois
 * autres, sans que personne ne s'en aperçoive avant le jour du garage.
 *
 * ⚠️ `calendar_event_id` est NULL sur tout l'historique d'avant la migration 078.
 * On retombe alors sur la recherche par date et par véhicule, l'ancien
 * comportement : ne pas supprimer cette branche tant que ces lignes existent.
 */
async function retirerDuRdvGarage(
  admin: ReturnType<typeof createAdminClient>,
  rec: { id: string; vehicle_id: string; date: string; calendar_event_id?: string | null },
) {
  if (!rec.calendar_event_id) {
    await admin
      .from('calendar_events')
      .delete()
      .eq('event_type', 'rdv_garage')
      .contains('vehicle_ids', [rec.vehicle_id])
      .gte('start_at', `${rec.date}T00:00:00`)
      .lte('start_at', `${rec.date}T23:59:59`)
    return
  }

  const { data: event } = await admin
    .from('calendar_events')
    .select('id, vehicle_ids')
    .eq('id', rec.calendar_event_id)
    .maybeSingle()
  if (!event) return

  // Les autres interventions encore vivantes sur ce même créneau.
  const { data: restantes } = await admin
    .from('maintenance_records')
    .select('id, vehicle_id')
    .eq('calendar_event_id', rec.calendar_event_id)
    .neq('id', rec.id)

  const vehiculesRestants = [...new Set((restantes ?? []).map(r => r.vehicle_id))]

  if (vehiculesRestants.length === 0) {
    await admin.from('calendar_events').delete().eq('id', rec.calendar_event_id)
    return
  }

  // Ce véhicule a-t-il encore autre chose à faire sur ce créneau ? Si oui, il y
  // reste : deux réparations sur la même voiture, on n'en annule qu'une.
  const idsRestants = ((event.vehicle_ids as string[] | null) ?? [])
    .filter(id => vehiculesRestants.includes(id))
  if (idsRestants.length === 0) {
    await admin.from('calendar_events').delete().eq('id', rec.calendar_event_id)
    return
  }

  // Le titre suit : « Garage · 3 véhicules » doit devenir « Garage · 2 véhicules »,
  // sinon le calendrier annonce une voiture qui n'y va plus.
  const { data: veh } = await admin
    .from('vehicles').select('id, brand, model').in('id', idsRestants)
  const parId = new Map((veh ?? []).map(v => [v.id, v]))
  const typesRestants = (restantes ?? [])
    .filter(r => idsRestants.includes(r.vehicle_id))
    .map(r => ({ vehicleId: r.vehicle_id, type: '' }))

  await admin
    .from('calendar_events')
    .update({
      vehicle_ids: idsRestants,
      title: titreRdvGarage(idsRestants, parId, typesRestants, true),
    })
    .eq('id', rec.calendar_event_id)
}

// Catégorie comptable selon le type d'intervention (réparation vs entretien courant).
function expenseCategoryFor(type: string): string {
  if (['reparation', 'carrosserie', 'freins'].includes(type)) return 'reparations'
  if (['revision', 'vidange', 'pneus', 'controle_technique'].includes(type)) return 'entretien'
  if (type === 'lavage') return 'lavage'
  if (type === 'carburant') return 'carburant'
  return 'autres_depenses'
}

/**
 * Marque une intervention comme payée et l'enregistre en comptabilité (choix
 * gérant : la dépense n'est bookée qu'au règlement, pas à la saisie). Anti-doublon
 * via `reference = maintenance:<id>` : un 2ᵉ clic ne recrée pas la transaction.
 * Couvre aussi les réparations de sinistre, qui passent par `maintenance_records`.
 */
export async function markMaintenancePaid(recordId: string, method: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, type, description, amount, date, paid_at, work_status')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('maintenance_records')
    .update({
      paid_at: today,
      paid_method: method,
      // Payer le garage clôt le travail s'il ne l'était pas déjà : c'est le seul
      // endroit où l'argent décide du travail (02/08/2026). Une intervention déjà
      // terminée ou annulée garde son statut.
      ...(WORK_STATUSES_CLOS.includes(rec.work_status as WorkStatusKey)
        ? {}
        : { work_status: 'terminee', closed_at: new Date().toISOString() }),
    })
    .eq('id', recordId)
  if (error) return { error: error.message }

  const amount = rec.amount ?? 0
  const reference = `maintenance:${rec.id}`
  if (amount > 0) {
    const admin = createAdminClient()
    const { data: dup } = await admin
      .from('financial_transactions').select('id').eq('reference', reference).maybeSingle()
    if (!dup) {
      const { label } = maintenanceType(rec.type)
      const { error: txError } = await admin.from('financial_transactions').insert({
        date: today,
        type: 'depense',
        category: expenseCategoryFor(rec.type),
        amount,
        vehicle_id: rec.vehicle_id,
        payment_method: method,
        notes: `${label}${rec.description ? ` · ${rec.description}` : ''} (${rec.date})`,
        reference,
        created_by: user.id,
      })
      if (txError) return { error: txError.message }
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'maintenance_paid',
    entity_type: 'maintenance_records',
    entity_id: rec.id,
    metadata: { amount, method },
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/maintenance')
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Règle une intervention qui répare des DÉGÂTS, avec le montant réellement
 * facturé par le garage, dégât par dégât.
 *
 * Attend l'identifiant de l'intervention, une ligne par dégât (`flagId` et le
 * montant du garage) et le mode de règlement. Produit : les dégâts passent en
 * réparés, l'intervention passe en réglée, et la comptabilité reçoit UNE ÉCRITURE
 * PAR DÉGÂT.
 *
 * Pourquoi une écriture par dégât et non une seule pour l'intervention (règle de
 * Jeff du 01/08/2026) : un même passage au garage peut réparer une rayure due à
 * une location ET une usure du temps. Une écriture globale rendrait impossible de
 * dire ce que le client a remboursé et ce que la société a payé de sa poche, qui
 * est justement toute la question de la rubrique « Dégâts et réparations ».
 *
 * Le moment de l'écriture est le RÈGLEMENT du garage, jamais le devis : tant que
 * le garage n'a pas facturé, aucune dépense n'existe.
 *
 * Ce qu'il ne faut pas casser : la référence `maintenance:<id>:<flagId>` est le
 * garde anti-doublon. La retirer ferait payer deux fois au deuxième clic.
 * `markMaintenancePaid` reste le chemin des entretiens courants, sans dégât.
 */
export async function settleIntervention(
  recordId: string,
  lignes: { flagId: string; amount: number }[],
  method: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, date, paid_at, work_status')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }
  if (rec.paid_at) return { error: 'Cette intervention est déjà réglée' }

  const today = new Date().toISOString().slice(0, 10)
  const locked = await assertPeriodOpen(supabase, today)
  if (locked) return { error: locked }

  const { data: veh } = await supabase
    .from('vehicles').select('maintenance_flags').eq('id', rec.vehicle_id).single()
  const flags = (veh?.maintenance_flags as MaintenanceFlag[] | null) ?? []
  const concernes = flags.filter(f => f.intervention_id === recordId && !f.repaired_at)
  if (concernes.length === 0) return { error: 'Aucun dégât à régler sur cette intervention' }

  const montantDe = (flagId: string) => {
    const l = lignes.find(x => x.flagId === flagId)
    return l && l.amount > 0 ? l.amount : 0
  }
  const total = concernes.reduce((s, f) => s + montantDe(f.id), 0)
  if (total <= 0) return { error: 'Saisissez au moins un montant facturé par le garage' }

  const admin = createAdminClient()
  for (const f of concernes) {
    const m = montantDe(f.id)
    if (m <= 0) continue

    const reference = `maintenance:${recordId}:${f.id}`
    const { data: dup } = await admin
      .from('financial_transactions').select('id').eq('reference', reference).maybeSingle()
    if (dup) continue

    // Un dégât survenu pendant une location mais NON facturé au client (geste
    // commercial, prise en charge par l'assurance) sort de l'origine « location » :
    // sans recette en face, il fausserait le taux d'amortissement des locations.
    const origineCompta = f.origin === 'location' && !(f.billed_amount && f.billed_amount > 0)
      ? 'non_facture'
      : (f.origin ?? 'non_communiquee')

    const { error: txErr } = await admin.from('financial_transactions').insert({
      date: today,
      type: 'depense',
      category: expenseCategoryForDamageType(f.damage_type),
      amount: m,
      vehicle_id: rec.vehicle_id,
      reservation_id: f.reservation_id ?? null,
      payment_method: method,
      damage_origin: origineCompta,
      damage_type: f.damage_type ?? null,
      notes: `Réparation : ${f.label}`,
      reference,
      created_by: user.id,
    })
    if (txErr) return { error: txErr.message }
  }

  // Les dégâts passent en réparés, avec ce qu'ils ont réellement coûté.
  const majFlags = flags.map(f =>
    concernes.some(c => c.id === f.id)
      ? { ...f, repaired_at: today, repair_cost: montantDe(f.id) || null }
      : f,
  )
  const { error: flagErr } = await supabase
    .from('vehicles').update({ maintenance_flags: majFlags }).eq('id', rec.vehicle_id)
  if (flagErr) return { error: flagErr.message }

  const { error: recErr } = await supabase
    .from('maintenance_records')
    .update({
      amount: total, paid_at: today, paid_method: method,
      // Le garage a facturé, donc il a fini : le travail se clôt en même temps,
      // sauf si quelqu'un l'avait déjà clos ou annulé.
      ...(WORK_STATUSES_CLOS.includes(rec.work_status as WorkStatusKey)
        ? {}
        : { work_status: 'terminee', closed_at: new Date().toISOString() }),
    })
    .eq('id', recordId)
  if (recErr) return { error: recErr.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'intervention_settled',
    entity_type: 'maintenance_records',
    entity_id: recordId,
    metadata: { total, method, degats: concernes.length },
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/maintenance')
  revalidatePath(`/vehicles/${rec.vehicle_id}`)
  revalidatePath('/vehicles')
  revalidatePath('/accounting')
  return { success: true, total }
}
