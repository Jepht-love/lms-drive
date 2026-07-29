import { fetchBlockingInternalTripsForVehicles } from '@/lib/vehicles/internalTrips'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Pourquoi ce fichier existe.
 *
 * Trois choses rendent un véhicule indisponible : une autre réservation, un
 * rendez-vous garage, un déplacement interne. Ces trois contrôles n'existaient
 * qu'au moment d'enregistrer : on saisissait toute la réservation, puis on se
 * faisait refuser. Le gérant devait ouvrir la Flotte dans un autre onglet pour
 * savoir à l'avance (ticket SAV du 27/07/2026, 21h16).
 *
 * L'écueil serait de réécrire ces règles pour l'affichage : deux copies finissent
 * toujours par diverger, et l'écran annoncerait « libre » là où l'enregistrement
 * refuse. Les règles vivent donc ICI, et les deux chemins appellent le même code.
 *
 * Ce qu'il produit, à partir d'UNE seule collecte (`collecterIntervalles`) :
 *  - `vehiculesIndisponibles` : le verdict oui/non par véhicule, utilisé par le
 *    chemin d'ENREGISTREMENT (lib/actions/internal-trips.ts) et par l'affichage
 *    d'origine. Comportement inchangé.
 *  - `analyserDisponibilite` : le même verdict PLUS les créneaux réellement libres
 *    à l'intérieur de la période demandée (ajout du 30/07/2026, panneau
 *    « Véhicules disponibles » des déplacements). Une voiture rendue à 13h et
 *    reprise à 15h n'était annoncée que « prise jusqu'à 15h » : le trou de deux
 *    heures était invisible.
 *
 * À ne pas casser : l'affichage peut être PLUS prudent que l'enregistrement,
 * jamais plus permissif. C'est le sens du drapeau `informatif` ci-dessous — une
 * location non rendue bloque l'écran sans horizon, mais ne fait refuser aucun
 * enregistrement (une voiture en retard de deux heures condamnerait sinon tout
 * son mois de réservations).
 */

export type RaisonIndisponibilite = 'reservation' | 'garage' | 'deplacement'

export const RAISON_LABEL: Record<RaisonIndisponibilite, string> = {
  reservation:  'en location',
  garage:       'au garage',
  deplacement:  'déplacement interne',
}

/**
 * Un créneau plus court que ça n'est pas proposé : personne ne sort un véhicule
 * pour vingt minutes, et une liste criblée de miettes se lit moins bien qu'une
 * ligne « occupé ».
 */
const CRENEAU_MINIMUM_MINUTES = 30

// À TRANCHER AVEC LE GÉRANT (28/07/2026) : un véhicule en fourrière, non
// restitué ou hors service est aujourd'hui annoncé libre et peut être réservé.
// La question de le bloquer, et à partir de quel statut, lui revient : c'est une
// règle de métier, pas un choix technique. Rien n'est fait ici pour l'instant.

/**
 * Véhicules indisponibles sur une période, avec la raison de chacun.
 *
 * `ignorerReservationId` sert à la modification d'une réservation existante :
 * sans lui, elle se déclarerait en conflit avec elle-même. `ignorerDeplacementId`
 * joue le même rôle pour la modification d'un déplacement interne.
 */
export type Indisponibilite = {
  raison: RaisonIndisponibilite
  /**
   * Instant où le véhicule redevient libre, quand on le connaît. `null` pour un
   * déplacement en cours sans retour renseigné : on ne peut alors rien promettre.
   */
  jusqua: string | null
}

export type CreneauLibre = { debut: string; fin: string }

/** Ce que l'écran a besoin de savoir sur un véhicule, pour la période demandée. */
export type DisponibiliteFine = {
  /** `null` = libre sur toute la période demandée. */
  raison: RaisonIndisponibilite | null
  jusqua: string | null
  /** Trous réellement libres à l'intérieur de la période. Vide = rien à proposer. */
  creneaux: CreneauLibre[]
  /**
   * Un engagement court sans retour connu : location non rendue, déplacement en
   * cours non clôturé. L'écran doit alors dire « retour non fait », pas une heure.
   */
  retourInconnu: boolean
}

type IntervalleBloquant = {
  raison: RaisonIndisponibilite
  debut: string
  /** `null` = sans horizon connu. */
  fin: string | null
  /**
   * Vrai quand l'intervalle ne vient PAS de la règle d'enregistrement : il ne sert
   * qu'à prévenir à l'écran (aujourd'hui, les locations non rendues). Filtré par
   * `vehiculesIndisponibles` pour ne rien changer aux refus existants.
   */
  informatif: boolean
}

const ms = (iso: string) => new Date(iso).getTime()

/**
 * Tout ce qui bloque, véhicule par véhicule, en une passe. Ordre de collecte :
 * réservations, locations non rendues, garage, déplacements internes. Cet ordre
 * compte : à date de libération égale, la première raison collectée est celle
 * qu'on affiche (comportement d'origine, conservé).
 */
async function collecterIntervalles(
  supabase: SupabaseClient,
  debutInstant: string,
  finInstant: string,
  options?: {
    vehicleIds?: string[]
    ignorerReservationId?: string
    ignorerDeplacementId?: string
    /** Signaler les locations non rendues (affichage seulement). */
    signalerRetards?: boolean
  },
): Promise<{ vehicules: string[]; parVehicule: Map<string, IntervalleBloquant[]> }> {
  const cibles = options?.vehicleIds
  const parVehicule = new Map<string, IntervalleBloquant[]>()
  const ajouter = (vid: string, i: IntervalleBloquant) => {
    const liste = parVehicule.get(vid)
    if (liste) liste.push(i)
    else parVehicule.set(vid, [i])
  }

  // Liste des véhicules à examiner quand l'appelant n'en impose pas.
  let qVehicules = supabase.from('vehicles').select('id')
  if (cibles?.length) qVehicules = qVehicules.in('id', cibles)
  const { data: vehicules } = await qVehicules

  // 1. Autres réservations. Chevauchement RÉEL : l'existante commence avant la
  //    fin de la nouvelle ET se termine après son début.
  let q = supabase
    .from('reservations')
    .select('vehicle_id, start_datetime, end_datetime')
    .not('status', 'in', '("annulee","terminee","non_presente")')
    .lt('start_datetime', finInstant)
    .gt('end_datetime', debutInstant)
  if (cibles?.length) q = q.in('vehicle_id', cibles)
  if (options?.ignorerReservationId) q = q.neq('id', options.ignorerReservationId)
  const { data: resas } = await q
  for (const r of resas ?? []) {
    if (!r.vehicle_id) continue
    ajouter(r.vehicle_id, {
      raison: 'reservation',
      debut: r.start_datetime,
      fin: r.end_datetime ?? null,
      informatif: false,
    })
  }

  // 1 bis. Locations NON RENDUES (30/07/2026). Leur fin prévue est passée : la
  //    requête ci-dessus ne les voit plus, et l'écran annonçait le véhicule libre
  //    alors qu'il est chez un client. On les traite comme un déplacement en cours
  //    sans retour connu : sans horizon. `en_cours` avec fin dépassée compte
  //    aussi, la bascule vers `en_retard` ne passe qu'une fois par heure
  //    (app/api/notifications/route.ts).
  if (options?.signalerRetards) {
    const maintenant = new Date().toISOString()
    let qRetard = supabase
      .from('reservations')
      .select('vehicle_id, start_datetime')
      .in('status', ['en_cours', 'en_retard'])
      .lte('end_datetime', maintenant)
      .lt('start_datetime', finInstant)
    if (cibles?.length) qRetard = qRetard.in('vehicle_id', cibles)
    if (options?.ignorerReservationId) qRetard = qRetard.neq('id', options.ignorerReservationId)
    const { data: retards } = await qRetard
    for (const r of retards ?? []) {
      if (!r.vehicle_id) continue
      ajouter(r.vehicle_id, {
        raison: 'reservation',
        debut: r.start_datetime,
        fin: null,
        informatif: true,
      })
    }
  }

  // 2. Rendez-vous garage, sur leur propre fenêtre uniquement : un RDV 14h-17h
  //    n'empêche pas une location à 18h.
  const { data: garages } = await supabase
    .from('calendar_events')
    .select('vehicle_ids, start_at, end_at')
    .eq('event_type', 'rdv_garage')
    .neq('status', 'annule')
    .lt('start_at', finInstant)
    .gt('end_at', debutInstant)
  for (const g of garages ?? []) {
    for (const vid of (g.vehicle_ids as string[] | null) ?? []) {
      if (cibles?.length && !cibles.includes(vid)) continue
      ajouter(vid, {
        raison: 'garage',
        debut: (g.start_at as string | null) ?? debutInstant,
        fin: (g.end_at as string | null) ?? null,
        informatif: false,
      })
    }
  }

  // 3. Déplacements internes, tous les blocages de tous les véhicules en une
  //    requête. La règle de fenêtre (fin nulle, trajet en cours, repli d'une
  //    heure) reste chez elle : lib/vehicles/internalTrips.ts.
  const aTester = (cibles?.length ? cibles : (vehicules ?? []).map(v => v.id)).filter(Boolean)
  const trajets = await fetchBlockingInternalTripsForVehicles(
    supabase, aTester, debutInstant, finInstant, options?.ignorerDeplacementId,
  )
  for (const [vid, fenetres] of trajets) {
    for (const f of fenetres) {
      ajouter(vid, { raison: 'deplacement', debut: f.debut, fin: f.fin, informatif: false })
    }
  }

  return { vehicules: aTester, parVehicule }
}

/**
 * Le verdict d'origine : une raison et la date de libération la PLUS TARDIVE.
 * Un véhicule peut être bloqué par plusieurs choses à la fois ; retenir la plus
 * proche annoncerait libre un véhicule dont un autre engagement court encore.
 * Une fin inconnue l'emporte sur tout : c'est la plus contraignante.
 */
function verdict(intervalles: IntervalleBloquant[]): Indisponibilite | null {
  let actuel: Indisponibilite | null = null
  for (const i of intervalles) {
    if (!actuel) { actuel = { raison: i.raison, jusqua: i.fin }; continue }
    if (actuel.jusqua === null) continue
    if (i.fin === null || ms(i.fin) > ms(actuel.jusqua)) actuel = { raison: i.raison, jusqua: i.fin }
  }
  return actuel
}

/**
 * Les trous libres à l'intérieur de [debut, fin[. Les intervalles sont d'abord
 * ramenés aux bornes demandées (une fin inconnue occupe tout le reste de la
 * période), puis fusionnés ; ce qui reste entre eux est libre.
 *
 * Les instants sont comparés en millisecondes, pas en texte : Supabase rend
 * `+00:00` là où le code produit `Z`, et deux écritures du même instant ne se
 * comparent pas correctement caractère par caractère.
 */
function creneauxLibres(
  intervalles: IntervalleBloquant[],
  debutInstant: string,
  finInstant: string,
): CreneauLibre[] {
  const debut = ms(debutInstant)
  const fin = ms(finInstant)
  const pris = intervalles
    .map(i => ({
      d: Math.max(debut, ms(i.debut)),
      f: i.fin === null ? fin : Math.min(fin, ms(i.fin)),
    }))
    .filter(i => i.d < i.f)
    .sort((a, b) => a.d - b.d)

  const libres: CreneauLibre[] = []
  let curseur = debut
  for (const i of pris) {
    if (i.d > curseur) libres.push({ debut: new Date(curseur).toISOString(), fin: new Date(i.d).toISOString() })
    if (i.f > curseur) curseur = i.f
  }
  if (curseur < fin) libres.push({ debut: new Date(curseur).toISOString(), fin: new Date(fin).toISOString() })

  const mini = CRENEAU_MINIMUM_MINUTES * 60_000
  return libres.filter(c => ms(c.fin) - ms(c.debut) >= mini)
}

export async function vehiculesIndisponibles(
  supabase: SupabaseClient,
  debutInstant: string,
  finInstant: string,
  options?: { vehicleIds?: string[]; ignorerReservationId?: string; ignorerDeplacementId?: string },
): Promise<Map<string, Indisponibilite>> {
  const { parVehicule } = await collecterIntervalles(supabase, debutInstant, finInstant, options)
  const indispo = new Map<string, Indisponibilite>()
  for (const [vid, intervalles] of parVehicule) {
    const v = verdict(intervalles)
    if (v) indispo.set(vid, v)
  }
  return indispo
}

/**
 * Le verdict ET les créneaux libres, pour l'écran. Rend une entrée par véhicule
 * examiné, y compris ceux entièrement libres (`raison: null`).
 *
 * `busy` reprend exactement ce que renvoie `vehiculesIndisponibles` — mêmes
 * intervalles, mêmes règles — pour que l'ancien affichage (choix du véhicule dans
 * le formulaire de réservation) ne change pas de comportement.
 */
export async function analyserDisponibilite(
  supabase: SupabaseClient,
  debutInstant: string,
  finInstant: string,
  options?: { vehicleIds?: string[]; ignorerReservationId?: string; ignorerDeplacementId?: string },
): Promise<{ busy: Map<string, Indisponibilite>; fine: Map<string, DisponibiliteFine> }> {
  const { vehicules, parVehicule } = await collecterIntervalles(
    supabase, debutInstant, finInstant, { ...options, signalerRetards: true },
  )

  const busy = new Map<string, Indisponibilite>()
  const fine = new Map<string, DisponibiliteFine>()

  for (const vid of vehicules) {
    const intervalles = parVehicule.get(vid) ?? []
    // Le refus d'enregistrement ne connaît pas les locations non rendues.
    const v = verdict(intervalles.filter(i => !i.informatif))
    if (v) busy.set(vid, v)

    const complet = verdict(intervalles)
    fine.set(vid, {
      raison: complet?.raison ?? null,
      jusqua: complet?.jusqua ?? null,
      creneaux: creneauxLibres(intervalles, debutInstant, finInstant),
      retourInconnu: intervalles.some(i => i.fin === null),
    })
  }

  // Un véhicule bloqué par un garage alors qu'il n'était pas dans la liste
  // examinée (cible non imposée + événement portant un véhicule supprimé) ne
  // doit pas disparaître du verdict.
  for (const [vid, intervalles] of parVehicule) {
    if (fine.has(vid)) continue
    const v = verdict(intervalles.filter(i => !i.informatif))
    if (v) busy.set(vid, v)
  }

  return { busy, fine }
}
