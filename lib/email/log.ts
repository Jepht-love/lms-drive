import { createAdminClient } from '@/lib/supabase/admin'

export type EmailType = 'contrat_location' | 'contrat_restitution' | 'facture_restitution' | 'avis_infraction' | 'autre'

interface LogEmailParams {
  type: EmailType
  recipient: string
  subject: string
  status: 'envoye' | 'echec'
  error?: string
  referenceType?: string
  referenceId?: string
  clientId?: string
  sentBy?: string
}

// Client admin pour ne jamais bloquer la trace d'un envoi sur la RLS
// (gérant/associe uniquement) selon qui a déclenché l'envoi.
export async function logEmail(params: LogEmailParams) {
  const admin = createAdminClient()
  await admin.from('email_logs').insert({
    type: params.type,
    recipient: params.recipient,
    subject: params.subject,
    status: params.status,
    error: params.error ?? null,
    reference_type: params.referenceType ?? null,
    reference_id: params.referenceId ?? null,
    client_id: params.clientId ?? null,
    sent_by: params.sentBy ?? null,
  })
}
