import { createAdminClient } from '@/lib/supabase/admin'
import { differenceInDays } from 'date-fns'
// Ces alertes partent en notification poussée sur le téléphone : leurs heures
// sont donc mises en forme par le serveur, qui vit en temps universel. Sans ce
// détour, un retour prévu à 13:00 s'annonce « à 11:00 » l'été.
import { heureAgence, dateAgence, fmtAgence } from '@/lib/format/heureAgence'
import { getColumnWindow } from '@/lib/calendar/dateUtils'
import { CALENDAR_START_HOUR } from '@/lib/calendar/constants'

/** Jour et mois seuls : « 04/08 ». Assez pour une échéance à quelques jours. */
const jourMois = (v: string) => fmtAgence(v, { day: '2-digit', month: '2-digit' })

export interface AppAlert {
  id: string
  category: 'urgent' | 'important' | 'info'
  type: string
  label: string
  sublabel: string
  href: string
  date?: string
  urgent: boolean
  vehicleId?: string
  reservationId?: string
  // Les deux champs ci-dessous existent pour le TABLEAU DE BORD, qui écrit une
  // tâche sur trois lignes (véhicule · plaque / type et montant / la personne)
  // au lieu de la phrase collée de `sublabel`. Demande de Jeff du 30/07/2026.
  // `sublabel` ne bouge pas : c'est lui qui part sur l'écran de verrouillage du
  // téléphone (app/api/notifications/route.ts), où la phrase entière a du sens.
  /** Montant seul, déjà mis en forme : « 30,00 € ». */
  amountLabel?: string
  /** La personne concernée : le client d'une échéance, le locataire d'un retour. */
  personLabel?: string
  /**
   * Intitulé pour le CALENDRIER et « Tâches du jour », quand `label` ne suffit
   * pas. « Échéance proche » ne disait pas quel jour l'argent doit rentrer :
   * ici on écrit « À encaisser le 30/07 ». Demande de Jeff du 30/07/2026.
   * `label` ne bouge pas : c'est l'étiquette rouge de l'écran Alertes et le
   * titre de la notification, où la catégorie prime sur la date.
   */
  calendarTitle?: string
}

/** Format véhicule uniforme : « marque modèle · plaque » (tolère marque/modèle absents) */
function vLabel(v: any): string {
  if (!v) return '—'
  const bm = [v?.brand, v?.model].filter(Boolean).join(' ').trim()
  const plate = v?.plate ?? '—'
  return bm ? `${bm} · ${plate}` : plate
}

/**
 * Tolérance avant qu'une tâche non faite soit déclarée en retard.
 *
 * C'est le réglage « Seuil retour en retard » des paramètres, 30 minutes par
 * défaut. On le lit sur le GÉRANT : la table porte une ligne par utilisateur, et
 * un `.limit(1)` tombait sur le réglage de n'importe qui.
 *
 * Sans cette tolérance, une tâche prévue à 10h basculait en alerte à 10h00 et
 * une minute, alors que la personne était en train de la faire.
 */
export async function seuilRetardMinutes(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const { data: gerant } = await supabase
    .from('profiles').select('id').eq('role', 'gerant').limit(1).maybeSingle()
  if (!gerant?.id) return 30
  const { data: cfg } = await supabase
    .from('notification_settings')
    .select('late_return_threshold_minutes')
    .eq('user_id', gerant.id)
    .maybeSingle()
  return cfg?.late_return_threshold_minutes ?? 30
}

export async function fetchAllAlerts(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<AppAlert[]> {
  const now = new Date()
  const alerts: AppAlert[] = []
  const tolerance = await seuilRetardMinutes(supabase)
  const limiteRetard = new Date(now.getTime() - tolerance * 60_000)

  /**
   * Début de la journée métier en cours (7h→3h le lendemain, même découpage que
   * le calendrier et que le tableau de bord). Sert de frontière aux « tâches en
   * retard » : une tâche du jour même n'est PAS une alerte, elle reste dans
   * « Tâches du jour » tant que la journée dure (règle de Jeff du 30/07/2026,
   * qui remplace la tolérance de 30 minutes appliquée jusque-là). Ne remontent
   * ici que les tâches des journées précédentes, jamais faites.
   */
  const debutJourneeMetier = (() => {
    const ref = now.getHours() < CALENDAR_START_HOUR
      ? new Date(now.getTime() - 24 * 3600 * 1000)
      : now
    return getColumnWindow(ref).start
  })()

  // ── 1. Contrats non signés ──────────────────────────────────────────────────
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`id, created_at,
      reservations(id, vehicle_id, vehicles(plate, brand, model), clients(first_name, last_name))`)
    .eq('status', 'a_signer')

  contracts?.forEach(c => {
    const r  = c.reservations as any
    const v  = Array.isArray(r?.vehicles) ? r.vehicles[0] : r?.vehicles
    const cl = Array.isArray(r?.clients)  ? r.clients[0]  : r?.clients
    alerts.push({
      id: `contract-${c.id}`,
      category: 'urgent',
      urgent: true,
      type: 'contrat',
      label: 'Contrat à signer',
      sublabel: `${vLabel(v)} · ${cl?.first_name ?? ''} ${cl?.last_name ?? ''}`.trim(),
      href: `/contracts/${c.id}`,
      date: c.created_at,
      vehicleId: r?.vehicle_id ?? undefined,
      reservationId: r?.id ?? undefined,
    })
  })

  // ── 2. Retours en retard ────────────────────────────────────────────────────
  const { data: lates } = await supabase
    .from('reservations')
    .select('id, vehicle_id, end_datetime, vehicles(plate, brand, model), clients(first_name, last_name)')
    .eq('status', 'en_retard')
    .order('end_datetime', { ascending: true })

  lates?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    const c = Array.isArray(r.clients)  ? r.clients[0]  : r.clients
    const lateHours = Math.round(
      (now.getTime() - new Date(r.end_datetime).getTime()) / 3600000
    )
    alerts.push({
      id: `late-${r.id}`,
      category: 'urgent',
      urgent: true,
      type: 'retard',
      label: 'Retour en retard',
      sublabel: `${vLabel(v)} · ${(c as any)?.first_name ?? ''} ${(c as any)?.last_name ?? ''} · ${lateHours}h de retard`,
      href: `/reservations/${r.id}?from=alerts`,
      date: r.end_datetime,
      vehicleId: r.vehicle_id,
      reservationId: r.id,
      personLabel: [(c as any)?.first_name, (c as any)?.last_name].filter(Boolean).join(' ').trim(),
    })
  })

  // ── 3. Alertes véhicules (CT, assurance, entretien) ────────────────────────
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, ct_date, insurance_expiry, next_service_date, next_service_km, current_km')
    .eq('is_active', true)

  vehicles?.forEach(v => {
    if (v.ct_date) {
      const days = differenceInDays(new Date(v.ct_date), now)
      if (days <= 30) {
        alerts.push({
          id: `ct-${v.id}`,
          category: days <= 7 ? 'urgent' : 'important',
          urgent: days <= 7,
          type: 'ct',
          label: days < 0 ? 'CT expiré' : 'Contrôle technique',
          sublabel: `${vLabel(v)} · ${days < 0 ? `expiré il y a ${Math.abs(days)}j` : `dans ${days}j`}`,
          href: `/vehicles/${v.id}`,
          date: v.ct_date,
          vehicleId: v.id,
        })
      }
    }

    if (v.insurance_expiry) {
      const days = differenceInDays(new Date(v.insurance_expiry), now)
      if (days <= 30) {
        alerts.push({
          id: `ins-${v.id}`,
          category: days <= 7 ? 'urgent' : 'important',
          urgent: days <= 7,
          type: 'assurance',
          label: days < 0 ? 'Assurance expirée' : 'Assurance à renouveler',
          sublabel: `${vLabel(v)} · ${days < 0 ? `expirée il y a ${Math.abs(days)}j` : `dans ${days}j`}`,
          href: `/vehicles/${v.id}`,
          date: v.insurance_expiry,
          vehicleId: v.id,
        })
      }
    }

    if (v.next_service_date) {
      const days = differenceInDays(new Date(v.next_service_date), now)
      if (days >= 0 && days <= 14) {
        alerts.push({
          id: `svc-${v.id}`,
          category: days <= 3 ? 'important' : 'info',
          urgent: false,
          type: 'revision',
          label: 'Révision à prévoir',
          sublabel: `${vLabel(v)} · dans ${days} jour${days > 1 ? 's' : ''}`,
          href: `/vehicles/${v.id}`,
          date: v.next_service_date,
          vehicleId: v.id,
        })
      }
    }

    if (v.next_service_km != null && v.current_km != null) {
      const kmLeft = v.next_service_km - v.current_km
      // Alertes graduées : à surveiller dès 500 km, urgent à 200 km, puis dépassé.
      if (kmLeft <= 500) {
        const overdue  = kmLeft <= 0
        const imminent = kmLeft <= 200
        alerts.push({
          id: `km-${v.id}`,
          category: overdue ? 'urgent' : 'important',
          urgent: imminent,
          type: 'revision',
          label: overdue ? 'Entretien dépassé' : imminent ? 'Entretien imminent' : 'Entretien à prévoir',
          sublabel: `${vLabel(v)} · ${overdue
            ? `dépassé de ${Math.abs(kmLeft).toLocaleString('fr-FR')} km`
            : `encore ${kmLeft.toLocaleString('fr-FR')} km`}`,
          href: `/vehicles/${v.id}`,
          vehicleId: v.id,
        })
      }
    }
  })

  // ── 4. Tâches en retard ─────────────────────────────────────────────────────
  // Seulement celles des journées PRÉCÉDENTES : une tâche du jour même reste
  // dans « Tâches du jour », en rouge, jusqu'au bout de la journée.
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select(`id, title, type, due_datetime, vehicle_id, reservation_id,
      vehicles(plate, brand, model),
      profiles!tasks_assigned_to_fkey(full_name)`)
    .eq('status', 'a_faire')
    .lt('due_datetime', debutJourneeMetier.toISOString())
    .order('due_datetime', { ascending: true })

  overdueTasks?.forEach(t => {
    const v = Array.isArray(t.vehicles)  ? t.vehicles[0]  : t.vehicles
    const a = Array.isArray(t.profiles)  ? t.profiles[0]  : t.profiles
    const lateHours = Math.round((now.getTime() - new Date(t.due_datetime).getTime()) / 3600000)
    alerts.push({
      id: `task-${t.id}`,
      category: 'important',
      urgent: false,
      type: 'tache',
      label: 'Tâche en retard',
      sublabel: `${t.title}${(v as any)?.plate ? ` · ${vLabel(v)}` : ''}${(a as any)?.full_name ? ` · ${(a as any).full_name}` : ''} · ${lateHours}h de retard`,
      // Clic → droit à l'action : la réservation liée, sinon la fiche tâche.
      href: t.reservation_id ? `/reservations/${t.reservation_id}` : `/calendar/tasks/${t.id}`,
      date: t.due_datetime,
      vehicleId: t.vehicle_id ?? undefined,
      reservationId: t.reservation_id ?? undefined,
    })
  })

  // ── 4 bis. Tâches et rendez-vous du calendrier en retard ────────────────────
  // Le lavage, le rendez-vous garage, la livraison ou la récupération vivent dans
  // `calendar_events`, pas dans `tasks` : ils restaient donc éternellement dans
  // « Tâches du jour » sans jamais devenir une alerte. Une tâche dépassée et non
  // faite doit quitter la liste du jour et venir ici (demande du 27/07/2026,
  // tolérance tranchée à 30 minutes par Jeff le 28/07/2026).
  //
  // On borne à 7 jours : au-delà, une tâche jamais clôturée n'est plus une
  // urgence du jour, et la faire remonter indéfiniment noierait l'écran.
  const retard7j = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
  //
  // ⚠️ `source_key is null` est INDISPENSABLE. Les alertes sont recopiées dans le
  // calendrier sous forme de tâches (syncAlertsToCalendar, titre = libellé de
  // l'alerte). Sans ce filtre, ces copies deviennent à leur tour des alertes dont
  // le libellé reprend le précédent : le titre s'allonge à chaque passage du cron
  // et la notification devient illisible. Constaté sur le téléphone de Jeff le
  // 28/07/2026, après six tours (« TÂCHE EN RETARD — TÂCHE EN RETARD — … »).
  // Ces copies ont déjà leur propre alerte, il n'y a donc rien à perdre.
  const { data: overdueEvents } = await supabase
    .from('calendar_events')
    .select('id, title, event_type, end_at, reservation_id, vehicle_ids, vehicle_id, assignee:profiles!assigned_to(full_name)')
    .in('event_type', ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation'])
    .in('status', ['a_faire', 'en_cours'])
    .is('source_key', null)
    // Les tâches que l'application fabrique elle-même (lavage avant location,
    // rendez-vous garage) remontent ICI AUSSI depuis le 30/07/2026. Avant cette
    // date, seules les tâches confiées par quelqu'un remontaient (`created_by`
    // non nul), pour éviter un doublon avec leur alerte propre.
    // Pourquoi ça a changé : l'alerte propre du lavage (section 5) ne vit que
    // tant que le DÉPART est à venir. Départ passé, elle s'éteint — et la tâche
    // avait déjà quitté « Tâches du jour ». Un lavage jamais fait disparaissait
    // donc des deux écrans. Constaté sur les données réelles le 30/07/2026.
    // Le doublon qu'évitait l'ancien filtre est désormais traité en fin de
    // fonction, réservation par réservation.
    .gte('end_at', retard7j.toISOString())
    // Frontière : le début de la journée métier, pas une tolérance en minutes.
    // Une tâche du jour même appartient à « Tâches du jour » (Jeff, 30/07/2026).
    .lt('end_at', debutJourneeMetier.toISOString())
    .order('end_at', { ascending: true })

  // Le véhicule d'une tâche vit à DEUX endroits selon qui l'a créée :
  // `vehicle_ids` (tableau) pour les tâches du calendrier, `vehicle_id` (seul)
  // pour celles que l'état des lieux de retour fabrique (« Clôturer contrat »,
  // components/inspection/InspectionFlow.tsx). Lire les deux, sinon l'alerte
  // sort sans voiture alors que toutes les autres en portent une.
  const idsVehiculesDesTaches = [...new Set(
    (overdueEvents ?? []).flatMap(ev => [
      ...(((ev as any).vehicle_ids as string[] | null) ?? []),
      (ev as any).vehicle_id,
    ]).filter(Boolean) as string[],
  )]
  const vehiculeParId = new Map<string, any>()
  if (idsVehiculesDesTaches.length > 0) {
    const { data: vehiculesDesTaches } = await supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .in('id', idsVehiculesDesTaches)
    vehiculesDesTaches?.forEach(v => vehiculeParId.set(v.id, v))
  }

  for (const ev of overdueEvents ?? []) {
    const qui = Array.isArray(ev.assignee) ? ev.assignee[0] : ev.assignee
    const minutes = Math.round((now.getTime() - new Date(ev.end_at).getTime()) / 60_000)
    const retard = minutes < 60
      ? `${minutes} min de retard`
      : `${Math.round(minutes / 60)}h de retard`
    const idVehicule = ((ev as any).vehicle_ids as string[] | null)?.[0]
      ?? (ev as any).vehicle_id ?? undefined
    const veh = idVehicule ? vehiculeParId.get(idVehicule) : null
    // Le véhicule passe DEVANT, comme dans toutes les autres alertes (demande
    // de Jeff du 30/07/2026 : la voiture et sa plaque en premier, partout).
    // Beaucoup de titres finissent déjà par le véhicule (« Lavage avant
    // location — BMW Série 1 Blanc ») : on coupe cette fin, sinon la ligne
    // écrivait la voiture deux fois de suite. Un titre qui nomme le client
    // (« Clôturer contrat — Mohamed-amine Baazaoui ») reste entier.
    const finDuTitre = ev.title.split(' — ').slice(1).join(' — ')
    const finRepeteLeVehicule = Boolean(
      veh && finDuTitre && [veh.brand, veh.model].filter(Boolean).some(
        (mot: string) => finDuTitre.toLowerCase().includes(String(mot).toLowerCase()),
      ),
    )
    const intitule = finRepeteLeVehicule ? ev.title.split(' — ')[0] : ev.title
    alerts.push({
      id: `event-${ev.id}`,
      category: 'important',
      urgent: false,
      type: 'tache',
      label: 'Tâche en retard',
      sublabel: [
        veh ? vLabel(veh) : null,
        intitule,
        (qui as any)?.full_name ?? 'non assignée',
        retard,
      ].filter(Boolean).join(' · '),
      // Le clic ouvre la tâche elle-même : c'est là qu'on la passe en terminé.
      href: `/calendrier?event=${ev.id}`,
      date: ev.end_at,
      vehicleId: idVehicule,
      reservationId: ev.reservation_id ?? undefined,
    })
  }

  // ── 5. Lavage avant location (départ confirmé < 24h, dernier lavage > 2j) ───
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000)
  const { data: upcomingDeparts } = await supabase
    .from('reservations')
    .select('id, vehicle_id, start_datetime, vehicles(plate, brand, model, last_wash_date)')
    .eq('status', 'confirmee')
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', in24h.toISOString())

  // Tâches lavage déjà au calendrier pour ces départs → l'alerte ouvre la tâche.
  const washTaskByRes = new Map<string, string>()
  const departIds = (upcomingDeparts ?? []).map(r => r.id)
  if (departIds.length) {
    const { data: washTasks } = await supabase
      .from('calendar_events')
      .select('id, reservation_id')
      .eq('event_type', 'tache')
      .in('reservation_id', departIds)
    washTasks?.forEach(t => { if (t.reservation_id) washTaskByRes.set(t.reservation_id, t.id) })
  }

  upcomingDeparts?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    if (!v) return
    const lastWash = (v as any).last_wash_date
    const daysSinceWash = lastWash
      ? Math.floor((now.getTime() - new Date(lastWash).getTime()) / 86400000)
      : 999
    if (daysSinceWash > 2) {
      const hoursLeft = Math.max(0, Math.round(
        (new Date(r.start_datetime).getTime() - now.getTime()) / 3600000
      ))
      alerts.push({
        id: `wash-${r.id}`,
        category: 'important',
        urgent: false,
        type: 'lavage',
        label: 'Lavage avant location',
        sublabel: `${vLabel(v)} · départ dans ${hoursLeft}h`,
        // Le lavage est une TÂCHE de préparation, pas la réservation. Si la tâche
        // calendrier existe (syncWashTask), l'alerte l'ouvre (?event=<id>). Sinon
        // — cas d'une voiture devenue « à laver » APRÈS la dernière synchro de la
        // réservation, où aucune tâche n'a été créée — l'alerte ouvre un tiroir de
        // création pré-rempli (véhicule + créneau 1h avant départ + intitulé) qu'il
        // ne reste qu'à assigner, au lieu de tomber sur un calendrier vide.
        href: washTaskByRes.get(r.id)
          ? `/calendrier?event=${washTaskByRes.get(r.id)}`
          : `/calendrier?${new URLSearchParams({
              create: 'prep',
              date: new Date(new Date(r.start_datetime).getTime() - 60 * 60_000).toISOString(),
              title: `Lavage avant location — ${vLabel(v)}`,
              ...(r.vehicle_id ? { vehicle: r.vehicle_id } : {}),
            }).toString()}`,
        date: r.start_datetime,
        vehicleId: r.vehicle_id,
        reservationId: r.id,
      })
    }
  })

  // ── 6. Infractions non réglées > 30 jours ─────────────────────────────────
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const { data: infractions } = await supabase
    .from('infractions')
    .select('id, vehicle_id, infraction_date, type, vehicles(plate, brand, model)')
    .not('status', 'in', '("regle","cloture")')
    .lt('infraction_date', thirtyDaysAgo.toISOString().split('T')[0])

  infractions?.forEach(inf => {
    const v = Array.isArray(inf.vehicles) ? inf.vehicles[0] : inf.vehicles
    const days = differenceInDays(now, new Date(inf.infraction_date))
    alerts.push({
      id: `inf-${inf.id}`,
      category: 'important',
      urgent: false,
      type: 'infraction',
      label: 'Infraction non réglée',
      sublabel: `${vLabel(v)} · ${inf.type} · il y a ${days}j`,
      href: `/incidents/infractions/${inf.id}`,
      date: inf.infraction_date,
      vehicleId: inf.vehicle_id ?? undefined,
    })
  })

  // ── 7. Sinistres en cours ──────────────────────────────────────────────────
  const { data: accidents } = await supabase
    .from('accidents')
    .select('id, vehicle_id, accident_date, vehicles(plate, brand, model)')
    .not('status', 'eq', 'cloture')
    .order('accident_date', { ascending: false })

  accidents?.forEach(acc => {
    const v = Array.isArray(acc.vehicles) ? acc.vehicles[0] : acc.vehicles
    alerts.push({
      id: `acc-${acc.id}`,
      category: 'important',
      urgent: false,
      type: 'sinistre',
      label: 'Sinistre en cours',
      sublabel: `${vLabel(v)} · ${dateAgence(acc.accident_date)}`,
      href: `/incidents/sinistres/${acc.id}`,
      date: acc.accident_date,
      vehicleId: acc.vehicle_id ?? undefined,
    })
  })

  // ── 9. Départs et retours DU JOUR ───────────────────────────────────────────
  // Deux alertes qui anticipent, et qui laissent la place à leur version « en
  // retard » dès que l'heure est dépassée (décision gérant 27/07) :
  //   DÉPART DU JOUR  → DÉPART EN RETARD   (section 11)
  //   RETOUR DU JOUR  → RETOUR EN RETARD   (section 2)
  //
  // Elles couvrent la JOURNÉE entière, pas la dernière heure : le but est
  // d'organiser la journée le matin, pas d'être prévenu quand il est trop tard
  // pour appeler le client ou libérer une place. Rangées en « important » : le
  // rouge urgent reste réservé aux retards réels.
  //
  // Bornes calculées sur le calendrier LOCAL (voir toYMD dans lib/utils) : en
  // passant par l'heure de Londres, « aujourd'hui » basculerait la veille entre
  // minuit et 2 h du matin.
  const finDeJournee = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  // Départs du jour : heure encore à venir. Seules les CONFIRMÉES comptent, une
  // option n'étant qu'un pré-blocage qui peut ne jamais se concrétiser.
  const { data: departuresToday } = await supabase
    .from('reservations')
    .select('id, vehicle_id, start_datetime, vehicles(plate, brand, model), clients(first_name, last_name)')
    .eq('status', 'confirmee')
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', finDeJournee.toISOString())
    .order('start_datetime', { ascending: true })

  departuresToday?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    const c = Array.isArray(r.clients)  ? r.clients[0]  : r.clients
    const heure = heureAgence(r.start_datetime)
    alerts.push({
      id: `depart-${r.id}`,
      category: 'important',
      urgent: false,
      type: 'depart_imminent',
      label: 'Départ du jour',
      sublabel: `${vLabel(v)} · ${(c as any)?.first_name ?? ''} ${(c as any)?.last_name ?? ''} · à ${heure}`,
      href: `/reservations/${r.id}?from=alerts`,
      date: r.start_datetime,
      vehicleId: r.vehicle_id,
      reservationId: r.id,
    })
  })

  // Retours du jour : voiture sortie, retour attendu aujourd'hui, heure encore à
  // venir. Dès l'heure dépassée, la réservation passe « en_retard » et c'est la
  // section 2 qui la reprend en rouge.
  const { data: returnsToday } = await supabase
    .from('reservations')
    .select('id, vehicle_id, end_datetime, vehicles(plate, brand, model), clients(first_name, last_name)')
    .eq('status', 'en_cours')
    .gte('end_datetime', now.toISOString())
    .lte('end_datetime', finDeJournee.toISOString())
    .order('end_datetime', { ascending: true })

  returnsToday?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    const c = Array.isArray(r.clients)  ? r.clients[0]  : r.clients
    const heure = heureAgence(r.end_datetime)
    alerts.push({
      id: `retour-jour-${r.id}`,
      category: 'important',
      urgent: false,
      type: 'retour_jour',
      label: 'Retour du jour',
      sublabel: `${vLabel(v)} · ${(c as any)?.first_name ?? ''} ${(c as any)?.last_name ?? ''} · à ${heure}`,
      href: `/reservations/${r.id}?from=alerts`,
      date: r.end_datetime,
      vehicleId: r.vehicle_id,
      reservationId: r.id,
    })
  })

  // ── 8. Documents expirés ou < 30 jours ────────────────────────────────────
  const { data: expiringDocs } = await supabase
    .from('documents')
    .select('id, name, expiry_date, category')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0])

  expiringDocs?.forEach(doc => {
    const days = differenceInDays(new Date(doc.expiry_date!), now)
    const expired = days < 0
    alerts.push({
      id: `doc-${doc.id}`,
      category: expired ? 'urgent' : 'important',
      urgent: expired,
      type: 'document',
      label: expired ? 'Document expiré' : 'Document expire bientôt',
      sublabel: `${doc.name} · ${expired ? `expiré il y a ${Math.abs(days)}j` : `dans ${days}j`}`,
      href: `/documents`,
      date: doc.expiry_date ?? undefined,
    })
  })

  // ── 10. Échéances financières courtes (J-2 et moins = urgent) ──────────────
  const { data: dueDatesRaw } = await supabase
    .from('financial_due_dates')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name)')
    .eq('is_paid', false)
    .lte('due_date', new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0])

  // Exclut les échéances en corbeille (suppression logique) — filtre en mémoire
  // pour rester tolérant si la colonne deleted_at n'existe pas encore.
  const dueDates = (dueDatesRaw ?? []).filter((d: any) => !d.deleted_at)
  dueDates.forEach(d => {
    const v = Array.isArray(d.vehicles) ? d.vehicles[0] : d.vehicles
    const cli = Array.isArray(d.clients) ? d.clients[0] : d.clients
    const days = differenceInDays(new Date(d.due_date), now)
    const overdue = days < 0

    // Ces textes se lisent sur un écran de verrouillage : le nom du client
    // d'abord, un montant en euros, et une échéance en français. « dans 0j » et
    // « +150€ » y étaient illisibles (retour Jeff du 29/07).
    const qui = [cli?.first_name, cli?.last_name].filter(Boolean).join(' ').trim()
    const montant = Number(d.amount).toLocaleString('fr-FR', {
      style: 'currency', currency: 'EUR',
    })
    const verbe = d.type === 'recette' ? 'à encaisser' : 'à payer'
    const quand = overdue
      ? `${verbe}, dépassée depuis le ${jourMois(d.due_date)}`
      : days === 0
        ? `${verbe} aujourd'hui`
        : `${verbe} le ${jourMois(d.due_date)}`
    const objet = qui || d.description

    alerts.push({
      id: `due-${d.id}`,
      category: overdue || days <= 2 ? 'urgent' : 'important',
      urgent: overdue || days <= 2,
      type: 'echeance',
      // Trois cas distincts, séparés le 30/07/2026 : « Échéance proche » servait
      // aussi bien pour aujourd'hui que pour dans quatre jours, et laissait
      // croire que l'argent n'était pas encore dû alors que le détail disait
      // « à encaisser aujourd'hui ». C'est ce libellé qui titre la notification
      // sur le téléphone, il doit se suffire à lui-même.
      label: overdue
        ? 'Échéance dépassée'
        : days === 0 ? 'Échéance du jour' : 'Échéance proche',
      sublabel: `${objet} · ${montant} ${quand}${v ? ` · ${vLabel(v)}` : ''}`,
      href: `/accounting/due-dates`,
      date: d.due_date,
      vehicleId: d.vehicle_id ?? undefined,
      amountLabel: montant,
      personLabel: objet,
      // Ce qu'on attend et pour quand : « À encaisser le 30/07 », ou
      // « Encaissement en retard depuis le 29/07 » quand la date est passée.
      // Le nom du geste change avec le sens de l'échéance : on encaisse une
      // recette, on paie une dépense. Formulation arrêtée par Jeff le
      // 30/07/2026 — « À encaisser depuis le 29/07 » ne voulait rien dire.
      calendarTitle: overdue
        ? `${d.type === 'recette' ? 'Encaissement' : 'Paiement'} en retard depuis le ${jourMois(d.due_date)}`
        : `${verbe.charAt(0).toUpperCase()}${verbe.slice(1)} le ${jourMois(d.due_date)}`,
    })
  })

  // ── 11. DÉPARTS EN RETARD (heure de départ dépassée, client pas venu) ────────
  // Prend le relais de « DÉPART DU JOUR » (section 9) dès l'heure passée. Deux
  // suites possibles pour le gérant : faire l'état des lieux de départ si le
  // client est là, ou déclarer « client non présenté » sur la fiche.
  // Les OPTIONS sont ici depuis le 30/07/2026, en même temps que « Tâches du
  // jour » a cessé d'afficher ce qui date d'un jour passé. Sans elles, une
  // option jamais récupérée ne serait plus nulle part : c'est exactement le
  // ticket que le gérant avait remonté le 21/07/2026 (« Aucune mission » alors
  // qu'un départ des jours précédents traînait).
  const { data: overduePickups } = await supabase
    .from('reservations')
    .select('id, vehicle_id, start_datetime, vehicles(plate, brand, model), clients(first_name, last_name)')
    .in('status', ['confirmee', 'option'])
    .lt('start_datetime', now.toISOString())
    .order('start_datetime', { ascending: true })

  overduePickups?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    const c = Array.isArray(r.clients)  ? r.clients[0]  : r.clients
    const hoursLate = Math.round((now.getTime() - new Date(r.start_datetime).getTime()) / 3600000)
    const daysLate  = Math.floor(hoursLate / 24)
    alerts.push({
      id: `pickup-late-${r.id}`,
      category: 'urgent',
      urgent: true,
      type: 'recuperation_retard',
      label: 'Départ en retard',
      sublabel: `${vLabel(v)} · ${(c as any)?.first_name ?? ''} ${(c as any)?.last_name ?? ''} · ${daysLate > 0 ? `${daysLate}j de retard` : `${hoursLate}h de retard`}`,
      href: `/reservations/${r.id}?from=alerts`,
      date: r.start_datetime,
      vehicleId: r.vehicle_id,
      reservationId: r.id,
    })
  })

  // ── 12. Retours partenaire en retard (opération en cours, fin prévue dépassée) ─
  // Notre véhicule parti chez un partenaire (sortant) ou véhicule partenaire chez
  // nous (entrant) : « rien ne tombe entre les mailles » — même logique que les
  // retours clients, appliquée à l'inter-agence.
  const { data: latePartnerOps } = await supabase
    .from('inter_agency_rentals')
    .select('id, direction, end_date_expected, vehicle_id, external_vehicle_description, partner_agencies(name), vehicles(plate, brand, model)')
    .eq('status', 'en_cours')
    .lt('end_date_expected', now.toISOString().split('T')[0])
    .order('end_date_expected', { ascending: true })

  latePartnerOps?.forEach(op => {
    const v = Array.isArray(op.vehicles) ? op.vehicles[0] : op.vehicles
    const a = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
    const agency = (a as any)?.name ?? 'partenaire'
    const vehLabel = v ? vLabel(v) : (op.external_vehicle_description || '—')
    const daysLate = Math.max(1, differenceInDays(now, new Date(op.end_date_expected)))
    const dirText = op.direction === 'out' ? `chez ${agency}` : `à rendre à ${agency}`
    alerts.push({
      id: `partner-late-${op.id}`,
      category: 'urgent',
      urgent: true,
      type: 'partenaire_retard',
      label: 'Retour partenaire en retard',
      sublabel: `${vehLabel} · ${dirText} · ${daysLate}j de retard`,
      href: `/partnerships/${op.id}`,
      date: op.end_date_expected,
      vehicleId: op.vehicle_id ?? undefined,
    })
  })

  // ── 13. Contrats non clôturés (signés, période terminée, jamais validés) ─────
  // Un contrat reste « signe » tant qu'on n'a pas fait le « Valider » final (EDL
  // retour + facture de restitution) qui le passe en « cloture ». La clôture pose
  // aussi le CA en comptabilité : un contrat resté signé alors que la location est
  // terminée = clôture (et intégration du CA) oubliée. On exclut les réservations
  // déjà « en_retard » : elles remontent déjà en RETOUR EN RETARD (urgent), inutile
  // de doublonner. Restent les cas réellement « oubliés » (retour traité mais
  // contrat pas validé, ou réservation encore « en_cours » jamais basculée).
  const { data: openContracts } = await supabase
    .from('contracts')
    .select(`id, reservation_id,
      reservations(id, status, end_datetime, vehicle_id, vehicles(plate, brand, model), clients(first_name, last_name))`)
    .eq('status', 'signe')

  openContracts?.forEach(c => {
    const r = c.reservations as any
    if (!r?.end_datetime) return
    if (r.status === 'en_retard') return // déjà couvert par RETOUR EN RETARD
    const end = new Date(r.end_datetime)
    if (end.getTime() >= now.getTime()) return // location encore en cours → normal
    const v  = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    const cl = Array.isArray(r.clients)  ? r.clients[0]  : r.clients
    const daysLate = Math.max(1, differenceInDays(now, end))
    alerts.push({
      id: `contract-open-${c.id}`,
      category: daysLate >= 3 ? 'urgent' : 'important',
      urgent: daysLate >= 3,
      type: 'contrat_non_cloture',
      label: 'Contrat non clôturé',
      sublabel: `${vLabel(v)} · ${cl?.first_name ?? ''} ${cl?.last_name ?? ''} · location terminée depuis ${daysLate}j`.replace(/\s+·\s+·/g, ' ·').trim(),
      href: `/reservations/${r.id}?from=alerts`,
      date: r.end_datetime,
      vehicleId: r.vehicle_id ?? undefined,
      reservationId: r.id ?? undefined,
    })
  })

  // ── Dédoublonnage final ─────────────────────────────────────────────────────
  // Un contrat qui traîne se disait DEUX fois : « Contrat non clôturé » (section
  // 13) et « Tâche en retard — Clôturer contrat » (section 4 bis), pour la même
  // réservation et le même client.
  // Arbitrage tranché par Jeff le 30/07/2026 : la TÂCHE gagne, l'alerte de
  // contrat s'efface. Motif : la tâche dit ce qu'il reste à faire, qui en a la
  // charge et depuis combien de temps elle traîne, et son clic ouvre l'écran où
  // on la termine. L'alerte de contrat, elle, décrit un état.
  // Le contrat garde son alerte tant qu'aucune tâche n'est en retard sur lui :
  // rien ne disparaît, y compris dans la demi-heure de tolérance après le
  // retour, ni si l'état des lieux n'a jamais créé la tâche.
  const reservationsAvecTacheEnRetard = new Set(
    alerts
      .filter(a => a.id.startsWith('event-') && a.reservationId)
      .map(a => a.reservationId),
  )
  const sansDoublon = alerts.filter(a => !(
    a.type === 'contrat_non_cloture' &&
    a.reservationId &&
    reservationsAvecTacheEnRetard.has(a.reservationId)
  ))

  return sansDoublon.sort((a, b) => {
    const order = { urgent: 0, important: 1, info: 2 }
    return order[a.category] - order[b.category]
  })
}
