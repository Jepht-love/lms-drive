import type { createClient } from '@/lib/supabase/server'
import { fetchActiveInternalTrips, estEnDeplacement, internalTripPurposeLabel } from './internalTrips'
import { computeVehicleNeeds, buildLastByType } from '@/lib/maintenance-health'
import type { MaintenanceFlag } from '@/types/database'

/**
 * La SITUATION d'un véhicule : est-il là, et sinon quand revient-il ?
 *
 * D'où ça vient. Le calcul vivait dans l'écran Réservations, où il alimente la
 * carte noire du véhicule choisi depuis le 28/07/2026 (« la C3 revient le
 * 31 août à 12:50, en location, Rayane Jeguirim »). Jeff a demandé le 02/08/2026
 * (remarque 46) la même carte sur Suivi véhicule et sur Déplacements : le calcul
 * est donc sorti de l'écran pour être partagé, à l'identique.
 *
 * Ce qu'elle attend : un identifiant de véhicule. Ce qu'elle produit : la
 * location en cours, la suivante, la dernière rendue, un éventuel déplacement
 * interne, et l'état d'entretien si on le demande.
 *
 * Qui s'en sert : `/reservations`, `/internal-trips`, `/suivi`, à travers le
 * composant `VehicleSituationCard`.
 *
 * À ne pas casser :
 *  - **le STATUT prime sur les dates.** Une location « en retard » a une fin déjà
 *    passée alors que la voiture est toujours dehors ; se fier à la date seule
 *    l'annonçait « disponible », donc relouable. Constaté à l'écran le
 *    28/07/2026 sur la BMW M135i ;
 *  - les heures se mettent en forme avec `fmtAgence` chez l'appelant, jamais avec
 *    le fuseau du serveur : ces écrans sont calculés sur Vercel, en temps
 *    universel. Cette fonction ne rend donc que des instants bruts.
 */
export interface SituationVehicule {
  /** « BMW Série 1 · GE-226-EZ » */
  label: string
  /** Location en cours ou en retard : la voiture est dehors. */
  enCours?: { fin: string; client: string; enRetard: boolean }
  /** Prochaine location à venir. */
  suivante?: { debut: string; client: string }
  /** Dernière location réellement rendue, pour savoir depuis quand elle est au dépôt. */
  precedente?: { fin: string; client: string }
  /** Déplacement interne en cours ou couvrant l'instant présent. */
  deplacement?: { motif: string; retour: string | null }
  /** État mécanique résumé, seulement si `avecEntretien` est demandé. */
  entretien?: { texte: string; urgent: boolean }
  /** Vrai quand rien ne retient le véhicule en ce moment. */
  libre: boolean
}

type Client = Awaited<ReturnType<typeof createClient>>

const nomClient = (r: { client?: unknown }) => {
  const c = Array.isArray(r.client) ? r.client[0] : r.client
  const p = c as { first_name?: string; last_name?: string } | null | undefined
  return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Client' : 'Client'
}

export async function fetchSituationVehicule(
  supabase: Client,
  vehicleId: string,
  options: { avecEntretien?: boolean } = {},
): Promise<SituationVehicule | null> {
  const { data: vehicule } = await supabase
    .from('vehicles')
    .select('id, brand, model, plate, status, current_km, next_service_km, next_service_date, ct_date, maintenance_flags')
    .eq('id', vehicleId)
    .single()
  if (!vehicule) return null

  const maintenant = new Date()

  const { data: sesResas } = await supabase
    .from('reservations')
    .select('start_datetime, end_datetime, status, client:clients(first_name, last_name)')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("annulee","non_presente")')
    .order('start_datetime', { ascending: true })

  const lignes = (sesResas ?? []).map(r => ({
    debut: new Date(r.start_datetime),
    fin: new Date(r.end_datetime),
    debutIso: r.start_datetime as string,
    finIso: r.end_datetime as string,
    client: nomClient(r),
    statut: r.status as string,
  }))

  // Le statut d'abord (voir l'avertissement en tête de fichier), les dates ensuite.
  const dehors = lignes.find(l => l.statut === 'en_cours' || l.statut === 'en_retard')
  const enCours = dehors ?? lignes.find(l => l.debut <= maintenant && l.fin > maintenant)
  const suivante = lignes.find(l => l.debut > maintenant && l !== enCours)
  const precedente = [...lignes].reverse().find(l => l.statut === 'terminee')

  const trip = (await fetchActiveInternalTrips(supabase)).get(vehicleId)
  const enDeplacement = estEnDeplacement(vehicule.status, trip)

  let entretien: SituationVehicule['entretien']
  if (options.avecEntretien) {
    const { data: records } = await supabase
      .from('maintenance_records')
      .select('type, km_at_intervention, date, amount')
      .eq('vehicle_id', vehicleId)
      .order('date', { ascending: false })

    const needs = computeVehicleNeeds(vehicule, buildLastByType(records ?? []), maintenant)
    const degats = ((vehicule.maintenance_flags ?? []) as MaintenanceFlag[]).filter(f => !f.repaired_at)
    // Une seule ligne, la plus grave : cette carte se lit d'un coup d'œil sur un
    // téléphone. Le détail complet reste sur la fiche du véhicule.
    // « overdue » (échéance dépassée) est plus grave qu'« urgent », qui l'est plus
    // que « soon » : on prend le pire dans cet ordre, pas le premier venu.
    const pire = needs.find(n => n.severity === 'overdue')
      ?? needs.find(n => n.severity === 'urgent')
      ?? needs.find(n => n.severity === 'soon')
    if (pire) {
      entretien = {
        texte: `${pire.label} · ${pire.detail}`,
        urgent: pire.severity === 'overdue' || pire.severity === 'urgent',
      }
    } else if (degats.length > 0) {
      entretien = {
        texte: `${degats.length} dégât${degats.length > 1 ? 's' : ''} à traiter`,
        urgent: false,
      }
    } else {
      entretien = { texte: 'Aucune échéance ni dégradation', urgent: false }
    }
  }

  return {
    label: `${[vehicule.brand, vehicule.model].filter(Boolean).join(' ')} · ${vehicule.plate}`,
    enCours: enCours && { fin: enCours.finIso, client: enCours.client, enRetard: enCours.statut === 'en_retard' },
    suivante: suivante && { debut: suivante.debutIso, client: suivante.client },
    precedente: precedente && { fin: precedente.finIso, client: precedente.client },
    deplacement: enDeplacement ? { motif: internalTripPurposeLabel(trip.purpose, trip.purposeNotes), retour: trip.endAt } : undefined,
    entretien,
    libre: !enCours && !enDeplacement,
  }
}
