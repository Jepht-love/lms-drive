// ─── Moteur « santé mécanique » d'un véhicule ─────────────────────────────────
// Fonctions pures (zéro I/O) calculant les besoins d'entretien à partir du
// véhicule, de ses derniers entretiens par type et de ses dégradations actives.
// Cœur du suivi : entretien tous les 15 000 km, avec alertes graduées 500/200 km.
// Réutilisé par : liste véhicules, fiche véhicule, page entretien, alertes.

import { addMonths, differenceInDays } from 'date-fns'
import type { Vehicle, MaintenanceFlag } from '@/types/database'

// ── Sévérité (4 niveaux) ──────────────────────────────────────────────────────
export type NeedSeverity = 'ok' | 'soon' | 'urgent' | 'overdue'
const SEV_RANK: Record<NeedSeverity, number> = { ok: 0, soon: 1, urgent: 2, overdue: 3 }

export type NeedKey = 'entretien' | 'pneus' | 'ct' | 'degradation'

export interface VehicleNeed {
  key: NeedKey
  label: string
  severity: NeedSeverity
  detail: string
  flagId?: string        // dégradations : permet la résolution ciblée
}

// ── Intervalles & seuils d'alerte ─────────────────────────────────────────────
// Entretien : tous les 15 000 km (ou 12 mois). Alerte « à surveiller » à 500 km
// restants, « urgent » à 200 km restants (puis « dépassé »).
export const SERVICE_INTERVALS = {
  entretien: { km: 15000, months: 12, warnKm: 500, urgentKm: 200, warnDays: 30, urgentDays: 7 },
  pneus:     { km: 40000, warnKm: 2000, urgentKm: 500 },
  ct:        { warnDays: 30, urgentDays: 7 },
} as const

// Dernier entretien enregistré pour un type donné (maintenance_records)
export interface LastIntervention { km: number | null; date: string | null }
export type LastByType = Record<string, LastIntervention>

// ── Helpers internes ──────────────────────────────────────────────────────────
const fmtKm = (n: number) => Math.round(n).toLocaleString('fr-FR')

interface Candidate { severity: NeedSeverity; detail: string }

function kmCandidate(currentKm: number, dueKm: number, warnKm: number, urgentKm: number): Candidate {
  const left = dueKm - currentKm
  if (left <= 0)        return { severity: 'overdue', detail: `dépassé de ${fmtKm(-left)} km` }
  if (left <= urgentKm) return { severity: 'urgent',  detail: `dans ${fmtKm(left)} km` }
  if (left <= warnKm)   return { severity: 'soon',    detail: `dans ${fmtKm(left)} km` }
  return { severity: 'ok', detail: `dans ${fmtKm(left)} km` }
}

function dateCandidate(now: Date, dueDate: Date, warnDays: number, urgentDays: number): Candidate {
  const days = differenceInDays(dueDate, now)
  if (days <= 0)          return { severity: 'overdue', detail: `retard ${Math.abs(days)} j` }
  if (days <= urgentDays) return { severity: 'urgent',  detail: `dans ${days} j` }
  if (days <= warnDays)   return { severity: 'soon',    detail: `dans ${days} j` }
  return { severity: 'ok', detail: `dans ${days} j` }
}

/** Garde la pire des deux échéances (km prioritaire à sévérité égale). */
function worse(a: Candidate | null, b: Candidate | null): Candidate | null {
  if (!a) return b
  if (!b) return a
  return SEV_RANK[b.severity] > SEV_RANK[a.severity] ? b : a
}

// ── Calcul principal ──────────────────────────────────────────────────────────
export function computeVehicleNeeds(
  vehicle: Pick<Vehicle, 'current_km' | 'next_service_km' | 'next_service_date' | 'ct_date' | 'maintenance_flags'>,
  lastByType: LastByType,
  now: Date = new Date(),
): VehicleNeed[] {
  const needs: VehicleNeed[] = []
  const km = vehicle.current_km ?? 0
  const E = SERVICE_INTERVALS.entretien

  // ── ENTRETIEN (15 000 km) ──
  // Échéance km = next_service_km, sinon dérivée du dernier entretien (+ 15 000).
  const lastEntretien = lastByType['revision'] ?? lastByType['vidange']
  let dueKm: number | null = vehicle.next_service_km ?? null
  if (dueKm == null && lastEntretien?.km != null) dueKm = lastEntretien.km + E.km
  let dueDate: Date | null = vehicle.next_service_date ? new Date(vehicle.next_service_date) : null
  if (dueDate == null && lastEntretien?.date) dueDate = addMonths(new Date(lastEntretien.date), E.months)

  const eByKm   = dueKm != null ? kmCandidate(km, dueKm, E.warnKm, E.urgentKm) : null
  const eByDate = dueDate ? dateCandidate(now, dueDate, E.warnDays, E.urgentDays) : null
  const e = worse(eByKm, eByDate)
  if (e && e.severity !== 'ok') needs.push({ key: 'entretien', label: 'Entretien', severity: e.severity, detail: e.detail })

  // ── PNEUS (40 000 km depuis le dernier remplacement) ──
  const lastTires = lastByType['pneus']
  if (lastTires?.km != null) {
    const c = kmCandidate(km, lastTires.km + SERVICE_INTERVALS.pneus.km, SERVICE_INTERVALS.pneus.warnKm, SERVICE_INTERVALS.pneus.urgentKm)
    if (c.severity !== 'ok') needs.push({ key: 'pneus', label: 'Pneus', severity: c.severity, detail: c.detail })
  }

  // ── CONTRÔLE TECHNIQUE (ct_date) ──
  if (vehicle.ct_date) {
    const c = dateCandidate(now, new Date(vehicle.ct_date), SERVICE_INTERVALS.ct.warnDays, SERVICE_INTERVALS.ct.urgentDays)
    if (c.severity !== 'ok') needs.push({ key: 'ct', label: 'Contrôle technique', severity: c.severity, detail: c.detail })
  }

  // ── DÉGRADATIONS actives — un besoin par drapeau ──
  for (const f of vehicle.maintenance_flags ?? []) {
    needs.push({
      key: 'degradation',
      label: 'Intervenir',
      severity: f.severity === 'dommage' ? 'urgent' : 'soon',
      detail: f.label,
      flagId: f.id,
    })
  }

  return needs
}

// ── Agrégation pour l'affichage en badges ─────────────────────────────────────
export interface NeedBadge { key: NeedKey; label: string; severity: NeedSeverity; detail: string; count: number }

/** Un badge par type de besoin ; les dégradations sont comptées. */
export function groupNeedsForBadges(needs: VehicleNeed[]): NeedBadge[] {
  const map = new Map<NeedKey, NeedBadge>()
  for (const n of needs) {
    const cur = map.get(n.key)
    if (!cur) {
      map.set(n.key, { key: n.key, label: n.label, severity: n.severity, detail: n.detail, count: 1 })
    } else {
      cur.count += 1
      if (SEV_RANK[n.severity] > SEV_RANK[cur.severity]) { cur.severity = n.severity; cur.detail = n.detail }
    }
  }
  return [...map.values()].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])
}

/** Pire sévérité d'une liste de besoins (pour tri / bordure de carte). */
export function worstSeverity(needs: VehicleNeed[]): NeedSeverity {
  return needs.reduce<NeedSeverity>((acc, n) => (SEV_RANK[n.severity] > SEV_RANK[acc] ? n.severity : acc), 'ok')
}

// ── Styles de badge par sévérité ──────────────────────────────────────────────
export const NEED_BADGE: Record<NeedSeverity, string> = {
  overdue: 'bg-red-100 text-red-800 border-red-300',
  urgent:  'bg-red-50 text-red-700 border-red-200',
  soon:    'bg-orange-50 text-orange-700 border-orange-200',
  ok:      'bg-green-50 text-green-700 border-green-200',
}

// ── Catégories pour les chips de filtre de la liste véhicules ─────────────────
export const MAINTENANCE_CATEGORIES = [
  { id: 'entretien', label: 'Entretien',          keys: ['entretien'] as NeedKey[] },
  { id: 'pneus',     label: 'Pneus',              keys: ['pneus'] as NeedKey[] },
  { id: 'ct',        label: 'Contrôle technique', keys: ['ct'] as NeedKey[] },
  { id: 'degrade',   label: 'Intervenir',         keys: ['degradation'] as NeedKey[] },
] as const

export type MaintenanceCategoryId = (typeof MAINTENANCE_CATEGORIES)[number]['id']

/** Le véhicule (via ses besoins) correspond-il à la catégorie de filtre ? */
export function vehicleMatchesCategory(needs: VehicleNeed[], categoryId: string): boolean {
  const cat = MAINTENANCE_CATEGORIES.find(c => c.id === categoryId)
  if (!cat) return false
  return needs.some(n => cat.keys.includes(n.key))
}

/** Construit la map « dernier entretien par type » à partir de maintenance_records
 *  déjà triés par date décroissante (1ʳᵉ occurrence d'un type = la plus récente). */
export function buildLastByType(
  records: { type: string; km_at_intervention: number | null; date: string }[],
): LastByType {
  const out: LastByType = {}
  for (const r of records) {
    if (!out[r.type]) out[r.type] = { km: r.km_at_intervention, date: r.date }
  }
  return out
}

/** Catégorise un flag de dégradation pour un libellé lisible (zone → famille). */
export function buildDamageFlag(
  zoneId: string,
  zoneLabel: string,
  severity: MaintenanceFlag['severity'],
  inspectionId: string | null,
): Omit<MaintenanceFlag, 'id' | 'created_at'> {
  return {
    category: zoneId,
    label: `${zoneLabel} — ${severity}`,
    severity,
    source: 'inspection',
    source_id: inspectionId,
  }
}
