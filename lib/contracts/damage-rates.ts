// ─── Barème de dommages (référence contractuelle) ─────────────────────────────
// Utilisé dans le contrat PDF (section barème) et au retour pour chiffrer les
// dommages constatés à l'état des lieux d'arrivée.

export interface DamageRate {
  zone: string
  rate: number
  note?: string
}

export const DAMAGE_RATES: DamageRate[] = [
  { zone: 'Rayure légère (< 5 cm)',                    rate: 80 },
  { zone: 'Rayure profonde / éclat de peinture',       rate: 250 },
  { zone: 'Bosse sans rayure',                         rate: 150 },
  { zone: 'Bosse avec rayure',                         rate: 350 },
  { zone: 'Jante rayée',                               rate: 200 },
  { zone: 'Jante voilée / cassée',                     rate: 400 },
  { zone: 'Pare-brise — impact (< 1 cm)',              rate: 0,   note: 'Couvert par l\'assurance' },
  { zone: 'Pare-brise — fissure (> 1 cm)',             rate: 450 },
  { zone: 'Rétroviseur cassé',                         rate: 180 },
  { zone: 'Phare / feu cassé',                         rate: 300 },
  { zone: 'Intérieur taché (nettoyage)',               rate: 120 },
  { zone: 'Intérieur très sale / odeur de tabac',      rate: 250 },
  { zone: 'Clé perdue',                                rate: 350 },
  { zone: 'Carburant incorrect (réservoir)',           rate: 400 },
]

export const CONTRACT_CONDITIONS = `1. Le locataire s'engage à utiliser le véhicule conformément au code de la route.
2. Toute infraction ou amende est à la charge exclusive du locataire.
3. Le locataire est responsable de tout dommage causé au véhicule pendant la période de location, selon le barème ci-dessous.
4. La caution sera restituée après vérification de l'état du véhicule au retour.
5. Tout retard non signalé donne lieu à facturation supplémentaire.
6. Le plein de carburant est à la charge du locataire (même niveau départ / retour).`
