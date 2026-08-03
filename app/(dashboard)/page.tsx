import { createClient } from '@/lib/supabase/server'
import { fetchAllAlerts, seuilRetardMinutes, TYPES_EVENEMENT_QUI_ALERTENT } from '@/lib/utils/alerts'
import { fetchActiveInternalTrips } from '@/lib/vehicles/internalTrips'
import Link from 'next/link'
import {
  differenceInDays, format, isSameDay,
  startOfDay, endOfDay, addDays, subDays,
} from 'date-fns'
import { getColumnWindow, businessNow } from '@/lib/calendar/dateUtils'
import { bornesDuJourAgence } from '@/lib/format/heureAgence'
import { taskActionHref } from '@/lib/utils'
import { CALENDAR_START_HOUR } from '@/lib/calendar/constants'
import { fr } from 'date-fns/locale'
import DashboardCalendar from '@/components/dashboard/DashboardCalendar'
import DelaiPastille from '@/components/ui/DelaiPastille'
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
  { type: 'recuperation_retard', label: 'Départ en retard', icon: AlertTriangle, href: '/reservations',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  // Les deux alertes qui anticipent la journée (ajout 27/07). En bleu, jamais en
  // rouge ni orange : rien n'est en retard, il s'agit d'organiser la journée. Dès
  // l'heure dépassée, la même réservation ressort en « Départ en retard » ou
  // « Retour en retard » au-dessus.
  { type: 'depart_imminent', label: 'Départ du jour', icon: Clock, href: '/reservations',
    cardBg: 'bg-blue-50',   cardBorder: 'border-blue-100',   labelColor: 'text-blue-700',   iconColor: 'text-blue-500',   badgeBg: 'bg-blue-500',   badgeText: 'text-white' },
  { type: 'retour_jour',     label: 'Retour du jour', icon: Clock, href: '/reservations',
    cardBg: 'bg-blue-50',   cardBorder: 'border-blue-100',   labelColor: 'text-blue-700',   iconColor: 'text-blue-500',   badgeBg: 'bg-blue-500',   badgeText: 'text-white' },
  { type: 'ct',       label: 'Contrôle technique',     icon: AlertTriangle, href: '/vehicles',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'assurance',label: 'Assurance',              icon: AlertTriangle, href: '/vehicles',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'revision', label: 'Révision / Entretien',   icon: Wrench,        href: '/vehicles',
    cardBg: 'bg-amber-50',  cardBorder: 'border-amber-100',  labelColor: 'text-amber-700',  iconColor: 'text-amber-500',  badgeBg: 'bg-amber-400',  badgeText: 'text-white' },
  { type: 'lavage',   label: 'Lavage avant location',  icon: Wrench,        href: '/suivi',
    cardBg: 'bg-cyan-50',   cardBorder: 'border-cyan-100',   labelColor: 'text-cyan-700',   iconColor: 'text-cyan-500',   badgeBg: 'bg-cyan-500',   badgeText: 'text-white' },
  { type: 'tache',      label: 'Tâche en retard',        icon: Clock,         href: '/calendrier',
    cardBg: 'bg-gray-50',   cardBorder: 'border-gray-200',   labelColor: 'text-gray-600',   iconColor: 'text-gray-400',   badgeBg: 'bg-gray-400',   badgeText: 'text-white' },
  // Les interventions ouvertes, entrées dans les alertes le 02/08/2026 : une
  // critique ou une échéance dépassée doit se voir depuis l'accueil.
  { type: 'intervention', label: 'Intervention à traiter', icon: Wrench,      href: '/suivi',
    cardBg: 'bg-purple-50', cardBorder: 'border-purple-100', labelColor: 'text-purple-700', iconColor: 'text-purple-500', badgeBg: 'bg-purple-500', badgeText: 'text-white' },
  { type: 'infraction', label: 'Infraction non réglée',  icon: AlertTriangle, href: '/suivi?tab=infractions',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'sinistre',   label: 'Sinistre en cours',      icon: AlertTriangle, href: '/suivi?tab=sinistres',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'document',   label: 'Document expiré',        icon: FileText,      href: '/documents',
    cardBg: 'bg-amber-50',  cardBorder: 'border-amber-100',  labelColor: 'text-amber-700',  iconColor: 'text-amber-500',  badgeBg: 'bg-amber-400',  badgeText: 'text-white' },
]

// Étiquette des ÉVÉNEMENTS calendrier repris dans « Tâches du jour ». À ne pas
// confondre avec TASK_TYPE_LABELS juste en dessous, qui nomme les lignes de la
// table `tasks` (l'ancien mécanisme). Les libellés reprennent ceux du calendrier
// du tableau de bord, pour qu'une même ligne ne change pas de nom d'un bloc à
// l'autre.
const CALENDAR_TYPE_LABELS: Record<string, string> = {
  tache: 'Tâche',
  rdv_client: 'RDV',
  rdv_garage: 'RDV garage',
  rdv_autre: 'RDV',
  livraison: 'Livraison',
  recuperation: 'Récupération',
  deplacement_interne: 'Déplacement',
}

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

/**
 * Ligne « BMW Série 1 Blanche · GE-226-EZ » : le véhicule et sa couleur d'abord,
 * la plaque ensuite, en gris (remarque 20 de Jeff, 30/07/2026 — sur le terrain on
 * reconnaît une voiture à sa couleur bien avant de lire sa plaque).
 *
 * La couleur est un champ libre de la fiche du véhicule : elle manque souvent, et
 * la ligne doit tenir sans elle. Le ton de la plaque change d'une liste à l'autre
 * (plus pâle sur fond blanc), d'où le réglage.
 */
function LigneVehicule({
  v,
  tonPlaque = 'text-gray-400',
}: {
  v?: { brand?: string | null; model?: string | null; color?: string | null; plate?: string | null } | null
  tonPlaque?: string
}) {
  if (!v) return null
  const nom = [v.brand, v.model, v.color].filter(Boolean).join(' ')
  return (
    <>
      {nom}
      {/* Espace insécable entre le point et la plaque : sur téléphone la ligne
          se coupe AVANT le point, et « · GP-977-KZ » descend d'un bloc au lieu
          de laisser un point tout seul en bout de ligne. */}
      {v.plate && <span className={`${tonPlaque} font-mono`}> ·&nbsp;{v.plate}</span>}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Une réservation « à partir » (départ) = confirmée OU en option (juste créée)
const isDepart = (s: string) => s === 'confirmee' || s === 'option'

function assigneeLabel(t: {
  assignee?: { full_name: string | null } | { full_name: string | null }[] | null
  team?: { name: string | null } | { name: string | null }[] | null
}) {
  const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
  const team = Array.isArray(t.team) ? t.team[0] : t.team
  return assignee?.full_name ?? team?.name ?? null
}

export default async function DashboardPage() {
  const supabase   = await createClient()
  // Heure de l'agence (BUSINESS_TZ), pas l'heure serveur UTC : sinon, selon
  // l'heure de consultation, un départ du jour bascule à tort dans "à venir".
  const now        = businessNow()
  // Minuit à minuit, à l'heure française et non à celle du serveur. C'est la
  // frontière du tableau de bord depuis le 30/07/2026 : ce qui est daté
  // d'aujourd'hui est une mission du jour, ce qui est avant est une alerte.
  // Vercel tourne en temps universel : `startOfDay(new Date())` y changeait de
  // journée à 22h l'été, deux heures avant le gérant.
  const { debut: todayStart, fin: todayEnd } = bornesDuJourAgence(now)
  const in7Days    = addDays(now, 7)
  // ⚠️ `now` ci-dessus est l'heure MURALE française posée dans le fuseau du
  // serveur : parfait pour découper des journées, faux pour répondre à « cette
  // heure est-elle passée ? ». Sur Vercel, qui tourne en temps universel, il est
  // en avance de deux heures l'été sur l'instant réel. Une tâche aurait donc été
  // déclarée dépassée deux heures avant que lib/utils/alerts.ts, qui compare au
  // vrai instant, ne la reprenne en alerte : deux heures pendant lesquelles elle
  // n'aurait été visible nulle part. Tout ce qui décide d'un retard passe donc
  // par cet instant-ci (02/08/2026).
  const maintenantReel = new Date()

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
  const [{ data: vehiclesRaw }, { data: externalRows }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate, brand, model, color, status, insurance_expiry, ct_date, next_service_date, next_service_km, current_km')
      .eq('is_active', true),
    // Exclut les véhicules partenaires temporaires (inter-agences) des KPI flotte.
    // Requête séparée et tolérante : avant la migration 035 (colonne is_external
    // absente) elle renvoie une erreur silencieuse → aucun exclu, jamais de crash.
    supabase.from('vehicles').select('id').eq('is_external', true),
  ])
  const externalIds = new Set((externalRows ?? []).map(v => v.id))
  const vehicles = (vehiclesRaw ?? []).filter(v => !externalIds.has(v.id))

  // Véhicules ENGAGÉS maintenant : une réservation a déjà démarré (heure de départ
  // <= maintenant) sans être clôturée. Ils sont sortis OU à récupérer, donc PAS
  // disponibles — même quand leur statut est resté « reserve » faute d'EDL de départ
  // (le passage à « loué » se fait à l'état des lieux). Sans ça, un véhicule parti
  // restait compté « disponible » (bug « tout loué mais N disponibles », 24/07).
  //
  // « option » EXCLU (décision gérant 27/07) : une option n'est qu'un pré-blocage
  // valable le temps de l'acompte. Passé l'heure de départ sans que le client soit
  // venu, le véhicule est toujours au parking et redevient louable. Le compter
  // « en location » gonflait le taux d'occupation et faisait dire au compteur du
  // haut (7) l'inverse de la liste juste en dessous (6). Une CONFIRMÉE, elle, reste
  // engagée : l'avance est versée, le client est parti ou passe la chercher.
  // La réservation non honorée reste signalée dans « Tâches du jour »
  // (recuperationsEnRetard) et par l'alerte « contrat à signer ». Elle ne disparaît
  // pas de l'écran, elle change seulement de compteur.
  const { data: startedRes } = await supabase
    .from('reservations')
    .select('vehicle_id')
    .in('status', ['confirmee', 'en_cours', 'en_retard'])
    .lte('start_datetime', now.toISOString())
  const engagedVehicleIds = new Set((startedRes ?? []).map(r => r.vehicle_id as string))

  // Véhicules pris par un DÉPLACEMENT INTERNE en ce moment (en cours, ou planifié
  // dont le créneau court) : pas louables, et pas « en location » non plus — ils
  // rejoignent les immobilisés. Le statut du véhicule n'est pas modifié.
  const activeTrips = await fetchActiveInternalTrips(supabase, now.toISOString())
  const tripVehicleIds = new Set(activeTrips.keys())

  const total          = vehicles?.length ?? 0
  // « Disponible » = louable tout de suite : garé (statut disponible) OU réservé
  // dont le départ est ENCORE À VENIR. Dès que l'heure de départ est passée, le
  // véhicule est engagé → il bascule en « En location » (cf. engagedVehicleIds).
  const disponibles    = vehicles?.filter(v => ['disponible', 'reserve'].includes(v.status) && !engagedVehicleIds.has(v.id) && !tripVehicleIds.has(v.id)).length ?? 0
  // « En location » = réellement engagé : loué / mis à disposition, OU réservé dont
  // le départ est déjà passé (client parti ou à récupérer). C'est le taux d'occupation.
  const enLocation     = vehicles?.filter(v => ['loue', 'mis_a_disposition'].includes(v.status) || (['disponible', 'reserve'].includes(v.status) && engagedVehicleIds.has(v.id))).length ?? 0
  // « mis_a_disposition » exclu : chez partenaire ≠ immobilisé (aligné avec la
  // page Flotte, où il a sa propre pastille « Chez partenaire »). Un déplacement
  // interne en cours compte ici : le véhicule n'est ni louable ni en location.
  const immobilises    = vehicles?.filter(v =>
    ['maintenance', 'hors_service', 'en_verification', 'immobilise', 'a_reparer',
     'fourriere', 'non_restitue', 'deplacement_pro'].includes(v.status)
    || (tripVehicleIds.has(v.id) && !['loue', 'mis_a_disposition'].includes(v.status))
  ).length ?? 0
  const tauxOccupation = total > 0 ? Math.round((enLocation / total) * 100) : 0

  // ── Réservations ──────────────────────────────────────────────────────────
  const { data: reservations } = await supabase
    .from('reservations')
    .select(`
      id, status, start_datetime, end_datetime, total_price,
      vehicles ( id, plate, brand, model, color ),
      clients  ( id, first_name, last_name, phone )
    `)
    .in('status', ['option', 'confirmee', 'en_cours', 'en_retard'])
    .lte('start_datetime', in7Days.toISOString())
    .order('start_datetime', { ascending: true })

  // ── Le critère qui départage TOUTES les listes de cet écran ─────────────────
  // Une CONFIRMÉE dont l'heure de départ est passée = véhicule sorti : l'avance est
  // versée, le client est parti (ou passe la chercher), même si l'état des lieux de
  // départ n'a pas été validé. Décision gérant du 27/07 : elle vit dans
  // « En location », avec le badge « Départ en retard », et NULLE PART AILLEURS :
  // ni dans les départs du jour, ni dans les récupérations en retard. Sinon la même
  // voiture s'affiche deux fois sur le même écran.
  // Une OPTION n'est PAS concernée : ce n'est qu'un pré-blocage le temps de
  // l'acompte. Passé l'heure sans que le client vienne, elle reste une tâche à
  // traiter et le véhicule redevient louable (cf. startedRes plus haut).
  const isSortiSansEdl = (r: { status: string; start_datetime: string }) =>
    r.status === 'confirmee' && new Date(r.start_datetime) <= now

  const departsAujourdhui = reservations?.filter(r =>
    isDepart(r.status) &&
    !isSortiSansEdl(r) &&            // partie → elle est dans « En location »
    new Date(r.start_datetime) >= businessDayStart &&
    new Date(r.start_datetime) <= businessDayEnd
    // Restent ici : les départs encore à venir dans la journée, et les options du
    // jour même dont l'heure est passée (le véhicule est toujours au parking).
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

  // Les RÉCUPÉRATIONS EN RETARD (option dont l'heure de départ est passée, client
  // jamais venu) ne sont plus listées ici depuis le 30/07/2026 : « Tâches du
  // jour » ne parle que d'aujourd'hui, décision de Jeff. Elles remontent en
  // alerte « Départ en retard » (lib/utils/alerts.ts, section 11, qui accepte
  // les options depuis cette même date). Cette bascule a été faite dans le même
  // mouvement, sans quoi elles ne seraient plus nulle part — le ticket du
  // gérant du 21/07/2026 (« Aucune mission » alors qu'un départ traînait).
  // Même véhicule avec un départ ET un retour aujourd'hui (rotation rapide) —
  // à signaler clairement : peu de marge pour laver/préparer entre les deux.
  const departVehicleIds = new Set(departsAujourdhui.map(r => getVehicle(r)?.id).filter(Boolean))
  const retourVehicleIds = new Set(retoursAujourdhui.map(r => getVehicle(r)?.id).filter(Boolean))
  const quickTurnaroundVehicleIds = new Set(
    [...departVehicleIds].filter(id => retourVehicleIds.has(id))
  )

  // ── « En location » : une seule liste, un badge par ligne ───────────────────
  // Demande gérant : ne PAS scinder en deux sections. Une seule section « En
  // location », et c'est le BADGE de chaque ligne qui distingue « Loué » (sorti :
  // en_cours / en_retard) de « Départ en retard » (confirmée dont l'heure de départ
  // est passée, client pas venu).
  //
  // ⚠️ Cette liste et le compteur « EN LOCATION » du haut doivent porter sur le MÊME
  // ensemble : c'est leur divergence qui affichait 7 en haut et 6 juste en dessous.
  // Règle commune : est « en location » ce qui est sorti, ou ce qui est engagé par une
  // CONFIRMÉE au départ dépassé. Une option ne compte jamais (pré-blocage, cf.
  // startedRes). Toucher l'un sans l'autre recrée l'écart.
  //
  // Requête SANS plafond de date (le tri et le filtre font le reste) : options,
  // confirmées (à venir OU départ dépassé), en_cours, en_retard.
  const { data: locationRaw } = await supabase
    .from('reservations')
    .select(`
      id, status, start_datetime, end_datetime,
      vehicles ( id, plate, brand, model, color ),
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
  // « En location » = les véhicules SORTIS (en_cours / en_retard) PLUS les
  // confirmées au départ dépassé sans état des lieux (badge « Départ en retard »,
  // cf. pickupDue plus bas). Décision gérant du 27/07 : ce dernier cas était compté
  // par le compteur du haut sans apparaître ici, d'où « EN LOCATION 7 » au-dessus de
  // « En location · 6 ». Il a été retiré des « Tâches du jour » en échange, donc
  // aucune voiture n'est affichée deux fois.
  //
  // ⚠️ Ce filtre et le compteur du haut (startedRes + enLocation) doivent rester
  // d'accord. Toucher l'un sans l'autre recrée l'écart. Une confirmée dont le départ
  // est ENCORE À VENIR reste dehors, elle vit dans « Tâches du jour ». Une option
  // n'est jamais ici.
  const enLocationNow = (locationRaw ?? [])
    .filter(r => r.status === 'en_cours' || r.status === 'en_retard' || isSortiSansEdl(r))
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
        vehicles ( id, plate, brand, model, color ),
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
  // Id de l'événement calendrier DÉPART / RETOUR par réservation — pour ouvrir
  // directement son tiroir d'assignation (/calendrier?event=<id>) quand la carte
  // affiche « À assigner ». Depuis le tiroir, on peut attribuer PUIS ouvrir la
  // réservation (« Ouvrir la réservation » / « Faire l'EDL de départ »).
  const departEventByRes = new Map<string, string>()
  const retourEventByRes = new Map<string, string>()
  if (weekResIds.length) {
    const { data: resEvents } = await supabase
      .from('calendar_events')
      .select('id, reservation_id, event_type, assignee:profiles!assigned_to(full_name), team:calendar_teams!assigned_team_id(name)')
      .in('reservation_id', weekResIds)
      .in('event_type', ['depart_vehicule', 'retour_vehicule'])
    for (const ev of resEvents ?? []) {
      if (!ev.reservation_id) continue
      if (ev.event_type === 'depart_vehicule') departEventByRes.set(ev.reservation_id, ev.id)
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
      vehicles ( plate, brand, model, color ),
      profiles!tasks_assigned_to_fkey ( full_name )
    `)
    .gte('due_datetime', tasksLowerBound.toISOString())
    .lte('due_datetime', in7Days.toISOString())
    .neq('status', 'annule')
    .order('due_datetime', { ascending: true })
  // « Tâches du jour » = journée métier courante (7h→3h, comme le calendrier)
  // OU jour civil (rétro-compatibilité, ne masque rien de ce qui s'affichait).
  //
  // RÈGLE ARRÊTÉE PAR LE GÉRANT LE 02/08/2026, elle remplace celle du 30/07
  // (« à minuit une, ça bascule ») : les deux blocs de l'accueil doivent être
  // complémentaires, jamais redondants. Une tâche encore À FAIRE dont l'heure
  // est passée quitte donc cette liste À LA MINUTE et réapparaît juste en
  // dessous, dans « Alertes ». Elle ne se perd pas, elle descend d'un cran.
  //
  // Une tâche EN COURS reste ici, l'heure passée ou non : quelqu'un s'en occupe
  // en ce moment, et lib/utils/alerts.ts ne ramasse que les `a_faire`. Les deux
  // fichiers doivent rester d'accord, sinon une tâche s'affiche deux fois ou
  // disparaît des deux écrans.
  // Une tâche terminée disparaît, elle n'est plus « à faire ».
  const todayTasks = (weekTasks ?? []).filter(t => {
    const d = new Date(t.due_datetime)
    if (d < todayStart || d > todayEnd) return false
    if (t.status === 'termine') return false
    return !(t.status === 'a_faire' && d < maintenantReel)
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
    .select('id, title, description, status, start_at, end_at, event_type, vehicle_ids, source_key, assigned_to, assigned_team_id, assignee:profiles!assigned_to(full_name), team:calendar_teams!assigned_team_id(name, color)')
    // « deplacement_interne » ajouté le 02/08/2026 : un déplacement planifié pour
    // aujourd'hui n'apparaissait nulle part sur l'accueil, alors qu'il occupe une
    // voiture et quelqu'un de l'équipe (constaté par Jeff). Les départs et retours
    // de location restent hors de cette liste : ils ont déjà leurs deux sections
    // dédiées plus haut, les ajouter ici les afficherait deux fois.
    .in('event_type', ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation', 'deplacement_interne'])
    // Borne basse : la plus ancienne des deux fenêtres, pour ne rien perdre de
    // ce que la journée métier du calendrier capte avant minuit.
    .gte('start_at', (businessDayStart < todayStart ? businessDayStart : todayStart).toISOString())
    .lte('start_at', in7Days.toISOString())
    // Une tâche terminée quitte la liste : chaque type se clôture par son propre
    // parcours (état des lieux, retour de déplacement, intervention menée à son
    // terme). Décision de Jeff du 02/08/2026, après essai d'une case à cocher :
    // elle n'apportait rien et encombrait la ligne.
    .in('status', ['a_faire', 'en_cours'])
    .order('start_at', { ascending: true })
  const weekCalendarTasks = (rawCalendarTasks ?? []).filter(t => !t.source_key?.startsWith('task-'))
  // Même règle que pour les tâches ci-dessus (gérant, 02/08/2026) : ce qui est
  // devenu une alerte quitte cette liste. Le miroir exact de la section « 4 bis »
  // de lib/utils/alerts.ts — mêmes types, même condition sur la clé d'origine,
  // même frontière sur l'heure de FIN. Tout ce qui n'y entre pas reste ici : un
  // déplacement interne (il se clôt par son retour), une copie d'alerte déjà
  // comptée ailleurs, un rendez-vous encore à venir.
  const todayCalendarTasks = weekCalendarTasks.filter(t => {
    const debut = new Date(t.start_at)
    if (debut < todayStart || debut > todayEnd) return false
    const devientUneAlerte =
      TYPES_EVENEMENT_QUI_ALERTENT.includes(t.event_type as any)
      && !t.source_key
      && new Date(t.end_at ?? t.start_at) < maintenantReel
    return !devientUneAlerte
  })
  const vehicleById = new Map((vehicles ?? []).map(v => [v.id, v]))

  // La liste « Semaine » (jour par jour) est désormais rendue par le widget
  // client interactif <DashboardCalendar /> (bande de dates défilante + détail
  // du jour), qui s'alimente lui-même via GET /api/calendar/events.

  // ── Alertes ───────────────────────────────────────────────────────────────
  const alerts = await fetchAllAlerts(supabase)
  // Ce qui a quitté « Tâches du jour » parce que l'heure est passée : sert à
  // renvoyer vers les alertes quand la liste du jour se retrouve vide.
  const tachesEnRetard = alerts.filter(a => a.type === 'tache').length

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

          {/* PARC TOTAL, noir */}
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
              return (
                <Link key={`dispo-${op.id}`} href={`/partnerships/${op.id}`}>
                  <div className={`bg-white rounded-2xl p-4 border shadow-sm ${isLate ? 'border-orange-200 bg-orange-50/40' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-base font-black text-gray-900">{[v?.brand, v?.model, v?.color].filter(Boolean).join(' ')}</span>
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
                      {end && <DelaiPastille jours={daysLeft!} echeance={end} />}
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
                          <span className="text-base font-black text-gray-900">{[v?.brand, v?.model, v?.color].filter(Boolean).join(' ')}</span>
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

                      {/* Délai : avant retour, retard de départ, ou avant départ.
                          Les deux derniers comptent un départ, d'où la famille
                          « depart » qui les garde en bleu : la couleur dit ce
                          qu'on décompte, sinon un départ et un retour dans le
                          même nombre de jours donnent la même pastille.
                          `daysLatePickup` compte des jours de retard : il passe en
                          négatif pour que la pastille l'écrive « +N jours ». */}
                      {isDeparted ? (
                        <DelaiPastille jours={daysLeft} echeance={end} enRetard={isLate} />
                      ) : pickupDue ? (
                        <DelaiPastille jours={-daysLatePickup} echeance={start} enRetard famille="depart" />
                      ) : (
                        <DelaiPastille jours={daysToStart} echeance={start} famille="depart" />
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
          {/* « Tâches du jour » ne parle QUE d'aujourd'hui, règle de Jeff du
              30/07/2026. Ce qui date d'un jour passé (retour non rendu, client
              jamais venu chercher) a quitté cette liste : c'est un état qui
              dure, pas une mission du jour, et il vit maintenant dans les
              alertes, juste en dessous. Les deux pastilles de comptage sont
              parties avec, elles annonçaient ces lignes-là. */}
          {(aPreparerAujourdhui.length > 0 || tachesEnRetard > 0) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {aPreparerAujourdhui.length > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {aPreparerAujourdhui.length} à préparer
                </span>
              )}
              {/* Où est passé un rendez-vous dont l'heure est dépassée. Le
                  renvoi n'existait que sur une liste VIDE : un rendez-vous créé
                  après coup (planifié à 8h, saisi à 23h) devenait une alerte à
                  la seconde et semblait s'être évaporé (Jeff, remarque 5 du
                  03/08/2026). */}
              {tachesEnRetard > 0 && (
                <Link
                  href="/alerts"
                  className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full whitespace-nowrap hover:bg-red-100 transition-colors"
                >
                  {tachesEnRetard} passée{tachesEnRetard > 1 ? 's' : ''} en alerte, heure dépassée
                </Link>
              )}
            </div>
          )}
        </div>

        {departsAujourdhui.length === 0 && retoursAujourdhui.length === 0 && (todayTasks?.length ?? 0) === 0 && todayCalendarTasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            {/* Depuis le 02/08/2026, une tâche dépassée quitte cette liste pour
                les alertes. Sans ce renvoi, l'écran annoncerait « aucune mission »
                alors qu'il reste du travail en retard trois blocs plus bas :
                exactement le contresens que la complémentarité doit éviter. */}
            {tachesEnRetard > 0 ? (
              <>
                <Clock className="w-10 h-10 text-red-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">
                  Plus rien de prévu aujourd'hui, mais {tachesEnRetard} tâche{tachesEnRetard > 1 ? 's' : ''} en retard
                </p>
                <Link href="/alerts" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 underline underline-offset-2">
                  Voir les alertes
                </Link>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">Aucune mission aujourd'hui</p>
                <Link href="/calendrier" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-black underline underline-offset-2">
                  <Plus className="w-3.5 h-3.5" /> Créer une tâche
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {/* Départs */}
            {departsAujourdhui.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const isQuickTurnaround = v?.id && quickTurnaroundVehicleIds.has(v.id)
              // « À assigner » → tiroir de l'événement départ sur le calendrier, pour
              // l'attribuer à un membre ; depuis ce tiroir on ouvre ensuite la
              // réservation (« Ouvrir la réservation » / « Faire l'EDL de départ »).
              // Déjà assigné → directement la fiche réservation (départ + EDL).
              const departAssignee = departAssigneeByRes.get(r.id) ?? null
              const departEventId  = departEventByRes.get(r.id)
              const departHref = departAssignee || !departEventId
                ? `/reservations/${r.id}?from=accueil`
                : `/calendrier?event=${departEventId}`
              return (
                <Link key={r.id} href={departHref}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    isQuickTurnaround ? 'bg-orange-100 hover:bg-orange-200/70 border-l-4 border-orange-500' : 'hover:bg-gray-50'
                  }`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.start_datetime), 'HH:mm')}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center w-[92px] sm:w-[108px] ${
                      isQuickTurnaround ? 'bg-orange-500 text-white' : isToPrepare(r.id) ? 'bg-amber-500 text-white' : 'bg-black text-white'
                    }`}>
                      {isToPrepare(r.id) ? 'À PRÉPARER' : 'DÉPART'}
                    </span>
                    {/* La voiture d'abord, le client ensuite : la pastille de
                        gauche dit déjà s'il s'agit d'un départ ou d'un retour. */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 sm:truncate">
                        <LigneVehicule v={v} />
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {c?.first_name} {c?.last_name}
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
                  : assignCreateHref(`Préparer retour · ${v ? `${v.brand} ${v.model}` : ''}`.trim(), r.end_datetime, v?.id, c?.id)
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
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center w-[92px] sm:w-[108px] ${
                      isLate ? 'bg-red-600 text-white' : isQuickTurnaround ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isLate ? 'RETOUR EN RETARD' : 'RETOUR'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 sm:truncate">
                        <LigneVehicule v={v} />
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {c?.first_name} {c?.last_name}
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
              // Ne reste ici en retard qu'une tâche EN COURS : celles encore
              // « à faire » et dépassées sont passées dans les alertes.
              const isTaskLate = new Date(task.due_datetime) < maintenantReel
              return (
                <Link key={`task-${task.id}`} href={taskActionHref(task)}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${isTaskLate ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}`}>
                    <span className="w-12 text-sm font-mono font-bold text-gray-600 text-center flex-shrink-0">
                      {format(new Date(task.due_datetime), 'HH:mm')}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center w-[92px] sm:w-[108px] bg-gray-100 text-gray-600">
                      {TASK_TYPE_LABELS[task.type ?? 'autre']}
                    </span>
                    {/* Trois lignes, le même gabarit que les départs, les retours
                        et les tâches du calendrier : la voiture, ce qu'il y a à
                        faire, puis qui s'en charge. Le véhicule et la personne
                        tenaient sur une seule ligne à rallonge (« George Alex
                        Romeo · À assigner »), qui se repliait au hasard de la
                        longueur du texte : d'une ligne à l'autre, « À assigner »
                        ne tombait jamais au même endroit (Jeff, remarque 45). */}
                    <div className="flex-1 min-w-0">
                      {tv
                        ? <p className="text-sm font-bold text-gray-900 sm:truncate"><LigneVehicule v={tv as any} /></p>
                        : <p className="text-sm font-bold text-gray-900 sm:truncate">{task.title}</p>}
                      {tv && <p className="text-xs text-gray-500 sm:truncate">{task.title}</p>}
                      <AssigneeLine name={(assignee as any)?.full_name ?? null} />
                      {/* Sur téléphone l'état passe ici, faute de place à droite —
                          même règle que les lignes du calendrier juste en dessous. */}
                      {isTaskLate && (
                        <p className="sm:hidden text-[10px] font-black uppercase text-red-600 mt-1">En retard</p>
                      )}
                    </div>
                    {/* Largeur FIXE, et chevron comme les lignes voisines : sans
                        eux, « À faire » et « Tâche en retard » n'avaient pas la
                        même largeur, et cette famille de lignes s'arrêtait 20 px
                        avant les autres (Jeff, 02/08/2026). */}
                    <span className={`hidden sm:inline-flex items-center justify-center text-[10px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 w-[112px] ${
                      isTaskLate ? 'bg-red-600 text-white' : TASK_STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      <span className="truncate">{isTaskLate ? 'En retard' : TASK_STATUS_LABEL[task.status] ?? task.status}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {/* Tâches calendrier (lavage, CT, assurance, révision, infraction, sinistre, contrat à signer...) */}
            {todayCalendarTasks.map(t => {
              // Trois lignes, dans cet ordre — format arrêté par Jeff le
              // 30/07/2026, le même que la vue semaine et que les cartes du
              // haut : la voiture et sa plaque, ce qu'il y a à faire, puis la
              // personne. Le titre de la tâche porte déjà son montant quand il
              // y en a un (« Échéance proche · 30,00 € »), écrit à la synchro
              // des alertes ; il ne se recompose pas ici.
              const taskVehicles = (t.vehicle_ids ?? [])
                .map((id: string) => vehicleById.get(id))
                .filter(Boolean)
              const assignee = assigneeLabel(t)
              // La personne concernée : le client d'une échéance (rangé en
              // description à la synchro), sinon celui qui a la tâche en charge.
              const personne = (t as any).description || assignee
              // En retard = l'heure de FIN est passée. Pas le début : un lavage
              // prévu de 9h à 10h n'est pas en retard à 9h05.
              const enRetard = new Date(t.end_at ?? t.start_at) < maintenantReel
              // La fin n'est affichée que si elle tombe le même jour et après le
              // début : sinon la colonne annoncerait « 19:18 / 00:00 » sans dire
              // que c'est le lendemain.
              const finLisible = t.end_at && new Date(t.end_at) > new Date(t.start_at)
                && format(new Date(t.end_at), 'yyyy-MM-dd') === format(new Date(t.start_at), 'yyyy-MM-dd')
              return (
                <Link key={`caltask-${t.id}`} href={`/calendrier?event=${t.id}`}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50`}>
                    {/* Début au-dessus, fin en dessous : « de quelle heure à
                        quelle heure » était introuvable sur l'accueil (Jeff,
                        02/08/2026). */}
                    <span className="w-12 flex-shrink-0 text-center">
                      <span className="block text-sm font-mono font-bold text-gray-600">
                        {format(new Date(t.start_at), 'HH:mm')}
                      </span>
                      {finLisible && (
                        <span className="block text-[11px] font-mono text-gray-400">
                          {format(new Date(t.end_at), 'HH:mm')}
                        </span>
                      )}
                    </span>
                    {/* L'étiquette suit le type de l'événement. Elle disait
                        « TÂCHE » pour tout, y compris pour un déplacement qui
                        sort une voiture avec quelqu'un (Jeff, 02/08/2026). */}
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-1.5 rounded-full flex-shrink-0 inline-flex items-center justify-center w-[92px] sm:w-[108px] ${
                      t.event_type === 'deplacement_interne' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {CALENDAR_TYPE_LABELS[t.event_type] ?? 'Tâche'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {taskVehicles.length > 0 && (
                        <p className="text-sm font-bold text-gray-900 sm:truncate">
                          {taskVehicles.map((tv: any, i: number) => (
                            <span key={tv.id ?? i}>
                              {i > 0 && ', '}
                              <LigneVehicule v={tv} tonPlaque="text-gray-400" />
                            </span>
                          ))}
                        </p>
                      )}
                      <p className={`sm:truncate ${taskVehicles.length > 0 ? 'text-xs text-gray-500' : 'text-sm font-bold text-gray-900'}`}>
                        {t.title}
                      </p>
                      {/* La même troisième ligne que partout ailleurs sur cet
                          écran : icône, puis le nom ou « À assigner » en ambre.
                          Elle disait « Non attribué » sans icône, et ne tombait
                          donc pas à la même hauteur que les lignes voisines
                          (Jeff, remarque 45). */}
                      <AssigneeLine name={personne || null} />
                      {/* Sur téléphone l'état passe ici, faute de place à droite. */}
                      {enRetard && (
                        <p className="sm:hidden text-[10px] font-black uppercase text-red-600 mt-1">En retard</p>
                      )}
                    </div>
                    {/* L'heure est passée mais la tâche est toujours à faire :
                        elle reste dans la liste (Jeff, 30/07/2026) et le dit en
                        rouge, pour ne pas se confondre avec celles à l'heure. */}
                    {/* Largeur FIXE, la même que la famille de lignes du dessus :
                        « En retard » est plus large qu'« À faire », et le
                        chevron reculait d'une ligne à l'autre (Jeff, 02/08/2026). */}
                    <span className={`hidden sm:inline-flex items-center justify-center text-[10px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 w-[112px] ${
                      enRetard ? 'bg-red-600 text-white'
                      : t.status === 'en_cours' ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                      <span className="truncate">{enRetard ? 'En retard' : t.status === 'en_cours' ? 'En cours' : 'À faire'}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ 2a. ALERTES, résumé compact + lien vers la page complète ══════ */}
      {/* B, alertes toujours visibles */}
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

        <DashboardCalendar />
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
