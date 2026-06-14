// ─── Catégories comptables ────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  { id: 'loyer_vehicule', label: 'Loyer véhicule' },
  { id: 'assurance', label: 'Assurance' },
  { id: 'carburant', label: 'Carburant' },
  { id: 'peages', label: 'Péages' },
  { id: 'lavage', label: 'Lavage' },
  { id: 'reparations', label: 'Réparations' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'publicite', label: 'Publicité & Marketing' },
  { id: 'fournitures', label: 'Fournitures' },
  { id: 'salaires', label: 'Salaires' },
  { id: 'amendes', label: 'Amendes' },
  { id: 'location_vehicule_partenaire', label: 'Location véhicule partenaire' },
  { id: 'autres_depenses', label: 'Autres dépenses' },
]

export const REVENUE_CATEGORIES = [
  { id: 'location', label: 'Location véhicule' },
  { id: 'caution_retenue', label: 'Retenue sur caution' },
  { id: 'frais_retard', label: 'Frais de retard' },
  { id: 'km_supplementaires', label: 'Km supplémentaires' },
  { id: 'mise_a_disposition_sortante', label: 'Mise à disposition sortante' },
  { id: 'autres_recettes', label: 'Autres recettes' },
]

const ALL = [...EXPENSE_CATEGORIES, ...REVENUE_CATEGORIES]

export function getCategoryLabel(id: string) {
  return ALL.find(c => c.id === id)?.label ?? id
}

export const PAYMENT_METHODS = [
  { id: 'especes', label: 'Espèces' },
  { id: 'virement', label: 'Virement' },
  { id: 'carte', label: 'Carte' },
  { id: 'cheque', label: 'Chèque' },
  { id: 'prelevement', label: 'Prélèvement' },
  { id: 'autre', label: 'Autre' },
]

// ─── Périodes ─────────────────────────────────────────────────────────────────
export function periodRange(period: string, ref = new Date()): { from: string; to: string; label: string } {
  const d = new Date(ref)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  switch (period) {
    case 'today':
      return { from: iso(startOfDay), to: iso(startOfDay), label: "Aujourd'hui" }
    case 'week': {
      const day = (d.getDay() + 6) % 7 // lundi = 0
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      return { from: iso(monday), to: iso(sunday), label: 'Cette semaine' }
    }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3)
      const from = new Date(d.getFullYear(), q * 3, 1)
      const to = new Date(d.getFullYear(), q * 3 + 3, 0)
      return { from: iso(from), to: iso(to), label: 'Ce trimestre' }
    }
    case 'year':
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31`, label: 'Cette année' }
    case 'last_month': {
      const from = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const to   = new Date(d.getFullYear(), d.getMonth(), 0)
      return { from: iso(from), to: iso(to), label: 'Mois précédent' }
    }
    case 'last_quarter': {
      const q    = Math.floor(d.getMonth() / 3)
      const pq   = (q + 3) % 4
      const yr   = q === 0 ? d.getFullYear() - 1 : d.getFullYear()
      const from = new Date(yr, pq * 3, 1)
      const to   = new Date(yr, pq * 3 + 3, 0)
      return { from: iso(from), to: iso(to), label: 'Trimestre précédent' }
    }
    case 'month':
    default: {
      const from = new Date(d.getFullYear(), d.getMonth(), 1)
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { from: iso(from), to: iso(to), label: 'Ce mois' }
    }
  }
}
