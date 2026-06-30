import type { createClient } from '@/lib/supabase/server'

type SB = Awaited<ReturnType<typeof createClient>>

/**
 * Verrou de période clôturée. Une fois une journée / un mois / une année
 * clôturé(e), plus aucune écriture ne doit y être ajoutée ou modifiée — sinon
 * le bilan figé diverge de la réalité. Renvoie un message d'erreur si la date
 * tombe dans une période clôturée, sinon `null`.
 *
 * Appelé par les chemins de SAISIE/édition manuelle de la comptabilité. Les
 * écritures automatiques (réservations, inter-agences…) sont datées de
 * l'événement courant, qui n'est jamais dans une période déjà figée.
 */
export async function assertPeriodOpen(supabase: SB, date: string): Promise<string | null> {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  const [{ data: annual }, { data: monthly }, { data: daily }] = await Promise.all([
    supabase.from('annual_closings').select('is_closed').eq('year', year).maybeSingle(),
    supabase.from('monthly_closings').select('is_closed').eq('month', month).eq('year', year).maybeSingle(),
    supabase.from('daily_closings').select('is_closed').eq('date', date).maybeSingle(),
  ])

  if (annual?.is_closed)  return `Année ${year} clôturée — écriture impossible. Rouvrez la clôture pour modifier.`
  if (monthly?.is_closed) return `Mois ${String(month).padStart(2, '0')}/${year} clôturé — écriture impossible. Rouvrez la clôture pour modifier.`
  if (daily?.is_closed)   return `Journée du ${date} clôturée — écriture impossible. Rouvrez la clôture pour modifier.`
  return null
}
