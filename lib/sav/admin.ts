// Identité du super-admin SAV — la seule personne qui voit les tickets et reçoit
// les notifications Telegram. Configurable via SAV_ADMIN_EMAIL (sinon défaut).
export const SAV_ADMIN_EMAIL = (
  process.env.SAV_ADMIN_EMAIL ?? 'akpadjijepht@gmail.com'
).toLowerCase()

export function isSavAdmin(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SAV_ADMIN_EMAIL
}

export type SavStatus = 'nouveau' | 'en_cours' | 'resolu'

export const SAV_STATUS_LABELS: Record<SavStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  resolu: 'Résolu',
}

export interface SavTicket {
  id: string
  created_at: string
  reporter_id: string | null
  reporter_name: string | null
  reporter_role: string | null
  module: string | null
  section: string | null
  page_path: string | null
  description: string
  screenshot_url: string | null
  user_agent: string | null
  status: SavStatus
  updated_at: string
}
