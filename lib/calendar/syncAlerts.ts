import { createAdminClient } from '@/lib/supabase/admin'
import type { AppAlert } from '@/lib/utils/alerts'
import { CALENDAR_START_HOUR } from '@/lib/calendar/constants'

const ALERT_DURATION_MINUTES = 60
/** Heure d'ouverture : là où se pose une tâche qui n'a qu'une date, sans heure. */
const HEURE_OUVERTURE = CALENDAR_START_HOUR

/**
 * Reflète les alertes urgentes/importantes du tableau de bord (/alertes) sur le
 * calendrier, catégorisées simplement comme une tâche (même event_type que
 * "Lavage avant location") — pour que tout ce qui demande une action vive au
 * même endroit que les départs/retours. Idempotent via calendar_events.source_key
 * (migration 026) ; supprime la tâche dès que l'alerte sous-jacente se résout.
 */
export async function syncAlertsToCalendar(
  supabase: ReturnType<typeof createAdminClient>,
  alerts: AppAlert[],
): Promise<void> {
  // Types déjà représentés sur le calendrier par les événements liés à la
  // réservation elle-même. Les resynchroniser ici créerait un doublon visuel sur
  // la même réservation, au même horaire.
  //   'retard'  : retour_vehicule passe en en_cours quand le retour est dépassé.
  //   'lavage'  : syncWashTask crée déjà sa propre tâche, avec un déclencheur
  //               plus précis que l'alerte de tableau de bord.
  //   'depart_imminent' / 'retour_jour' : les départs et retours du jour ONT
  //               déjà leur événement de départ / retour au calendrier. Constaté
  //               le 27/07 dès l'ajout de ces alertes : « 12:00 RETOUR ... » et
  //               « 12:00 TÂCHE — RETOUR DU JOUR ... » côte à côte dans les
  //               tâches du jour, pour la même voiture et le même client.
  //   'intervention' : un passage au garage a DÉJÀ son créneau au calendrier,
  //               posé par createMaintenanceRecord. Le recopier ici afficherait
  //               deux fois la même réparation le même jour. Ajouté le
  //               02/08/2026, quand les interventions sont entrées dans les
  //               alertes.
  const ALREADY_ON_CALENDAR_TYPES = ['retard', 'lavage', 'depart_imminent', 'retour_jour', 'intervention']
  const actionable = alerts.filter(a =>
    (a.category === 'urgent' || a.category === 'important') &&
    !ALREADY_ON_CALENDAR_TYPES.includes(a.type) &&
    // Les alertes « event-… » décrivent une tâche du calendrier en retard :
    // elles sont déjà au calendrier, ce sont elles. Les recopier créait une
    // tâche dont le titre reprenait l'alerte, qui redevenait une alerte au tour
    // suivant : le titre s'allongeait à chaque passage jusqu'à une notification
    // illisible. Constaté sur le téléphone de Jeff le 28/07/2026.
    !a.id.startsWith('event-'),
  )

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, source_key')
    .not('source_key', 'is', null)

  /**
   * ⚠️ Clés qui n'appartiennent PAS aux alertes, et qu'il ne faut donc jamais
   * effacer ici.
   *
   * Le nettoyage de fin de fonction supprime tout événement porteur d'une clé
   * absente du tour courant. Tant que les alertes étaient seules à en poser, la
   * règle tenait. Depuis que les déplacements internes posent « trip-<id> »
   * (lib/calendar/syncInternalTrip.ts), chaque calcul d'alertes effaçait
   * l'événement de CHAQUE déplacement : le tableau de bord en supprimait un
   * juste après sa création, et aucun déplacement n'a jamais tenu au calendrier.
   * Trouvé le 02/08/2026 en cherchant pourquoi un déplacement planifié
   * n'apparaissait nulle part.
   *
   * Tout nouveau producteur de `source_key` doit ajouter son préfixe ici.
   */
  const PREFIXES_ETRANGERS = ['trip-', 'task-']
  const estUneAlerte = (key: string) => !PREFIXES_ETRANGERS.some(p => key.startsWith(p))

  const existingByKey = new Map(
    (existing ?? [])
      .filter(e => estUneAlerte(e.source_key as string))
      .map(e => [e.source_key as string, e.id as string]),
  )
  const seenKeys = new Set<string>()

  for (const alert of actionable) {
    seenKeys.add(alert.id)
    // Une alerte peut porter une DATE SEULE (« 2026-07-30 » pour une échéance de
    // paiement) ou un instant précis (l'heure d'un retour). Une date seule se lit
    // comme minuit en temps universel, soit 2h du matin en France : la tâche
    // atterrissait au milieu de la nuit, donc dans la journée de travail de la
    // VEILLE (7h→3h), et « Tâches du jour » ne la montrait jamais alors qu'elle
    // annonçait « à encaisser aujourd'hui ». Constaté le 30/07/2026.
    // On la pose donc au début de la journée de travail, à l'heure d'ouverture.
    const dateSeule = typeof alert.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(alert.date)
    let startAt: Date
    if (dateSeule) {
      const [a, m, j] = (alert.date as string).split('-').map(Number)
      startAt = new Date(a, m - 1, j, HEURE_OUVERTURE, 0, 0, 0)
    } else {
      startAt = alert.date ? new Date(alert.date) : new Date()
    }
    const endAt = new Date(startAt.getTime() + ALERT_DURATION_MINUTES * 60_000)

    const payload = {
      // Titre court : « Échéance proche · 30,00 € ». Avant le 30/07/2026 il
      // collait le libellé et la phrase entière (« Échéance proche — George
      // Alex Romeo · 30,00 € à encaisser aujourd'hui · Smart Fortwo · DQ-314-CV »),
      // illisible dans une case de calendrier et dans « Tâches du jour ».
      // Le détail n'est pas perdu : la personne passe en `description`, et la
      // phrase entière continue de partir sur le téléphone depuis l'alerte
      // elle-même (app/api/notifications/route.ts), pas depuis cette ligne.
      title: [alert.calendarTitle ?? alert.label, alert.amountLabel].filter(Boolean).join(' · '),
      description: alert.personLabel ?? alert.sublabel,
      event_type: 'tache' as const,
      status: 'a_faire' as const,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      source_key: alert.id,
      reservation_id: alert.reservationId ?? null,
      vehicle_ids: alert.vehicleId ? [alert.vehicleId] : null,
      notes: alert.href,
    }

    const existingId = existingByKey.get(alert.id)
    if (existingId) {
      await supabase.from('calendar_events').update(payload).eq('id', existingId)
    } else {
      await supabase.from('calendar_events').insert(payload)
    }
  }

  const staleIds = [...existingByKey.entries()]
    .filter(([key]) => !seenKeys.has(key))
    .map(([, eventId]) => eventId)
  if (staleIds.length > 0) {
    await supabase.from('calendar_events').delete().in('id', staleIds)
  }
}
