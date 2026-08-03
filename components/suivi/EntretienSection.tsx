import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SmartSearch from '@/components/ui/SmartSearch'
import { Wrench, ChevronRight, User } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { maintenanceType, urgency, WORK_STATUSES_CLOS } from '@/lib/maintenance'
import {
  computeVehicleNeeds,
  buildLastByType,
  groupNeedsForBadges,
  worstSeverity,
  NEED_BADGE,
  type NeedSeverity,
} from '@/lib/maintenance-health'

const SEV_ORDER: Record<NeedSeverity, number> = { overdue: 0, urgent: 1, soon: 2, ok: 3 }

/**
 * Onglet « Entretien » de la page /suivi (ancienne page /maintenance).
 * Liste des véhicules triés par urgence d'entretien + total flotte.
 */
export default async function EntretienSection() {
  const supabase = await createClient()

  const [{ data: vehicles }, { data: records }, { data: entretienTasks }, { data: ouvertes }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate, brand, model, status, current_km, next_service_km, next_service_date, ct_date, maintenance_flags')
      .eq('is_active', true)
      .order('brand'),
    supabase
      .from('maintenance_records')
      .select('vehicle_id, type, km_at_intervention, date, amount')
      .order('date', { ascending: false }),
    // « Qui s'en charge » : tâches d'entretien ouvertes, assignées à un membre.
    supabase
      .from('tasks')
      .select('vehicle_id, profiles!tasks_assigned_to_fkey(full_name)')
      .eq('type', 'entretien')
      .in('status', ['a_faire', 'en_cours'])
      .not('vehicle_id', 'is', null),
    // Les interventions dont le travail n'est pas fini (02/08/2026). C'est ce
    // que le gérant veut voir en premier : combien de dossiers ouverts sur ce
    // véhicule, à quel point ça presse, et qui s'en occupe.
    supabase
      .from('maintenance_records')
      .select(`id, vehicle_id, urgency, due_date, work_status,
        assignee:profiles!maintenance_records_assigned_to_fkey(full_name),
        taker:profiles!maintenance_records_taken_by_fkey(full_name)`)
      .not('work_status', 'in', `(${WORK_STATUSES_CLOS.join(',')})`),
  ])

  const assigneeByVehicle = new Map<string, string>()
  for (const t of entretienTasks ?? []) {
    const p = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
    const name = (p as any)?.full_name
    if (t.vehicle_id && name && !assigneeByVehicle.has(t.vehicle_id)) {
      assigneeByVehicle.set(t.vehicle_id, name)
    }
  }

  // Le suivi du travail, par véhicule : combien de dossiers ouverts, la pire
  // urgence des trois niveaux, une échéance dépassée, et le premier nom trouvé.
  // Une échéance dépassée compte comme une urgence critique, exactement comme
  // dans les alertes : les deux écrans doivent dire la même chose.
  const maintenant = new Date()
  const RANG: Record<string, number> = { critique: 0, haute: 1, normale: 2 }
  const suiviParVehicule = new Map<string, { n: number; pire: string; depassee: boolean; qui: string | null }>()
  for (const it of ouvertes ?? []) {
    if (!it.vehicle_id) continue
    const nom = Array.isArray((it as any).taker) ? (it as any).taker[0] : (it as any).taker
    const des = Array.isArray((it as any).assignee) ? (it as any).assignee[0] : (it as any).assignee
    const personne = (nom as any)?.full_name ?? (des as any)?.full_name ?? null
    const depassee = Boolean(it.due_date && new Date(`${it.due_date}T23:59:59`) < maintenant)
    const cumul = suiviParVehicule.get(it.vehicle_id)
      ?? { n: 0, pire: 'normale', depassee: false, qui: null }
    cumul.n += 1
    if (RANG[(it.urgency as string) ?? 'normale'] < RANG[cumul.pire]) cumul.pire = it.urgency as string
    if (depassee) cumul.depassee = true
    if (!cumul.qui && personne) cumul.qui = personne
    suiviParVehicule.set(it.vehicle_id, cumul)
  }

  // Agrégation par véhicule (records triés date desc → 1er vu = dernier)
  const byVehicle = new Map<string, { total: number; count: number; last?: { type: string; date: string } }>()
  const recordsByVehicle = new Map<string, { type: string; km_at_intervention: number | null; date: string }[]>()
  for (const r of records ?? []) {
    const agg = byVehicle.get(r.vehicle_id) ?? { total: 0, count: 0 }
    agg.total += r.amount ?? 0
    agg.count += 1
    if (!agg.last) agg.last = { type: r.type, date: r.date }
    byVehicle.set(r.vehicle_id, agg)

    const arr = recordsByVehicle.get(r.vehicle_id) ?? []
    arr.push(r)
    recordsByVehicle.set(r.vehicle_id, arr)
  }

  const fleetTotal = (records ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  // Calcul des échéances + tri par urgence (overdue en tête)
  const now = new Date()
  const enriched = (vehicles ?? []).map(v => {
    const needs = computeVehicleNeeds(v, buildLastByType(recordsByVehicle.get(v.id) ?? []), now)
    const suivi = suiviParVehicule.get(v.id)
    return {
      v, agg: byVehicle.get(v.id), badges: groupNeedsForBadges(needs), worst: worstSeverity(needs),
      // La personne inscrite sur une intervention prime sur l'ancienne tâche
      // d'entretien : c'est elle qui reflète l'état réel depuis le 02/08/2026.
      assignee: suivi?.qui ?? assigneeByVehicle.get(v.id),
      suivi,
    }
  })
  enriched.sort((a, b) => SEV_ORDER[a.worst] - SEV_ORDER[b.worst])

  const toService = enriched.filter(e => e.worst !== 'ok').length

  return (
    <div className="space-y-4">

      {/* Résumé : à traiter + total flotte */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {toService > 0
            ? <span className="text-red-600 font-semibold">{toService} véhicule{toService > 1 ? 's' : ''} à traiter</span>
            : 'Flotte à jour'}
        </p>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total flotte</p>
          <p className="text-lg font-black text-gray-900">{formatPrice(fleetTotal)}</p>
        </div>
      </div>

      {/* Recherche véhicule */}
      <SmartSearch scope="maintenance" placeholder="Rechercher un véhicule…" />

      {/* Liste véhicules */}
      {!vehicles || vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucun véhicule dans la flotte</p>
          <Link href="/vehicles/new" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
            Ajouter un véhicule →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {enriched.map(({ v, agg, badges, assignee, suivi }) => (
            <Link
              key={v.id}
              href={`/maintenance/${v.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-[box-shadow,scale] active:scale-[.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 truncate">{v.brand} {v.model}</span>
                    <span className="bg-gray-100 text-gray-400 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md tracking-wider">
                      {v.plate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    {agg?.last ? (
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${maintenanceType(agg.last.type).dot}`} />
                        {maintenanceType(agg.last.type).label} · {formatDate(agg.last.date)}
                      </span>
                    ) : (
                      <span>Aucune intervention</span>
                    )}
                    {agg && <span>· {agg.count} interv.</span>}
                    {assignee && (
                      <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                        · <User className="w-3 h-3" /> {assignee}
                      </span>
                    )}
                  </div>
                  {(badges.length > 0 || suivi) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {/* Les dossiers ouverts en tête : c'est du travail engagé,
                          alors que les autres pastilles annoncent des échéances
                          à venir. Une échéance dépassée se dit en rouge, comme
                          dans les alertes. */}
                      {suivi && (
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold border ${
                          suivi.depassee || suivi.pire === 'critique' ? 'bg-red-50 text-red-700 border-red-100'
                          : suivi.pire === 'haute' ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {suivi.n} intervention{suivi.n > 1 ? 's' : ''} en cours
                          {suivi.depassee ? ' · en retard' : suivi.pire !== 'normale' ? ` · ${urgency(suivi.pire).label.toLowerCase()}` : ''}
                        </span>
                      )}
                      {badges.map(b => (
                        <span key={b.key} className={`text-xs px-2 py-0.5 rounded-lg font-semibold border ${NEED_BADGE[b.severity]}`}>
                          {b.key === 'degradation'
                            ? `Intervenir${b.count > 1 ? ` (${b.count})` : ''}`
                            : `${b.label} · ${b.detail}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-gray-900">{formatPrice(agg?.total ?? 0)}</p>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
