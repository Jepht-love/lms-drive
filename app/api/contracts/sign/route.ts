import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { contractId, clientSignature, agentSignature } = await request.json()
    if (!contractId || !clientSignature) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const { error } = await supabase
      .from('contracts')
      .update({
        client_signature_svg: clientSignature,
        agent_signature_svg: agentSignature ?? null,
        status: 'signe',
        signed_at: new Date().toISOString(),
        signed_by: user.id,
      })
      .eq('id', contractId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'contract_signed',
      entity_type: 'contracts',
      entity_id: contractId,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
