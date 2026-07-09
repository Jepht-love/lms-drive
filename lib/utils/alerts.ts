import { createAdminClient } from '@/lib/supabase/admin'
import { differenceInDays } from 'date-fns'

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
}

/** Format véhicule uniforme : « marque modèle · plaque » (tolère marque/modèle absents) */
function vLabel(v: any): string {
  if (!v) return '—'
  const bm = [v?.brand, v?.model].filter(Boolean).join(' ').trim()
  const plate = v?.plate ?? '—'
  return bm ? `${bm} · ${plate}` : plate
}

export async function fetchAllAlerts(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<AppAlert[]> {
  const now = new Date()
  const alerts: AppAlert[] = []

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
      label: 'CONTRAT À SIGNER',
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
      label: 'RETOUR EN RETARD',
      sublabel: `${vLabel(v)} · ${(c as any)?.first_name ?? ''} ${(c as any)?.last_name ?? ''} · ${lateHours}h de retard`,
      href: `/reservations/${r.id}`,
      date: r.end_datetime,
      vehicleId: r.vehicle_id,
      reservationId: r.id,
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
          label: days < 0 ? 'CT EXPIRÉ' : 'CONTRÔLE TECHNIQUE',
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
          label: days < 0 ? 'ASSURANCE EXPIRÉE' : 'ASSURANCE À RENOUVELER',
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
          label: 'RÉVISION À PRÉVOIR',
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
          label: overdue ? 'ENTRETIEN DÉPASSÉ' : imminent ? 'ENTRETIEN IMMINENT' : 'ENTRETIEN À PRÉVOIR',
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
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select(`id, title, type, due_datetime, vehicle_id,
      vehicles(plate, brand, model),
      profiles!tasks_assigned_to_fkey(full_name)`)
    .eq('status', 'a_faire')
    .lt('due_datetime', now.toISOString())
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
      label: 'TÂCHE EN RETARD',
      sublabel: `${t.title}${(v as any)?.plate ? ` · ${vLabel(v)}` : ''}${(a as any)?.full_name ? ` · ${(a as any).full_name}` : ''} · ${lateHours}h de retard`,
      href: `/calendar/tasks/${t.id}`,
      date: t.due_datetime,
      vehicleId: t.vehicle_id ?? undefined,
    })
  })

  // ── 5. Lavage avant location (départ confirmé < 24h, dernier lavage > 2j) ───
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000)
  const { data: upcomingDeparts } = await supabase
    .from('reservations')
    .select('id, vehicle_id, start_datetime, vehicles(plate, brand, model, last_wash_date)')
    .eq('status', 'confirmee')
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', in24h.toISOString())

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
        label: 'LAVAGE AVANT LOCATION',
        sublabel: `${vLabel(v)} · départ dans ${hoursLeft}h`,
        href: `/reservations/${r.id}`,
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
      label: 'INFRACTION NON RÉGLÉE',
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
      label: 'SINISTRE EN COURS',
      sublabel: `${vLabel(v)} · ${new Date(acc.accident_date).toLocaleDateString('fr-FR')}`,
      href: `/incidents/accidents/${acc.id}`,
      date: acc.accident_date,
      vehicleId: acc.vehicle_id ?? undefined,
    })
  })

  // ── 9. Départs imminents (< 1h) ─────────────────────────────────────────────
  const in1h = new Date(now.getTime() + 3600 * 1000)
  const { data: upcomingDepartures } = await supabase
    .from('reservations')
    .select('id, vehicle_id, start_datetime, vehicles(plate, brand, model)')
    .eq('status', 'confirmee')
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', in1h.toISOString())

  upcomingDepartures?.forEach(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
    const minutesLeft = Math.max(0, Math.round(
      (new Date(r.start_datetime).getTime() - now.getTime()) / 60000
    ))
    alerts.push({
      id: `depart-${r.id}`,
      category: 'important',
      urgent: false,
      type: 'depart_imminent',
      label: 'DÉPART IMMINENT',
      sublabel: `${vLabel(v)} · dans ${minutesLeft} min`,
      href: `/reservations/${r.id}`,
      date: r.start_datetime,
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
      label: expired ? 'DOCUMENT EXPIRÉ' : 'DOCUMENT EXPIRE BIENTÔT',
      sublabel: `${doc.name} · ${expired ? `expiré il y a ${Math.abs(days)}j` : `dans ${days}j`}`,
      href: `/documents`,
      date: doc.expiry_date ?? undefined,
    })
  })

  // ── 10. Échéances financières courtes (J-2 et moins = urgent) ──────────────
  const { data: dueDates } = await supabase
    .from('financial_due_dates')
    .select('id, description, type, amount, due_date, vehicle_id, vehicles(plate, brand, model)')
    .eq('is_paid', false)
    .lte('due_date', new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0])

  dueDates?.forEach(d => {
    const v = Array.isArray(d.vehicles) ? d.vehicles[0] : d.vehicles
    const days = differenceInDays(new Date(d.due_date), now)
    const overdue = days < 0
    alerts.push({
      id: `due-${d.id}`,
      category: overdue || days <= 2 ? 'urgent' : 'important',
      urgent: overdue || days <= 2,
      type: 'echeance',
      label: overdue ? 'ÉCHÉANCE DÉPASSÉE' : 'ÉCHÉANCE PROCHE',
      sublabel: `${d.description}${v ? ` · ${vLabel(v)}` : ''} · ${d.type === 'recette' ? '+' : '−'}${d.amount}€ · ${overdue ? `dépassée de ${Math.abs(days)}j` : `dans ${days}j`}`,
      href: `/accounting/due-dates`,
      date: d.due_date,
      vehicleId: d.vehicle_id ?? undefined,
    })
  })

  // ── 11. Récupérations en retard (confirmée, start_datetime dépassé, non traitée) ─
  const { data: overduePickups } = await supabase
    .from('reservations')
    .select('id, vehicle_id, start_datetime, vehicles(plate, brand, model), clients(first_name, last_name)')
    .eq('status', 'confirmee')
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
      label: 'RÉCUPÉRATION EN RETARD',
      sublabel: `${vLabel(v)} · ${(c as any)?.first_name ?? ''} ${(c as any)?.last_name ?? ''} · ${daysLate > 0 ? `${daysLate}j de retard` : `${hoursLate}h de retard`}`,
      href: `/reservations/${r.id}`,
      date: r.start_datetime,
      vehicleId: r.vehicle_id,
      reservationId: r.id,
    })
  })

  return alerts.sort((a, b) => {
    const order = { urgent: 0, important: 1, info: 2 }
    return order[a.category] - order[b.category]
  })
}
