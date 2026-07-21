import { createClient } from '@/lib/supabase/server'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import Link from 'next/link'
import {
  differenceInDays, format, isSameDay,
  startOfDay, endOfDay, addDays, subDays,
} from 'date-fns'
import { getColumnWindow, businessNow } from '@/lib/calendar/dateUtils'
import { taskActionHref } from '@/lib/utils'
import { CALENDAR_START_HOUR } from '@/lib/calendar/constants'
import { fr } from 'date-fns/locale'
import {
  ChevronRight, AlertTriangle, CheckCircle2, Plus,
  Wrench, Clock, FileText, ArrowLeftRight, UserRound, type LucideIcon,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVehicle(r: any) { return Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles }
function getClient(r: any)  { return Array.isArray(r.clients)  ? r.clients[0]  : r.clients  }

// Lien « À assigner » sans événement calendrier existant : ouvre le calendrier
// sur un tiroir de CRÉATION pré-rempli (tâche de préparation datée + véhicule +
// client), qu'il ne reste qu'à affecter à un collaborateur. Répond à la demande
// « crée la tâche même si elle n'existe pas et on peut l'assigner ».
function assignCreateHref(label: string, startIso: string, vehicleId?: string | null, clientId?: string | null): string {
  const params = new URLSearchParams({ create: 'prep', date: startIso, title: label })
  if (vehicleId) params.set('vehicle', vehicleId)
  if (clientId) params.set('client', clientId)
  return `/calendrier?${params.toString()}`
}

const TASK_STATUS_BADGE: Record<string, string> = {
  a_faire:  'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-50 text-blue-700',
  termine:  'bg-green-50 text-green-700',
  reporte:  'bg-orange-50 text-orange-700',
  annule:   'bg-red-50 text-red-600',
}
const TASK_STATUS_LABEL: Record<string, string> = {
  a_faire:  'À faire',
  en_cours: 'En cours',
  termine:  'Terminé',
  reporte:  'Reporté',
  annule:   'Annulé',
}
type AlertGroup = {
  type: string
  label: string
  icon: LucideIcon
  href: string
  cardBg: string; cardBorder: string
  labelColor: string; iconColor: string
  badgeBg: string; badgeText: string
}
const ALERT_GROUPS: AlertGroup[] = [
  { type: 'retard',   label: 'Retour en retard',      icon: AlertTriangle, href: '/reservations',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'contrat',  label: 'Contrat à signer',       icon: FileText,      href: '/contracts',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'recuperation_retard', label: 'Récupération en retard', icon: AlertTriangle, href: '/reservations',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'ct',       label: 'Contrôle technique',     icon: AlertTriangle, href: '/vehicles',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'assurance',label: 'Assurance',              icon: AlertTriangle, href: '/vehicles',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'revision', label: 'Révision / Entretien',   icon: Wrench,        href: '/vehicles',
    cardBg: 'bg-amber-50',  cardBorder: 'border-amber-100',  labelColor: 'text-amber-700',  iconColor: 'text-amber-500',  badgeBg: 'bg-amber-400',  badgeText: 'text-white' },
  { type: 'lavage',   label: 'Lavage avant location',  icon: Wrench,        href: '/maintenance',
    cardBg: 'bg-cyan-50',   cardBorder: 'border-cyan-100',   labelColor: 'text-cyan-700',   iconColor: 'text-cyan-500',   badgeBg: 'bg-cyan-500',   badgeText: 'text-white' },
  { type: 'tache',      label: 'Tâche en retard',        icon: Clock,         href: '/calendrier',
    cardBg: 'bg-gray-50',   cardBorder: 'border-gray-200',   labelColor: 'text-gray-600',   iconColor: 'text-gray-400',   badgeBg: 'bg-gray-400',   badgeText: 'text-white' },
  { type: 'infraction', label: 'Infraction non réglée',  icon: AlertTriangle, href: '/incidents/infractions',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'sinistre',   label: 'Sinistre en cours',      icon: AlertTriangle, href: '/incidents/sinistres',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'document',   label: 'Document expiré',        icon: FileText,      href: '/documents',
    cardBg: 'bg-amber-50',  cardBorder: 'border-amber-100',  labelColor: 'text-amber-700',  iconColor: 'text-amber-500',  badgeBg: 'bg-amber-400',  badgeText: 'text-white' },
]

const TASK_TYPE_LABELS: Record<string, string> = {
  lavage:               'Lavage',
  preparation:          'Préparation',
  rendez_vous_client:   'RDV Client',
  rendez_vous_garage:   'RDV Garage',
  livraison:            'Livraison',
  recuperation:         'Récupération',
  entretien:            'Entretien',
  controle_etat_lieux:  'État des lieux',
  paiement_caution:     'Caution',
  document_manquant:    'Document',
  marketing:            'Marketing',
  autre:                'Tâche',
}

// Prochaines 6h : style de pastille par type d'action (départ/retour/tâche/RDV…).
const NEXT6H_TYPE_STYLE: Record<string, { badge: string; label: string }> = {
  depart:       { badge: 'bg-black text-white',           label: 'Départ' },
  apreparer:    { badge: 'bg-amber-500 text-white',       label: 'À préparer' },
  retour:       { badge: 'bg-blue-100 text-blue-700',     label: 'Retour' },
  tache:        { badge: 'bg-violet-100 text-violet-700', label: 'Tâche' },
  rdv_client:   { badge: 'bg-pink-100 text-pink-700',     label: 'RDV client' },
  rdv_garage:   { badge: 'bg-cyan-100 text-cyan-700',     label: 'RDV garage' },
  rdv_autre:    { badge: 'bg-pink-100 text-pink-700',     label: 'RDV' },
  livraison:    { badge: 'bg-lime-100 text-lime-700',     label: 'Livraison' },
  recuperation: { badge: 'bg-orange-100 text-orange-700', label: 'Récupération' },
}

// Ligne « qui s'en charge » sur une carte du tableau de bord (départ, retour).
// Nom de l'opérateur / équipe assigné, ou « À assigner » en ambre quand
// personne n'est encore affecté — pour repérer d'un coup d'œil qui fait quoi
// et ce qui reste à distribuer. L'assignation se pose sur l'événement calendrier
// (départ / retour) lié à la réservation, jamais sur la réservation elle-même.
function AssigneeLine({ name }: { name: string | null }) {
  return (
    <p className={`text-[11px] mt-1 flex items-center gap-1 ${name ? 'font-medium text-gray-600' : 'font-semibold text-amber-600'}`}>
      <UserRound className="w-3 h-3 flex-shrink-0" />
      {name ?? 'À assigner'}
    </p>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase   = await createClient()
  // Heure de l'agence (BUSINESS_TZ), pas l'heure serveur UTC : sinon, selon
  // l'heure de consultation, un départ du jour bascule à tort dans "à venir".
  const now        = businessNow()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const in7Days    = addDays(now, 7)

  // "Journée métier" (7h → 3h le lendemain), même fenêtre que le calendrier
  // (lib/calendar/dateUtils.ts) — sans ça, un départ entre minuit et 3h du
  // matin compte comme "aujourd'hui" ici mais comme "hier" sur le calendrier
  // (ou l'inverse), donnant l'impression qu'un départ visible au calendrier
  // n'apparaît jamais dans les tâches du jour du tableau de bord.
  const businessDayRef = now.getHours() < CALENDAR_START_HOUR ? subDays(now, 1) : now
  const { start: businessDayStart, end: businessDayEnd } = getColumnWindow(businessDayRef)

  // ── Profil ────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()
  const isManager = profile?.role === 'gerant' || profile?.role === 'associe'

  // Bloc Flotte : accessible par défaut ; le gérant peut le retirer par membre
  // (colonne optionnelle — requête séparée tolérante avant la migration 020).
  const { data: fleetPerm } = await supabase
    .from('profiles')
    .select('can_view_fleet')
    .eq('id', user?.id ?? '')
    .maybeSingle()
  const canViewFleet = (fleetPerm as { can_view_fleet?: boolean | null } | null)?.can_view_fleet
  const showFleet = isManager || canViewFleet === true

  // ── Flotte ────────────────────────────────────────────────────────────────
  const { data: vehiclesRaw } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, status, insurance_expiry, ct_date, next_service_date, next_service_km, current_km')
    .eq('is_active', true)

  // Exclut les véhicules partenaires temporaires (inter-agences) des KPI flotte.
  // Requête séparée et tolérante : avant la migration 035 (colonne is_external
  // absente) elle renvoie une erreur silencieuse → aucun exclu, jamais de crash.
  const { data: externalRows } = await supabase.from('vehicles').select('id').eq('is_external', true)
  const externalIds = new Set((externalRows ?? []).map(v => v.id))
  const vehicles = (vehiclesRaw ?? []).filter(v => !externalIds.has(v.id))

  const total          = vehicles?.length ?? 0
  // « Réservé » = départ à venir, le véhicule est TOUJOURS physiquement sur le
  // parc → il compte comme DISPONIBLE tant qu'il n'est pas parti (demande gérant :
  // « les autres sont juste réservés, ils doivent être dans disponibles »).
  const disponibles    = vehicles?.filter(v => ['disponible', 'reserve'].includes(v.status)).length ?? 0
  // « En location » = réellement sorti : loué (client) ou mis à disposition (chez
  // partenaire). Le réservé n'en fait PAS partie. C'est aussi le taux d'occupation.
  const enLocation     = vehicles?.filter(v => ['loue', 'mis_a_disposition'].includes(v.status)).length ?? 0
  // « mis_a_disposition » exclu : chez partenaire ≠ immobilisé (aligné avec la
  // page Flotte, où il a sa propre pastille « Chez partenaire »).
  const immobilises    = vehicles?.filter(v =>
    ['maintenance', 'hors_service', 'en_verification', 'immobilise', 'a_reparer',
     'fourriere', 'non_restitue', 'deplacement_pro'].includes(v.status)
  ).length ?? 0
  const tauxOccupation = total > 0 ? Math.round((enLocation / total) * 100) : 0

  // ── Réservations ──────────────────────────────────────────────────────────
  const { data: reservations } = await supabase
    .from('reservations')
    .select(`
      id, status, start_datetime, end_datetime, total_price,
      vehicles ( id, plate, brand, model ),
      clients  ( id, first_name, last_name, phone )
    `)
    .in('status', ['option', 'confirmee', 'en_cours', 'en_retard'])
    .lte('start_datetime', in7Days.toISOString())
    .order('start_datetime', { ascending: true })

  // Une réservation « à partir » (départ) = confirmée OU en option (juste créée)
  const isDepart = (s: string) => s === 'confirmee' || s === 'option'

  const departsAujourdhui = reservations?.filter(r =>
    isDepart(r.status) &&
    new Date(r.start_datetime) >= businessDayStart &&
    new Date(r.start_datetime) <= businessDayEnd
    // On garde les départs du jour MÊME quand l'heure est passée et que le client
    // n'est pas venu : ça reste une tâche « à récupérer », pas une location. Ces
    // réservations n'apparaissent plus dans « En location » (réservé aux
    // véhicules réellement sortis), uniquement ici.
  ) ?? []

  // Retours du jour : fenêtre calendaire (minuit→23h59) pour ne pas rater
  // les retours de l'après-midi quand on consulte le tableau avant 7h.
  const retoursAujourdhui = reservations?.filter(r =>
    (r.status === 'en_cours' || r.status === 'en_retard') &&
    new Date(r.end_datetime) >= todayStart &&
    new Date(r.end_datetime) <= todayEnd
  ) ?? []

  // ── Retours EN RETARD (date de retour passée, véhicule pas restitué) ────────
  // Cas prioritaire : chaque jour de retard = manque à gagner direct. Une résa
  // encore "en cours"/"en retard" dont la date de retour est antérieure au jour
  // ouvré courant (≥ 1 jour entier) n'apparaît PAS dans retoursAujourdhui — on
  // la remonte ici, tout en haut des tâches, en rouge. Le retard "du jour même"
  // reste géré par retoursAujourdhui (badge RETOUR EN RETARD).
  const daysLateOf = (r: { end_datetime: string }) =>
    differenceInDays(todayStart, startOfDay(new Date(r.end_datetime)))
  const retoursEnRetard = (reservations ?? [])
    .filter(r =>
      (r.status === 'en_cours' || r.status === 'en_retard') &&
      new Date(r.end_datetime) < businessDayStart &&
      daysLateOf(r) >= 1
    )
    .sort((a, b) => a.end_datetime.localeCompare(b.end_datetime)) // plus en retard en premier

  // ── RÉCUPÉRATIONS EN RETARD (départ dépassé, client pas venu chercher) ──────
  // Une réservation CONFIRMÉE (avance bloquée) dont l'heure de départ est passée
  // mais qui n'est pas encore partie (statut toujours "confirmee", EDL non fait)
  // reste une action à réaliser : on la remonte tout en haut des tâches, comme
  // pour un retour en retard. Le départ "du jour même" reste, lui, dans
  // departsAujourdhui (badge DÉPART / À PRÉPARER).
  // Ticket SAV 21/07 : sans cette liste, un départ passé des jours précédents
  // (client pas venu, contrat pas signé) disparaissait des « Tâches du jour »
  // alors que les alertes le signalaient — le gérant voyait « Aucune mission ».
  const hoursLateOf = (r: { start_datetime: string }) =>
    Math.max(1, Math.floor((now.getTime() - new Date(r.start_datetime).getTime()) / 36e5))
  const recuperationsEnRetard = (reservations ?? [])
    .filter(r =>
      isDepart(r.status) &&
      new Date(r.start_datetime) < businessDayStart
    )
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)) // plus ancien en premier
  // Même véhicule avec un départ ET un retour aujourd'hui (rotation rapide) —
  // à signaler clairement : peu de marge pour laver/préparer entre les deux.
  const departVehicleIds = new Set(departsAujourdhui.map(r => getVehicle(r)?.id).filter(Boolean))
  const retourVehicleIds = new Set(retoursAujourdhui.map(r => getVehicle(r)?.id).filter(Boolean))
  const quickTurnaroundVehicleIds = new Set(
    [...departVehicleIds].filter(id => retourVehicleIds.has(id))
  )

  // ── « En location » : une seule liste, un badge par ligne ───────────────────
  // Demande gérant : ne PAS scinder en deux sections. Une seule section « En
  // location » qui liste tout ce qui touche un véhicule (sorti OU à venir), et
  // c'est le BADGE de chaque ligne qui distingue « Loué » (réellement sorti :
  // en_cours / en_retard) de « Réservé » (départ à venir : option / confirmee).
  // Le KPI de la flotte, lui, reste strict (seuls les loués comptent « en
  // location », les réservés restent « disponibles »). Requête SANS plafond de
  // date : options (pré-blocage), confirmées (avance versée, à venir OU départ
  // dépassé non récupéré), en_cours (partie), en_retard (retour dépassé).
  const { data: locationRaw } = await supabase
    .from('reservations')
    .select(`
      id, status, start_datetime, end_datetime,
      vehicles ( id, plate, brand, model ),
      clients  ( id, first_name, last_name, phone )
    `)
    .in('status', ['option', 'confirmee', 'en_cours', 'en_retard'])
    .order('start_datetime', { ascending: true })
    .limit(100)

  // Une confirmée dont l'heure de départ est atteinte mais non récupérée = à
  // récupérer (prioritaire). Ordre : à récupérer → retour en retard → en cours
  // (par retour) → confirmée future (par départ).
  // Ordre : loués actifs d'abord (à récupérer → retour en retard → en cours),
  // puis les réservés à venir (confirmée future, puis option), triés par date.
  const locationRank = (r: { status: string; start_datetime: string }) => {
    if (r.status === 'confirmee') return new Date(r.start_datetime) <= now ? 0 : 3
    if (r.status === 'en_retard') return 1
    if (r.status === 'en_cours')  return 2
    return 4 // option (réservé, non confirmé)
  }
  // « En location » = uniquement les véhicules réellement SORTIS (départ fait) :
  // en_cours / en_retard. Les réservations simplement réservées/confirmées (pas
  // encore parties) ne sont PAS ici — elles restent dans « Tâches du jour » comme
  // départ à préparer, jusqu'à ce que l'EDL départ soit validé.
  const enLocationNow = (locationRaw ?? [])
    .filter(r => r.status === 'en_cours' || r.status === 'en_retard')
    .slice().sort((a, b) => {
      const ra = locationRank(a), rb = locationRank(b)
      if (ra !== rb) return ra - rb
      const da = ra >= 3 ? a.start_datetime : a.end_datetime
      const db = rb >= 3 ? b.start_datetime : b.end_datetime
      return da.localeCompare(db)
    })

  // ── Mises à disposition inter-agences (véhicule loué CHEZ un partenaire) ─────
  // Une mise à disposition n'est PAS une réservation : c'est une ligne
  // `inter_agency_rentals` (direction "out") qui passe le véhicule en
  // `mis_a_disposition`. Elle compte pourtant « en location » (KPI flotte), donc
  // elle doit apparaître dans la liste « En location » — badge « Loué · chez
  // partenaire ». On part des véhicules réellement `mis_a_disposition` (source de
  // vérité, alignée sur le KPI) puis on récupère l'opération active associée pour
  // les détails (partenaire, dates, client). Statut hors clôture / annulation.
  const partnerVehicleIds = (vehicles ?? [])
    .filter(v => v.status === 'mis_a_disposition')
    .map(v => v.id)
  let misesADispo: any[] = []
  if (partnerVehicleIds.length) {
    const { data: rentalsOut } = await supabase
      .from('inter_agency_rentals')
      .select(`
        id, vehicle_id, start_date, end_date_expected, status,
        vehicles ( id, plate, brand, model ),
        partner_agencies ( name ),
        clients ( first_name, last_name )
      `)
      .eq('direction', 'out')
      .in('vehicle_id', partnerVehicleIds)
      .not('status', 'in', '("cloture","annule")')
      .order('start_date', { ascending: true })
    // Une seule opération active par véhicule (la plus récente prime).
    const seen = new Set<string>()
    for (const op of rentalsOut ?? []) {
      if (!op.vehicle_id || seen.has(op.vehicle_id)) continue
      seen.add(op.vehicle_id)
      misesADispo.push(op)
    }
  }

  // Prochaine réservation par véhicule (confirmee/option la plus proche) — permet
  // de repérer, sur une location en cours, si quelqu'un a déjà réservé après,
  // pour éviter d'accepter une prolongation qui chevaucherait cette résa.
  const nextBookingByVehicle = new Map<string, typeof enLocationNow[number]>()
  for (const other of reservations ?? []) {
    if (!isDepart(other.status)) continue
    const ov = getVehicle(other)
    if (!ov?.id) continue
    const current = nextBookingByVehicle.get(ov.id)
    if (!current || other.start_datetime < current.start_datetime) {
      nextBookingByVehicle.set(ov.id, other)
    }
  }

  // ── Contrats ouverts → réservations « à préparer » ──────────────────────────
  // Un contrat non signé (brouillon / à signer) ou absent = réservation à préparer.
  const weekResIds = (reservations ?? []).map(r => r.id)
  const contractStatusByRes = new Map<string, string>()
  if (weekResIds.length) {
    const { data: weekContracts } = await supabase
      .from('contracts')
      .select('reservation_id, status')
      .in('reservation_id', weekResIds)
    for (const c of weekContracts ?? []) contractStatusByRes.set(c.reservation_id, c.status)
  }
  const isToPrepare = (resId: string) => {
    const st = contractStatusByRes.get(resId)
    return !st || (st !== 'signe' && st !== 'cloture')
  }
  const aPreparerAujourdhui = departsAujourdhui.filter(r => isToPrepare(r.id))

  // ── Assignation des départs / retours (lue sur le calendrier) ───────────────
  // Chaque réservation est reflétée par deux calendar_events (depart_vehicule +
  // retour_vehicule). L'affectation à une personne / équipe se fait sur CES
  // events (tiroir du calendrier), pas sur la réservation. On la lit ici pour
  // afficher « qui s'en charge » sur les cartes départ / retour du jour ET dans
  // la liste Semaine, sans changer le modèle de données.
  const departAssigneeByRes = new Map<string, string>()
  const retourAssigneeByRes = new Map<string, string>()
  // Id de l'événement calendrier RETOUR par réservation — pour ouvrir directement
  // son tiroir d'assignation (/calendrier?event=<id>) quand la carte retour affiche
  // « À assigner ». (Les départs mènent désormais à la fiche réservation.)
  const retourEventByRes = new Map<string, string>()
  if (weekResIds.length) {
    const { data: resEvents } = await supabase
      .from('calendar_events')
      .select('id, reservation_id, event_type, assignee:profiles!assigned_to(full_name), team:calendar_teams!assigned_team_id(name)')
      .in('reservation_id', weekResIds)
      .in('event_type', ['depart_vehicule', 'retour_vehicule'])
    for (const ev of resEvents ?? []) {
      if (!ev.reservation_id) continue
      if (ev.event_type === 'retour_vehicule') retourEventByRes.set(ev.reservation_id, ev.id)
      const assignee = Array.isArray(ev.assignee) ? ev.assignee[0] : ev.assignee
      const team     = Array.isArray(ev.team) ? ev.team[0] : ev.team
      const label    = assignee?.full_name ?? team?.name ?? null
      if (!label) continue
      if (ev.event_type === 'depart_vehicule') departAssigneeByRes.set(ev.reservation_id, label)
      else if (ev.event_type === 'retour_vehicule') retourAssigneeByRes.set(ev.reservation_id, label)
    }
  }

  // ── Interventions (table `tasks` legacy) sur 7 jours ────────────────────────
  // Une tâche créée depuis le calendrier (/calendar/tasks/new) n'existe QUE dans
  // `tasks` — aucun miroir dans calendar_events. Pour qu'elle apparaisse partout
  // sur le dashboard (« Tâches du jour », « Prochaines 6h » ET « Semaine »), comme
  // un événement calendrier, on la charge sur toute la fenêtre semaine. La borne
  // basse prend le plus tôt entre minuit civil et le début de journée métier pour
  // ne jamais masquer une tâche déjà visible avant, tout en captant les tâches de
  // nuit (0h→3h) que le calendrier range dans la journée métier.
  const tasksLowerBound = businessDayStart < todayStart ? businessDayStart : todayStart
  const { data: weekTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, type, status, due_datetime, reservation_id,
      vehicles ( plate ),
      profiles!tasks_assigned_to_fkey ( full_name )
    `)
    .gte('due_datetime', tasksLowerBound.toISOString())
    .lte('due_datetime', in7Days.toISOString())
    .neq('status', 'annule')
    .order('due_datetime', { ascending: true })
  // « Tâches du jour » = journée métier courante (7h→3h, comme le calendrier)
  // OU jour civil (rétro-compatibilité, ne masque rien de ce qui s'affichait).
  const todayTasks = (weekTasks ?? []).filter(t => {
    const d = new Date(t.due_datetime)
    return (d >= businessDayStart && d <= businessDayEnd) || (d >= todayStart && d <= todayEnd)
  })

  // ── Tâches calendrier du jour (lavage, CT, assurance, révision, infraction,
  // sinistre, contrat à signer, RDV client/garage, livraison/récupération...) ──
  // Source distincte de la table `tasks` legacy ci-dessus : tout calendar_event
  // "à faire" aujourd'hui, attribué ou non — qu'il vienne de syncWashTask,
  // syncAlertsToCalendar, ou créé manuellement sur le calendrier. Une tâche
  // disparaît d'ici une fois marquée terminée, pas avant. source_key préfixé
  // "task-" = simple reflet d'une ligne déjà comptée par todayTasks ci-dessus
  // — exclu pour ne pas l'afficher deux fois.
  // Fenêtre élargie à 7 jours (au lieu d'aujourd'hui seul) pour alimenter aussi
  // la section Semaine ci-dessous (qui veut voir, par jour, qui fait quoi).
  const { data: rawCalendarTasks } = await supabase
    .from('calendar_events')
    .select('id, title, status, start_at, end_at, event_type, vehicle_ids, source_key, assigned_to, assigned_team_id, assignee:profiles!assigned_to(full_name), team:calendar_teams!assigned_team_id(name, color)')
    .in('event_type', ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation'])
    .gte('start_at', businessDayStart.toISOString())
    .lte('start_at', in7Days.toISOString())
    .in('status', ['a_faire', 'en_cours'])
    .order('start_at', { ascending: true })
  const weekCalendarTasks = (rawCalendarTasks ?? []).filter(t => !t.source_key?.startsWith('task-'))
  const todayCalendarTasks = weekCalendarTasks.filter(t =>
    new Date(t.start_at) >= businessDayStart && new Date(t.start_at) <= businessDayEnd
  )
  const vehicleById = new Map((vehicles ?? []).map(v => [v.id, v]))

  function assigneeLabel(t: typeof weekCalendarTasks[number]) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const team = Array.isArray(t.team) ? t.team[0] : t.team
    return assignee?.full_name ?? team?.name ?? null
  }

  // ── Événements de la semaine, listés jour par jour ────────────────────────
  // Chaque événement des 7 prochains jours est explicitement listé sous le
  // mini-calendrier : départs (ou « à préparer »), retours et tâches/RDV du
  // calendrier — avec heure, type, intitulé, véhicule et qui s'en charge.
  type WeekEvent = {
    key: string
    time: Date
    kind: keyof typeof NEXT6H_TYPE_STYLE
    title: string
    subtitle?: string
    assignee: string | null
    needsAssignee: boolean
    href: string
  }
  const weekEvents: WeekEvent[] = []
  for (const r of reservations ?? []) {
    const v = getVehicle(r); const c = getClient(r)
    const clientName = c ? `${c.first_name} ${c.last_name}` : 'Client'
    const vehLabel   = v ? `${v.brand} ${v.model} · ${v.plate}` : undefined
    if (isDepart(r.status)) {
      const a = departAssigneeByRes.get(r.id) ?? null
      weekEvents.push({
        key: `wdep-${r.id}`, time: new Date(r.start_datetime),
        kind: isToPrepare(r.id) ? 'apreparer' : 'depart',
        title: clientName, subtitle: vehLabel,
        assignee: a, needsAssignee: !a, href: `/reservations/${r.id}?from=accueil`,
      })
    }
    if (r.status === 'en_cours' || r.status === 'en_retard') {
      const a = retourAssigneeByRes.get(r.id) ?? null
      weekEvents.push({
        key: `wret-${r.id}`, time: new Date(r.end_datetime), kind: 'retour',
        title: clientName, subtitle: vehLabel,
        assignee: a, needsAssignee: !a, href: `/reservations/${r.id}?from=accueil`,
      })
    }
  }
  for (const t of weekCalendarTasks) {
    const kind = (['tache', 'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation']
      .includes(t.event_type ?? '') ? t.event_type : 'tache') as WeekEvent['kind']
    const taskVehicles = (t.vehicle_ids ?? []).map((id: string) => vehicleById.get(id)).filter(Boolean)
    const subtitle = taskVehicles.length
      ? taskVehicles.map((tv: any) => `${tv.brand} ${tv.model}`).join(', ')
      : undefined
    const assignee = assigneeLabel(t)
    weekEvents.push({
      key: `wcal-${t.id}`, time: new Date(t.start_at), kind,
      title: t.title, subtitle,
      assignee, needsAssignee: !assignee, href: `/calendrier?event=${t.id}`,
    })
  }
  // Tâches legacy (table `tasks`) — créées depuis le calendrier, sans miroir
  // dans calendar_events : on les liste aussi jour par jour.
  for (const task of weekTasks ?? []) {
    const tv       = Array.isArray((task as any).vehicles) ? (task as any).vehicles[0] : (task as any).vehicles
    const assignee = Array.isArray((task as any).profiles) ? (task as any).profiles[0] : (task as any).profiles
    weekEvents.push({
      key: `wtask-${task.id}`, time: new Date(task.due_datetime), kind: 'tache',
      title: task.title, subtitle: tv ? (tv as any).plate : undefined,
      assignee: assignee ? (assignee as any).full_name : null,
      needsAssignee: !assignee, href: taskActionHref(task),
    })
  }
  const weekEventsByDay = Array.from({ length: 7 }, (_, i) => addDays(todayStart, i))
    .map(day => ({
      day,
      items: weekEvents
        .filter(e => isSameDay(e.time, day))
        .sort((a, b) => a.time.getTime() - b.time.getTime()),
    }))
    .filter(({ items }) => items.length > 0)

  // ── Alertes ───────────────────────────────────────────────────────────────
  const alerts = await fetchAllAlerts(supabase)

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ═══ 1. STATS FLOTTE ════════════════════════════════════════════════ */}
      {showFleet && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">FLOTTE</h2>
            <Link href="/vehicles" className="text-[11px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
              TOUT VOIR <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* PARC TOTAL — noir */}
          <Link href="/vehicles" className="block active:scale-[.99] transition-transform">
            <div className="bg-[#111111] rounded-3xl p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                    PARC TOTAL
                  </p>
                  <p className="font-black text-white leading-none" style={{ fontSize: 32 }}>
                    {total}
                  </p>
                  <p className="text-xs text-gray-500 mt-1.5">
                    véhicule{total > 1 ? 's' : ''} actif{total > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right pb-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    OCCUPATION
                  </p>
                  <p className="text-xl font-black text-white">{tauxOccupation}%</p>
                  <div className="w-16 h-1 bg-gray-700 rounded-full mt-2 ml-auto">
                    <div className="h-full bg-white/60 rounded-full"
                      style={{ width: `${tauxOccupation}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* DISPONIBLES + EN LOCATION */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/vehicles?status=disponibles" className="active:scale-[.99] transition-transform">
              <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">DISPONIBLES</span>
                <p className="font-black text-gray-900 leading-none" style={{ fontSize: 28 }}>{disponibles}</p>
              </div>
            </Link>

            <Link href="/vehicles?status=en_location" className="active:scale-[.99] transition-transform">
              <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">EN LOCATION</span>
                <p className="font-black text-gray-900 leading-none" style={{ fontSize: 28 }}>{enLocation}</p>
              </div>
            </Link>
          </div>

          {/* IMMOBILISÉS */}
          <Link href="/vehicles/immobilises" className="block active:scale-[.99] transition-transform">
            <div className={`rounded-3xl px-5 py-4 flex items-center justify-between border shadow-sm ${
              immobilises > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'
            }`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">IMMOBILISÉS</p>
                <p className="text-xs text-gray-400 mt-0.5">entretien · réparation · sinistre · CT · fourrière · véhicule non restitué · déplacement professionnel</p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-2xl font-black ${immobilises > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
                  {immobilises > 0 ? immobilises : '0'}
                </p>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          </Link>
        </section>
      )}

      {(enLocationNow.length + misesADispo.length) > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
              En location · {enLocationNow.length + misesADispo.length}
            </h2>
            <Link href="/reservations?status=en_cours" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
              TOUT VOIR <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {/* Mises à disposition inter-agences : véhicule loué CHEZ un partenaire.
                Affichées en tête (réellement dehors), badge « Loué · chez partenaire ». */}
            {misesADispo.map(op => {
              const v = getVehicle(op)
              const c = getClient(op)
              const agency = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
              const end = op.end_date_expected ? new Date(op.end_date_expected) : null
              const daysLeft = end ? differenceInDays(startOfDay(end), todayStart) : null
              const isLate = daysLeft != null && daysLeft < 0
              const isReturnToday = daysLeft === 0
              return (
                <Link key={`dispo-${op.id}`} href={`/partnerships/${op.id}`}>
                  <div className={`bg-white rounded-2xl p-4 border shadow-sm ${isLate ? 'border-orange-200 bg-orange-50/40' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-base font-black text-gray-900">{v?.brand} {v?.model}</span>
                          <span className="text-xs text-gray-400">{v?.plate}</span>
                          <span className="text-[9px] font-black uppercase tracking-wide text-white bg-green-600 px-2 py-0.5 rounded-full">
                            Loué
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-wide text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                            Chez partenaire
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {agency?.name ?? 'Partenaire'}
                          {c?.first_name && <span className="text-gray-400"> · {c.first_name} {c.last_name}</span>}
                        </p>
                        {end && (
                          <p className={`text-xs mt-1 ${isLate ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
                            Retour prévu : {format(end, 'dd MMM', { locale: fr })}
                          </p>
                        )}
                      </div>
                      {end && (
                        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                          isLate          ? 'bg-red-500'
                          : isReturnToday ? 'bg-orange-500'
                          : (daysLeft ?? 9) <= 2 ? 'bg-orange-100'
                          : 'bg-gray-100'
                        }`}>
                          <span className={`text-2xl font-black leading-none ${
                            isLate || isReturnToday ? 'text-white' : (daysLeft ?? 9) <= 2 ? 'text-orange-600' : 'text-gray-700'
                          }`}>
                            {isLate ? `+${Math.abs(daysLeft!)}` : daysLeft}
                          </span>
                          <span className={`text-[10px] font-bold mt-0.5 ${
                            isLate          ? 'text-red-100'
                            : isReturnToday ? 'text-orange-100'
                            : (daysLeft ?? 9) <= 2 ? 'text-orange-500'
                            : 'text-gray-400'
                          }`}>
                            {isLate ? 'j retard' : isReturnToday ? 'auj.' : 'jours'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}

            {enLocationNow.map(r => {
              const v           = getVehicle(r)
              const c           = getClient(r)
              const start       = new Date(r.start_datetime)
              const end         = new Date(r.end_datetime)
              // États possibles dans « En location » (un badge par ligne) :
              const isDeparted  = r.status === 'en_cours' || r.status === 'en_retard' // LOUÉ (sorti)
              const isLate      = r.status === 'en_retard'                 // retour dépassé
              const pickupDue   = r.status === 'confirmee' && start <= now  // départ dépassé, pas récupéré
              const isReserved  = !isDeparted && !pickupDue                 // RÉSERVÉ (départ à venir : option / confirmée)

              const daysLeft    = differenceInDays(startOfDay(end), todayStart)   // avant retour
              const isReturnToday = isDeparted && daysLeft === 0 && !isLate
              const daysToStart = differenceInDays(startOfDay(start), todayStart)  // avant départ
              const daysLatePickup = differenceInDays(todayStart, startOfDay(start))

              const nextBooking = v?.id ? nextBookingByVehicle.get(v.id) : undefined
              const hasNextBooking = isDeparted && nextBooking && nextBooking.start_datetime > r.end_datetime

              // Cadre + pastille de coin selon l'état
              const cardClass = isLate || pickupDue ? 'border-orange-200 bg-orange-50/40' : 'border-gray-100'

              return (
                <Link key={r.id} href={`/reservations/${r.id}?from=accueil`}>
                  <div className={`bg-white rounded-2xl p-4 border shadow-sm ${cardClass}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-base font-black text-gray-900">{v?.brand} {v?.model}</span>
                          <span className="text-xs text-gray-400">{v?.plate}</span>
                          {isDeparted && (
                            <span className="text-[9px] font-black uppercase tracking-wide text-white bg-green-600 px-2 py-0.5 rounded-full">
                              Loué
                            </span>
                          )}
                          {pickupDue && (
                            <span className="text-[9px] font-black uppercase tracking-wide text-white bg-orange-600 px-2 py-0.5 rounded-full">
                              Départ en retard
                            </span>
                          )}
                          {isReserved && (
                            <span className="text-[9px] font-black uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                              Réservé
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{c?.first_name} {c?.last_name}</p>
                        {isDeparted ? (
                          <p className="text-xs text-gray-400 mt-1">
                            Retour : {format(end, 'dd MMM à HH:mm', { locale: fr })}
                          </p>
                        ) : pickupDue ? (
                          <p className="text-xs text-orange-600 font-semibold mt-1">
                            Départ prévu {format(start, 'dd MMM à HH:mm', { locale: fr })} · client pas encore venu
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Départ {format(start, 'dd MMM à HH:mm', { locale: fr })} · Retour {format(end, 'dd MMM à HH:mm', { locale: fr })}
                          </p>
                        )}
                      </div>

                      {/* Countdown 64×64 */}
                      {isDeparted ? (
                        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                          isLate          ? 'bg-red-500'
                          : isReturnToday ? 'bg-orange-500'
                          : daysLeft <= 2 ? 'bg-orange-100'
                          : 'bg-gray-100'
                        }`}>
                          <span className={`text-2xl font-black leading-none ${
                            isLate || isReturnToday ? 'text-white' : daysLeft <= 2 ? 'text-orange-600' : 'text-gray-700'
                          }`}>
                            {isLate ? `+${Math.abs(daysLeft)}` : daysLeft}
                          </span>
                          <span className={`text-[10px] font-bold mt-0.5 ${
                            isLate          ? 'text-red-100'
                            : isReturnToday ? 'text-orange-100'
                            : daysLeft <= 2 ? 'text-orange-500'
                            : 'text-gray-400'
                          }`}>
                            {isLate ? 'j retard' : isReturnToday ? 'auj.' : 'jours'}
                          </span>
                        </div>
                      ) : pickupDue ? (
                        <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 bg-orange-500">
                          <span className="text-2xl font-black leading-none text-white">
                            {daysLatePickup >= 1 ? `+${daysLatePickup}` : '!'}
                          </span>
                          <span className="text-[10px] font-bold mt-0.5 text-orange-100">
                            {daysLatePickup >= 1 ? 'j retard' : 'départ'}
                          </span>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 bg-blue-50 border border-blue-100">
                          <span className="text-2xl font-black leading-none text-blue-700">
                            {daysToStart === 0 ? 'auj.' : daysToStart}
                          </span>
                          <span className="text-[10px] font-bold mt-0.5 text-blue-400">
                            {daysToStart === 0 ? 'départ' : 'j départ'}
                          </span>
                        </div>
                      )}
                    </div>

                    {hasNextBooking && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-blue-600 flex-shrink-0">
                            Puis réservé
                          </span>
                          <span className="text-xs text-gray-500 truncate">
                            {getClient(nextBooking)?.first_name} {getClient(nextBooking)?.last_name}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Prochain départ {format(new Date(nextBooking.start_datetime), 'd MMM à HH:mm', { locale: fr })}
                          {' · '}
                          Prochain retour {format(new Date(nextBooking.end_datetime), 'd MMM à HH:mm', { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
      <section>
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900 whitespace-nowrap">
              Tâches du jour
            </h2>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link href="/calendrier" className="flex items-center gap-1 text-[11px] text-gray-400 font-medium hover:text-gray-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> CRÉER
              </Link>
              <Link href="/calendrier" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                CALENDRIER <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          {(retoursEnRetard.length > 0 || recuperationsEnRetard.length > 0 || aPreparerAujourdhui.length > 0) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {retoursEnRetard.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-red-600 px-2.5 py-1 rounded-full animate-pulse whitespace-nowrap">
                  <AlertTriangle className="w-3 h-3" />
                  {retoursEnRetard.length} retour{retoursEnRetard.length > 1 ? 's' : ''} en retard
                </span>
              )}
              {recuperationsEnRetard.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-orange-600 px-2.5 py-1 rounded-full whitespace-nowrap">
                  <AlertTriangle className="w-3 h-3" />
                  {recuperationsEnRetard.length} récupération{recuperationsEnRetard.length > 1 ? 's' : ''} en retard
                </span>
              )}
              {aPreparerAujourdhui.length > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {aPreparerAujourdhui.length} à préparer
                </span>
              )}
            </div>
          )}
        </div>

        {retoursEnRetard.length === 0 && recuperationsEnRetard.length === 0 && departsAujourdhui.length === 0 && retoursAujourdhui.length === 0 && (todayTasks?.length ?? 0) === 0 && todayCalendarTasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucune mission aujourd'hui</p>
            <Link href="/calendrier" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-black underline underline-offset-2">
              <Plus className="w-3.5 h-3.5" /> Créer une tâche
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {/* ⚠️ Retours EN RETARD — tout en haut, rouge vif, voyant bien visible */}
            {retoursEnRetard.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const daysLate = daysLateOf(r)
              // « À assigner » → tiroir de l'événement retour, sinon création
              // pré-remplie d'une tâche de préparation retour à affecter.
              const retourAssignee = retourAssigneeByRes.get(r.id) ?? null
              const retourEventId  = retourEventByRes.get(r.id)
              const lateHref = retourAssignee
                ? `/reservations/${r.id}?from=accueil`
                : retourEventId
                  ? `/calendrier?event=${retourEventId}`
                  : assignCreateHref(`Préparer retour — ${v ? `${v.brand} ${v.model}` : ''}`.trim(), r.end_datetime, v?.id, c?.id)
              return (
                <Link key={`late-${r.id}`} href={lateHref}>
                  <div className="flex items-center gap-4 px-4 py-4 bg-red-50 hover:bg-red-100 border-l-4 border-red-600 transition-colors">
                    <span className="w-12 flex flex-col items-center flex-shrink-0 leading-tight">
                      <span className="text-[10px] font-bold text-red-500 capitalize">
                        {format(new Date(r.end_datetime), 'd MMM', { locale: fr })}
                      </span>
                      <span className="text-sm font-black text-red-700 font-mono">
                        {format(new Date(r.end_datetime), 'HH:mm')}
                      </span>
                    </span>
                    <span className="inline-flex items-center justify-center gap-1 min-w-[92px] text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 bg-red-600 text-white">
                      <AlertTriangle className="w-3 h-3" /> {daysLate} j
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-red-600">
                        Retour en retard de {daysLate} jour{daysLate > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c?.first_name} {c?.last_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v?.brand} {v?.model} <span className="text-gray-400 font-mono">· {v?.plate}</span>
                      </p>
                      <AssigneeLine name={retourAssigneeByRes.get(r.id) ?? null} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-300 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {/* 🚗 RÉCUPÉRATIONS EN RETARD — départ passé un jour précédent, client pas venu */}
            {recuperationsEnRetard.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const hLate = hoursLateOf(r)
              const lateLabel = hLate >= 48 ? `${Math.floor(hLate / 24)} j` : `${hLate} h`
              return (
                <Link key={`recup-${r.id}`} href={`/reservations/${r.id}?from=accueil`}>
                  <div className="flex items-center gap-4 px-4 py-4 bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-600 transition-colors">
                    <span className="w-12 flex flex-col items-center flex-shrink-0 leading-tight">
                      <span className="text-[10px] font-bold text-orange-500 capitalize">
                        {format(new Date(r.start_datetime), 'd MMM', { locale: fr })}
                      </span>
                      <span className="text-sm font-black text-orange-700 font-mono">
                        {format(new Date(r.start_datetime), 'HH:mm')}
                      </span>
                    </span>
                    <span className="inline-flex items-center justify-center gap-1 min-w-[92px] text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 bg-orange-600 text-white">
                      <AlertTriangle className="w-3 h-3" /> {lateLabel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-orange-600">
                        Récupération en retard de {lateLabel}
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c?.first_name} {c?.last_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v?.brand} {v?.model} <span className="text-gray-400 font-mono">· {v?.plate}</span>
                      </p>
                      {isToPrepare(r.id) && (
                        <p className="text-[10px] font-bold text-amber-600 mt-1">
                          Contrat à signer au départ
                        </p>
                      )}
                      <AssigneeLine name={departAssigneeByRes.get(r.id) ?? null} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-orange-300 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {/* Départs */}
            {departsAujourdhui.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const isQuickTurnaround = v?.id && quickTurnaroundVehicleIds.has(v.id)
              // Le clic mène TOUJOURS à la fiche réservation : c'est là qu'on lance
              // le départ + l'état des lieux (demande gérant). Auparavant, une résa
              // « à assigner » ouvrait le calendrier → on n'arrivait jamais au départ.
              // L'assignation reste possible depuis la fiche et depuis le calendrier.
              const departHref = `/reservations/${r.id}?from=accueil`
              return (
                <Link key={r.id} href={departHref}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    isQuickTurnaround ? 'bg-orange-100 hover:bg-orange-200/70 border-l-4 border-orange-500' : 'hover:bg-gray-50'
                  }`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.start_datetime), 'HH:mm')}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[92px] ${
                      isQuickTurnaround ? 'bg-orange-500 text-white' : isToPrepare(r.id) ? 'bg-amber-500 text-white' : 'bg-black text-white'
                    }`}>
                      {isToPrepare(r.id) ? 'À PRÉPARER' : 'DÉPART'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c?.first_name} {c?.last_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v?.brand} {v?.model} <span className="text-gray-300 font-mono">· {v?.plate}</span>
                      </p>
                      <AssigneeLine name={departAssigneeByRes.get(r.id) ?? null} />
                      {new Date(r.start_datetime) < now && (
                        <p className="text-[10px] font-bold text-orange-600 mt-1">
                          Client pas encore venu · à récupérer
                        </p>
                      )}
                      {isQuickTurnaround && (
                        <p className="text-[10px] font-bold text-orange-600 flex items-center gap-1 mt-1">
                          <ArrowLeftRight className="w-3 h-3" /> Retour du même véhicule aujourd'hui
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {/* Retours */}
            {retoursAujourdhui.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const isLate = r.status === 'en_retard'
              const isQuickTurnaround = v?.id && quickTurnaroundVehicleIds.has(v.id)
              // « À assigner » → tiroir de l'événement retour, sinon création
              // pré-remplie d'une tâche de préparation retour à affecter.
              const retourAssignee = retourAssigneeByRes.get(r.id) ?? null
              const retourEventId  = retourEventByRes.get(r.id)
              const retourHref = retourAssignee
                ? `/reservations/${r.id}?from=accueil`
                : retourEventId
                  ? `/calendrier?event=${retourEventId}`
                  : assignCreateHref(`Préparer retour — ${v ? `${v.brand} ${v.model}` : ''}`.trim(), r.end_datetime, v?.id, c?.id)
              return (
                <Link key={r.id} href={retourHref}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    isLate ? 'bg-red-50/60 hover:bg-red-50'
                    : isQuickTurnaround ? 'bg-orange-100 hover:bg-orange-200/70 border-l-4 border-orange-500'
                    : 'hover:bg-gray-50'
                  }`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.end_datetime), 'HH:mm')}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[92px] ${
                      isLate ? 'bg-red-600 text-white' : isQuickTurnaround ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isLate ? 'RETOUR EN RETARD' : 'RETOUR'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c?.first_name} {c?.last_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v?.brand} {v?.model} <span className="text-gray-300 font-mono">· {v?.plate}</span>
                      </p>
                      <AssigneeLine name={retourAssigneeByRes.get(r.id) ?? null} />
                      {isQuickTurnaround && (
                        <p className="text-[10px] font-bold text-orange-600 flex items-center gap-1 mt-1">
                          <ArrowLeftRight className="w-3 h-3" /> Redépart du même véhicule aujourd'hui
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {/* Interventions / tâches assignées du jour */}
            {(todayTasks ?? []).map(task => {
              const tv       = Array.isArray((task as any).vehicles) ? (task as any).vehicles[0] : (task as any).vehicles
              const assignee = Array.isArray((task as any).profiles) ? (task as any).profiles[0] : (task as any).profiles
              const isTaskLate = task.status === 'a_faire' && new Date(task.due_datetime) < now
              return (
                <Link key={`task-${task.id}`} href={taskActionHref(task)}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${isTaskLate ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}`}>
                    <span className="w-12 text-sm font-mono font-bold text-gray-600 text-center flex-shrink-0">
                      {format(new Date(task.due_datetime), 'HH:mm')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[92px] bg-gray-100 text-gray-600">
                      {TASK_TYPE_LABELS[task.type ?? 'autre']}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {tv && <span className="text-[10px] text-gray-400">{(tv as any).plate}</span>}
                        {assignee
                          ? <span className="text-[10px] text-gray-400">{tv ? '· ' : ''}{(assignee as any).full_name}</span>
                          : <span className="text-[10px] font-semibold text-amber-600">{tv ? '· ' : ''}À assigner</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${
                      isTaskLate ? 'bg-red-600 text-white' : TASK_STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {isTaskLate ? 'TÂCHE EN RETARD' : TASK_STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  </div>
                </Link>
              )
            })}

            {/* Tâches calendrier (lavage, CT, assurance, révision, infraction, sinistre, contrat à signer...) */}
            {todayCalendarTasks.map(t => {
              const taskVehicles = (t.vehicle_ids ?? [])
                .map((id: string) => vehicleById.get(id))
                .filter(Boolean)
              const vehicleLabel = taskVehicles
                .map((tv: any) => `${tv.brand} ${tv.model}`)
                .join(', ')
              const plates = taskVehicles.map((tv: any) => tv.plate).join(', ')
              const assignee = assigneeLabel(t)
              return (
                <Link key={`caltask-${t.id}`} href={`/calendrier?event=${t.id}`}>
                  <div className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50">
                    <span className="w-12 text-sm font-mono font-bold text-gray-600 text-center flex-shrink-0">
                      {format(new Date(t.start_at), 'HH:mm')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[92px] bg-gray-100 text-gray-600">
                      TÂCHE
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {vehicleLabel && (
                          <span className="text-xs text-gray-400">
                            {vehicleLabel} <span className="text-gray-300 font-mono">· {plates}</span>
                          </span>
                        )}
                        {assignee
                          ? <span className="text-[10px] text-gray-400">{vehicleLabel ? '· ' : ''}{assignee}</span>
                          : <span className="text-[10px] font-semibold text-amber-600">{vehicleLabel ? '· ' : ''}Non attribué</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${
                      t.status === 'en_cours' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t.status === 'en_cours' ? 'En cours' : 'À faire'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ 2a. ALERTES — résumé compact + lien vers la page complète ══════ */}
      {/* B — alertes toujours visibles */}
      {(()=>{
        if (alerts.length === 0) return (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">Alertes</h2>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-sm text-gray-400 font-medium">Aucune alerte active</p>
            </div>
          </section>
        )
        return (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">Alertes</h2>
              <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            </div>
            <Link href="/alerts" className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:bg-gray-50 transition-colors active:scale-[.99] transition-transform">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {ALERT_GROUPS.map(group => {
                  const count = alerts.filter(a => a.type === group.type).length
                  if (count === 0) return null
                  const GroupIcon = group.icon
                  return (
                    <span key={group.type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${group.cardBg} ${group.labelColor}`}>
                      <GroupIcon className={`w-3 h-3 ${group.iconColor}`} />
                      {group.label} · {count}
                    </span>
                  )
                })}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Voir toutes les alertes</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          </section>
        )
      })()}


      {/* ═══ 5. SEMAINE ════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">Semaine</h2>
          <Link href="/calendrier" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
            TOUT VOIR <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => addDays(todayStart, i)).map((day, i) => {
              const isToday     = i === 0
              const isTomorrow  = i === 1
              const dayDeparts  = reservations?.filter(r =>
                isSameDay(new Date(r.start_datetime), day) && isDepart(r.status)
              ) ?? []
              const dayReturns  = reservations?.filter(r =>
                isSameDay(new Date(r.end_datetime), day) &&
                (r.status === 'en_cours' || r.status === 'en_retard')
              ) ?? []
              const dayToPrepare = dayDeparts.filter(r => isToPrepare(r.id))
              const dayItems     = weekEvents.filter(e => isSameDay(e.time, day))
              const dayRdv       = dayItems.filter(e => e.kind === 'rdv_client' || e.kind === 'rdv_garage')
              const dayInterventions = dayItems.filter(e =>
                e.kind === 'tache' || e.kind === 'livraison' || e.kind === 'recuperation'
              )

              return (
                <div key={day.toISOString()} className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase text-gray-400 capitalize">
                    {format(day, 'EEE', { locale: fr })}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isToday ? 'bg-black text-white' : 'text-gray-900'
                  }`}>
                    <span className="text-xs font-black">{format(day, 'd')}</span>
                  </div>
                  {isTomorrow && !isToday && (
                    <span className="text-[8px] text-gray-300 font-medium -mt-0.5">demain</span>
                  )}
                  <div className="flex flex-col items-center gap-0.5 min-h-[12px]">
                    {dayDeparts.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-black" />{dayDeparts.length}
                      </span>
                    )}
                    {dayReturns.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-blue-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{dayReturns.length}
                      </span>
                    )}
                    {dayToPrepare.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{dayToPrepare.length}
                      </span>
                    )}
                    {dayRdv.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-pink-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />{dayRdv.length}
                      </span>
                    )}
                    {dayInterventions.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-purple-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />{dayInterventions.length}
                      </span>
                    )}
                    {dayDeparts.length === 0 && dayReturns.length === 0 &&
                     dayRdv.length === 0 && dayInterventions.length === 0 && (
                      <span className="text-[8px] text-gray-200">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Légende */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black" />
              <span className="text-[10px] text-gray-400">Départ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[10px] text-gray-400">Retour</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] text-gray-400">À préparer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
              <span className="text-[10px] text-gray-400">RDV</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[10px] text-gray-400">Intervention</span>
            </div>
          </div>

          {/* Détail de la semaine — chaque événement des 7 prochains jours,
              listé jour par jour : départs (ou « à préparer »), retours et
              tâches/RDV du calendrier, avec heure, type, intitulé et assigné. */}
          {weekEventsByDay.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-50 space-y-3">
              {weekEventsByDay.map(({ day, items }) => (
                <div key={day.toISOString()}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    {isSameDay(day, todayStart) ? "Aujourd'hui" : format(day, 'EEEE d MMM', { locale: fr })}
                  </p>
                  <div className="space-y-1">
                    {items.map(e => {
                      const st = NEXT6H_TYPE_STYLE[e.kind] ?? NEXT6H_TYPE_STYLE.tache
                      return (
                        <Link key={e.key} href={e.href} className="flex items-center gap-2 py-1">
                          <span className="w-10 text-[11px] font-mono font-bold text-gray-500 flex-shrink-0">
                            {format(e.time, 'HH:mm')}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[84px] ${st.badge}`}>
                            {st.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-800 font-semibold block truncate">{e.title}</span>
                            {e.subtitle && (
                              <span className="text-[10px] text-gray-400 block truncate">{e.subtitle}</span>
                            )}
                          </div>
                          {e.assignee
                            ? <span className="text-[10px] text-gray-400 flex-shrink-0 max-w-[64px] truncate">{e.assignee}</span>
                            : e.needsAssignee
                              ? <span className="text-[10px] font-semibold text-amber-600 flex-shrink-0">À assigner</span>
                              : null}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* État vide global */}
      {enLocationNow.length === 0 && misesADispo.length === 0 && alerts.length === 0 && retoursEnRetard.length === 0 &&
       departsAujourdhui.length === 0 && retoursAujourdhui.length === 0 &&
       (todayTasks?.length ?? 0) === 0 && todayCalendarTasks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-semibold text-gray-400">Tout est calme aujourd'hui</p>
        </div>
      )}

    </div>
  )
}
