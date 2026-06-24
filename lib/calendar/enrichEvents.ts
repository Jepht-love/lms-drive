import { createAdminClient } from '@/lib/supabase/admin'
import type { CalendarEvent } from '@/types/calendar'

/**
 * Résout vehicle/client/assigned_profile via le client admin plutôt qu'un join
 * PostgREST classique : profiles_own_read et clients_managers restreignent la
 * lecture directe de ces tables (un employé ou un associé ne peut pas lire le
 * profil/client d'un tiers), ce qui viderait silencieusement ces champs pour
 * tout le monde sauf 'gerant'. La ligne calendar_events elle-même reste filtrée
 * par sa propre RLS (client de session) — on n'enrichit que des lignes déjà
 * autorisées.
 */
export async function enrichEvents(rows: any[]): Promise<CalendarEvent[]> {
  if (rows.length === 0) return []
  const admin = createAdminClient()

  const vehicleIds = [...new Set(rows.flatMap(r => r.vehicle_ids ?? []).filter(Boolean))]
  const clientIds = [...new Set(rows.map(r => r.client_id).filter(Boolean))]
  const profileIds = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))]
  const teamIds = [...new Set(rows.map(r => r.assigned_team_id).filter(Boolean))]

  const [vehiclesRes, clientsRes, profilesRes, teamsRes] = await Promise.all([
    vehicleIds.length
      ? admin.from('vehicles').select('id, plate, brand, model').in('id', vehicleIds)
      : Promise.resolve({ data: [] as any[] }),
    clientIds.length
      ? admin.from('clients').select('id, first_name, last_name').in('id', clientIds)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? admin.from('profiles').select('id, full_name').in('id', profileIds)
      : Promise.resolve({ data: [] as any[] }),
    teamIds.length
      ? admin.from('calendar_teams').select('id, name, color').in('id', teamIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const vehicleMap = new Map((vehiclesRes.data ?? []).map((v: any) => [v.id, v]))
  const clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c]))
  const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]))
  const teamMap = new Map((teamsRes.data ?? []).map((t: any) => [t.id, t]))

  return rows.map(r => ({
    ...r,
    vehicles: (r.vehicle_ids ?? []).map((id: string) => vehicleMap.get(id)).filter(Boolean),
    client: r.client_id ? clientMap.get(r.client_id) ?? null : null,
    assigned_profile: r.assigned_to ? profileMap.get(r.assigned_to) ?? null : null,
    team: r.assigned_team_id ? teamMap.get(r.assigned_team_id) ?? null : null,
  }))
}
