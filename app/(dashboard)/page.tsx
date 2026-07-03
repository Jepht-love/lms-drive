import { createClient } from '@/lib/supabase/server'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import Link from 'next/link'
import {
  differenceInDays, format, isSameDay,
  startOfDay, endOfDay, addDays, subDays, addHours,
} from 'date-fns'
import { getColumnWindow } from '@/lib/calendar/dateUtils'
import { CALENDAR_START_HOUR } from '@/lib/calendar/constants'
import { fr } from 'date-fns/locale'
import {
  ChevronRight, AlertTriangle, CheckCircle2, Plus,
  Wrench, Clock, FileText, ArrowLeftRight, Users, Car, type LucideIcon,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVehicle(r: any) { return Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles }
function getClient(r: any)  { return Array.isArray(r.clients)  ? r.clients[0]  : r.clients  }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
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
  { type: 'sinistre',   label: 'Sinistre en cours',      icon: AlertTriangle, href: '/incidents/accidents',
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

// Couleurs du demi-calendrier (par type d'événement calendrier) — alignées sur
// la palette du calendrier complet (lib/calendar/constants EVENT_COLORS).
const CAL_EVENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  tache:        { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' },
  rdv_client:   { bg: '#fdf2f8', border: '#ec4899', text: '#be185d' },
  rdv_garage:   { bg: '#ecfeff', border: '#06b6d4', text: '#0e7490' },
  livraison:    { bg: '#f7fee7', border: '#84cc16', text: '#4d7c0f' },
  recuperation: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
}
function calEventColor(type?: string | null) {
  return CAL_EVENT_COLORS[type ?? 'tache'] ?? CAL_EVENT_COLORS.tache
}

// Demi-calendrier : largeur d'une heure (px) sur la piste horaire glissante.
const NEXT6H_HOUR_W = 88

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase   = await createClient()
  const now        = new Date()
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
  const showFleet = isManager || canViewFleet !== false

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
  const disponibles    = vehicles?.filter(v => v.status === 'disponible').length ?? 0
  const enLocation     = vehicles?.filter(v => ['loue', 'reserve'].includes(v.status)).length ?? 0
  const immobilises    = vehicles?.filter(v =>
    ['maintenance', 'hors_service', 'en_verification', 'immobilise', 'mis_a_disposition', 'a_reparer'].includes(v.status)
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

  // Même véhicule avec un départ ET un retour aujourd'hui (rotation rapide) —
  // à signaler clairement : peu de marge pour laver/préparer entre les deux.
  const departVehicleIds = new Set(departsAujourdhui.map(r => getVehicle(r)?.id).filter(Boolean))
  const retourVehicleIds = new Set(retoursAujourdhui.map(r => getVehicle(r)?.id).filter(Boolean))
  const quickTurnaroundVehicleIds = new Set(
    [...departVehicleIds].filter(id => retourVehicleIds.has(id))
  )

  const enLocationNow = (reservations?.filter(r =>
    r.status === 'en_cours' || r.status === 'en_retard'
  ) ?? []).sort((a, b) => a.end_datetime.localeCompare(b.end_datetime))

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

  // Réservations à venir (à partir de demain, dans les 7 jours)
  const reservationsAVenir = (reservations ?? []).filter(r =>
    isDepart(r.status) && new Date(r.start_datetime) > businessDayEnd
  ).sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))

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

  // ── Interventions du jour (table tasks) ─────────────────────────────────────
  const { data: todayTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, type, status, due_datetime,
      vehicles ( plate ),
      profiles!tasks_assigned_to_fkey ( full_name )
    `)
    .gte('due_datetime', todayStart.toISOString())
    .lte('due_datetime', todayEnd.toISOString())
    .neq('status', 'annule')
    .order('due_datetime', { ascending: true })

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
    .in('event_type', ['tache', 'rdv_client', 'rdv_garage', 'livraison', 'recuperation'])
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

  // ── Demi-calendrier : fenêtre GLISSANTE des prochaines 6h, par équipe/salarié ─
  // Vue resserrée du calendrier (lib/calendar) : on prend les tâches/RDV
  // calendrier dont l'heure de début tombe dans les 6 prochaines heures, et on
  // les répartit en pistes horizontales — une par collaborateur ou équipe
  // assigné, plus une piste « À assigner » pour les événements non attribués.
  const next6hStart = now
  const next6hEnd   = addHours(now, 6)
  const next6hMs    = next6hEnd.getTime() - next6hStart.getTime()

  type Next6hLane = {
    key: string
    label: string
    kind: 'profile' | 'team' | 'unassigned'
    color: string
    items: typeof weekCalendarTasks
  }
  const next6hLaneMap = new Map<string, Next6hLane>()
  for (const t of weekCalendarTasks) {
    const s = new Date(t.start_at).getTime()
    if (s < next6hStart.getTime() || s > next6hEnd.getTime()) continue
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const team     = Array.isArray(t.team) ? t.team[0] : t.team
    let key: string, label: string, kind: Next6hLane['kind'], color: string
    if (t.assigned_to && assignee?.full_name) {
      key = `p:${t.assigned_to}`; label = assignee.full_name; kind = 'profile'; color = '#111111'
    } else if (t.assigned_team_id && team?.name) {
      key = `t:${t.assigned_team_id}`; label = team.name; kind = 'team'; color = team.color ?? '#6366f1'
    } else {
      key = 'unassigned'; label = 'À assigner'; kind = 'unassigned'; color = '#f59e0b'
    }
    if (!next6hLaneMap.has(key)) next6hLaneMap.set(key, { key, label, kind, color, items: [] })
    next6hLaneMap.get(key)!.items.push(t)
  }
  const next6hLanes = [...next6hLaneMap.values()].sort((a, b) => {
    if (a.kind === 'unassigned') return 1
    if (b.kind === 'unassigned') return -1
    return a.label.localeCompare(b.label)
  })
  // Repères horaires : chaque heure pleine comprise dans la fenêtre.
  const next6hTicks: Date[] = []
  {
    const firstTick = new Date(next6hStart)
    firstTick.setMinutes(0, 0, 0)
    if (firstTick <= next6hStart) firstTick.setHours(firstTick.getHours() + 1)
    for (let d = firstTick; d <= next6hEnd; d = addHours(d, 1)) next6hTicks.push(new Date(d))
  }
  const next6hTrackW = NEXT6H_HOUR_W * 6
  // Retours de réservations prévus dans les 6 prochaines heures
  const retoursProchaines6h = (reservations ?? [])
    .filter(r => r.status === 'en_cours' &&
      new Date(r.end_datetime) >= next6hStart &&
      new Date(r.end_datetime) <= next6hEnd)
    .sort((a, b) => new Date(a.end_datetime).getTime() - new Date(b.end_datetime).getTime())
  const next6hLeftPx = (iso: string) =>
    ((new Date(iso).getTime() - next6hStart.getTime()) / next6hMs) * next6hTrackW
  const next6hWidthPx = (t: typeof weekCalendarTasks[number]) => {
    const durMs = t.end_at ? new Date(t.end_at).getTime() - new Date(t.start_at).getTime() : 3_600_000
    const w = (Math.max(durMs, 1_800_000) / next6hMs) * next6hTrackW
    const left = next6hLeftPx(t.start_at)
    return Math.min(Math.max(w, 60), next6hTrackW - left)
  }

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
            <Link href="/vehicles?status=disponible" className="active:scale-[.99] transition-transform">
              <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">DISPONIBLES</span>
                <p className="font-black text-gray-900 leading-none" style={{ fontSize: 28 }}>{disponibles}</p>
              </div>
            </Link>

            <Link href="/vehicles?status=loue" className="active:scale-[.99] transition-transform">
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
                <p className="text-xs text-gray-400 mt-0.5">entretien · réparation · sinistre · CT</p>
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

      {/* ═══ 2. TÂCHES DU JOUR (départs + retours + interventions) ══════════ */}
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
          {(retoursEnRetard.length > 0 || aPreparerAujourdhui.length > 0) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {retoursEnRetard.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-red-600 px-2.5 py-1 rounded-full animate-pulse whitespace-nowrap">
                  <AlertTriangle className="w-3 h-3" />
                  {retoursEnRetard.length} retour{retoursEnRetard.length > 1 ? 's' : ''} en retard
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

        {retoursEnRetard.length === 0 && departsAujourdhui.length === 0 && retoursAujourdhui.length === 0 && (todayTasks?.length ?? 0) === 0 && todayCalendarTasks.length === 0 ? (
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
              return (
                <Link key={`late-${r.id}`} href={`/reservations/${r.id}`}>
                  <div className="flex items-center gap-4 px-4 py-4 bg-red-50 hover:bg-red-100 border-l-4 border-red-600 transition-colors">
                    <span className="w-12 flex flex-col items-center flex-shrink-0 leading-tight">
                      <span className="text-[10px] font-bold text-red-500 capitalize">
                        {format(new Date(r.end_datetime), 'd MMM', { locale: fr })}
                      </span>
                      <span className="text-sm font-black text-red-700 font-mono">
                        {format(new Date(r.end_datetime), 'HH:mm')}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 bg-red-600 text-white">
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
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-300 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {/* Départs */}
            {departsAujourdhui.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const isQuickTurnaround = v?.id && quickTurnaroundVehicleIds.has(v.id)
              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    isQuickTurnaround ? 'bg-orange-100 hover:bg-orange-200/70 border-l-4 border-orange-500' : 'hover:bg-gray-50'
                  }`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.start_datetime), 'HH:mm')}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 ${
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
              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    isLate ? 'bg-red-50/60 hover:bg-red-50'
                    : isQuickTurnaround ? 'bg-orange-100 hover:bg-orange-200/70 border-l-4 border-orange-500'
                    : 'hover:bg-gray-50'
                  }`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.end_datetime), 'HH:mm')}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 ${
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
                <Link key={`task-${task.id}`} href="/calendrier">
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${isTaskLate ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}`}>
                    <span className="w-12 text-sm font-mono font-bold text-gray-600 text-center flex-shrink-0">
                      {format(new Date(task.due_datetime), 'HH:mm')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-600">
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
                <Link key={`caltask-${t.id}`} href="/calendrier">
                  <div className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50">
                    <span className="w-12 text-sm font-mono font-bold text-gray-600 text-center flex-shrink-0">
                      {format(new Date(t.start_at), 'HH:mm')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-600">
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
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ 2a. DEMI-CALENDRIER — prochaines 6h, par équipe/salarié ════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
            Prochaines 6h
          </h2>
          <span className="text-[11px] text-gray-400 font-medium">
            {format(next6hStart, 'HH:mm')} – {format(next6hEnd, 'HH:mm')}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          {/* Retours de réservation dans les 6h */}
          {retoursProchaines6h.length > 0 && (
            <div className={`flex flex-col gap-1.5${next6hLanes.length > 0 ? ' mb-3' : ''}`}>
              {retoursProchaines6h.map(r => {
                const v = getVehicle(r); const c = getClient(r)
                const heure = format(new Date(r.end_datetime), 'HH:mm')
                return (
                  <Link key={r.id} href="/reservations"
                    className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                    <Car className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="flex-1 min-w-0 text-[11px] font-semibold text-blue-800 truncate">
                      {c ? `${c.first_name} ${c.last_name}` : '—'}
                      {v ? ` — ${v.brand} ${v.model} (${v.plate})` : ''}
                    </p>
                    <span className="text-[10px] font-mono font-bold text-blue-500 flex-shrink-0 ml-1">↩ {heure}</span>
                  </Link>
                )
              })}
            </div>
          )}
          {next6hLanes.length === 0 && retoursProchaines6h.length === 0 ? (
            <div className="flex items-center gap-2 py-4 px-1">
              <CheckCircle2 className="w-4 h-4 text-gray-200 flex-shrink-0" />
              <p className="text-xs text-gray-400 font-medium">Rien de prévu dans les 6 prochaines heures</p>
            </div>
          ) : next6hLanes.length > 0 ? (
            <div className="overflow-x-auto -mx-3 px-3" style={{ scrollbarWidth: 'thin' }}>
              <div style={{ minWidth: 92 + next6hTrackW }}>
                {/* Axe horaire */}
                <div className="flex">
                  <div className="w-[92px] flex-shrink-0" />
                  <div className="relative flex-shrink-0" style={{ width: next6hTrackW, height: 16 }}>
                    {next6hTicks.map(tick => (
                      <span key={tick.toISOString()}
                        className="absolute top-0 text-[9px] font-mono text-gray-400 -translate-x-1/2"
                        style={{ left: next6hLeftPx(tick.toISOString()) }}>
                        {format(tick, 'HH')}h
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pistes ressources */}
                <div className="divide-y divide-gray-50">
                  {next6hLanes.map(lane => (
                    <div key={lane.key} className="flex items-stretch">
                      {/* Étiquette ressource */}
                      <div className="w-[92px] flex-shrink-0 flex items-center gap-1.5 pr-2 py-1.5">
                        <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: lane.color }}>
                          {lane.kind === 'team'
                            ? <Users className="w-2.5 h-2.5 text-white" />
                            : <span className="text-[8px] font-bold text-white">{initials(lane.label)}</span>}
                        </span>
                        <span className="text-[10px] font-medium text-gray-600 truncate">{lane.label}</span>
                      </div>

                      {/* Piste horaire */}
                      <div className="relative flex-shrink-0 py-1.5" style={{ width: next6hTrackW, minHeight: 36 }}>
                        {/* Lignes d'heure */}
                        {next6hTicks.map(tick => (
                          <div key={tick.toISOString()}
                            className="absolute top-0 bottom-0 border-l border-gray-50"
                            style={{ left: next6hLeftPx(tick.toISOString()) }} />
                        ))}
                        {/* Repère "maintenant" */}
                        <div className="absolute top-0 bottom-0 border-l-2 border-red-400/60" style={{ left: 0 }} />
                        {/* Événements */}
                        {lane.items.map(t => {
                          const cfg = calEventColor(t.event_type)
                          const left = next6hLeftPx(t.start_at)
                          const width = next6hWidthPx(t)
                          return (
                            <Link key={t.id} href="/calendrier"
                              className="absolute top-1/2 -translate-y-1/2 rounded-lg px-1.5 py-1 overflow-hidden border-l-[3px] shadow-sm"
                              style={{ left, width, backgroundColor: cfg.bg, borderLeftColor: cfg.border }}>
                              <p className="text-[10px] font-bold leading-tight truncate" style={{ color: cfg.text }}>
                                {format(new Date(t.start_at), 'HH:mm')} {t.title}
                              </p>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ═══ 2b. RÉSERVATIONS À VENIR (prochains jours) ════════════════════ */}
      {reservationsAVenir.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
              Réservations à venir · {reservationsAVenir.length}
            </h2>
            <Link href="/reservations?status=confirmee" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
              TOUT VOIR <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {reservationsAVenir.map(r => {
              const v = getVehicle(r); const c = getClient(r)
              const start = new Date(r.start_datetime)
              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col items-center w-12 flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase text-gray-400 capitalize">
                        {format(start, 'EEE', { locale: fr })}
                      </span>
                      <span className="text-sm font-black text-gray-900">{format(start, 'd')}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{format(start, 'HH:mm')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{c?.first_name} {c?.last_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{v?.brand} {v?.model} <span className="text-gray-300 font-mono">· {v?.plate}</span></p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ 3. VÉHICULES EN LOCATION avec countdown 64×64 ════════════════ */}
      {enLocationNow.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
              En location · {enLocationNow.length}
            </h2>
            <Link href="/reservations?status=en_cours" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
              TOUT VOIR <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {enLocationNow.map(r => {
              const v           = getVehicle(r)
              const c           = getClient(r)
              const daysLeft    = differenceInDays(startOfDay(new Date(r.end_datetime)), todayStart)
              const isLate      = r.status === 'en_retard'
              const isReturnToday = daysLeft === 0 && !isLate
              const nextBooking = v?.id ? nextBookingByVehicle.get(v.id) : undefined
              const hasNextBooking = nextBooking && nextBooking.start_datetime > r.end_datetime

              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className={`bg-white rounded-2xl p-4 border shadow-sm ${
                    isLate ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-black text-gray-900">{v?.brand} {v?.model}</span>
                          <span className="text-xs text-gray-400">{v?.plate}</span>
                        </div>
                        <p className="text-sm text-gray-600">{c?.first_name} {c?.last_name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Retour : {format(new Date(r.end_datetime), 'dd MMM à HH:mm', { locale: fr })}
                        </p>
                      </div>

                      {/* Countdown 64×64 */}
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

      {/* ═══ 4. ALERTES — résumé compact + lien vers la page complète ═══════ */}
      {alerts.length > 0 && (
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
      )}

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
                    {dayDeparts.length === 0 && dayReturns.length === 0 && (
                      <span className="text-[8px] text-gray-200">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Légende */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
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
          </div>

          {/* Missions de la semaine — tâches/RDV calendrier, attribuées ou non,
              pour voir en un coup d'œil qui fait quoi aujourd'hui et les jours
              suivants (au-delà des départs/retours déjà couverts ci-dessus). */}
          {weekCalendarTasks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-50 space-y-3">
              {Array.from({ length: 7 }, (_, i) => addDays(todayStart, i))
                .map(day => ({
                  day,
                  items: weekCalendarTasks.filter(t => isSameDay(new Date(t.start_at), day)),
                }))
                .filter(({ items }) => items.length > 0)
                .map(({ day, items }) => (
                  <div key={day.toISOString()}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                      {isSameDay(day, todayStart) ? "Aujourd'hui" : format(day, 'EEEE d MMM', { locale: fr })}
                    </p>
                    <div className="space-y-1">
                      {items.map(t => {
                        const assignee = assigneeLabel(t)
                        return (
                          <Link key={t.id} href="/calendrier" className="flex items-center gap-2.5 py-1">
                            <span className="w-10 text-[11px] font-mono font-bold text-gray-500 flex-shrink-0">
                              {format(new Date(t.start_at), 'HH:mm')}
                            </span>
                            <span className="text-xs text-gray-700 font-medium flex-1 min-w-0 truncate">{t.title}</span>
                            {assignee
                              ? <span className="text-[10px] text-gray-400 flex-shrink-0">{assignee}</span>
                              : <span className="text-[10px] font-semibold text-amber-600 flex-shrink-0">Non attribué</span>}
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
      {enLocationNow.length === 0 && alerts.length === 0 && retoursEnRetard.length === 0 &&
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
