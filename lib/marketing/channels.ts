export const MARKETING_CHANNELS = [
  { id: 'instagram',        label: 'Instagram',        color: '#E1306C' },
  { id: 'snapchat',         label: 'Snapchat',         color: '#FFFC00' },
  { id: 'tiktok',           label: 'TikTok',           color: '#000000' },
  { id: 'facebook',         label: 'Facebook',         color: '#1877F2' },
  { id: 'google',           label: 'Google Ads',       color: '#4285F4' },
  { id: 'flyers',           label: 'Flyers',           color: '#6B7280' },
  { id: 'partenariats',     label: 'Partenariats',     color: '#8B5CF6' },
  { id: 'bouche_a_oreille', label: 'Bouche-à-oreille', color: '#10B981' },
  { id: 'autre',            label: 'Autre',            color: '#9CA3AF' },
] as const

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number]['id']

export function getChannelLabel(id: string) {
  return MARKETING_CHANNELS.find(c => c.id === id)?.label ?? id
}

export function getChannelColor(id: string) {
  return MARKETING_CHANNELS.find(c => c.id === id)?.color ?? '#9CA3AF'
}

export const CAMPAIGN_STATUSES = {
  planifiee:  { label: 'Planifiée',  style: 'bg-blue-50 text-blue-700' },
  en_cours:   { label: 'En cours',   style: 'bg-green-50 text-green-700' },
  terminee:   { label: 'Terminée',   style: 'bg-gray-100 text-gray-600' },
  suspendue:  { label: 'Suspendue',  style: 'bg-orange-50 text-orange-700' },
} as const

export type CampaignStatus = keyof typeof CAMPAIGN_STATUSES

export function calcROI(budget: number, revenue: number) {
  if (budget <= 0) return null
  return ((revenue - budget) / budget) * 100
}

export function calcCAC(budget: number, reservations: number) {
  if (reservations <= 0) return null
  return budget / reservations
}
