import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Point d'entrée unique pour tracer une action dans le journal d'audit.
 * `summary` = phrase lisible (ex. « Contrat validé — Babacar Diallo — Renault
 * Captur ») rangée dans metadata.summary → affichée telle quelle dans le journal,
 * sans migration de schéma. Toute mutation (création / modification / suppression)
 * devrait passer par ici pour un suivi détaillé et homogène.
 */
export async function logAudit(
  supabase: SupabaseClient,
  entry: {
    userId: string
    action: string
    entityType?: string | null
    entityId?: string | null
    summary?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const metadata: Record<string, unknown> = { ...(entry.metadata ?? {}) }
  if (entry.summary) metadata.summary = entry.summary

  await supabase.from('audit_logs').insert({
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    metadata,
  })
}
