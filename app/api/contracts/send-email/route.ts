import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ContractPDF } from '@/lib/pdf/contract-template'
import { buildContractPdfData } from '@/lib/pdf/build-contract-data'
import { createElement, type ReactElement } from 'react'
import { logEmail } from '@/lib/email/log'
import { RESEND_FROM, resendTo } from '@/lib/email/config'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      // Clé d'envoi email non configurée côté serveur : message clair plutôt
      // qu'une erreur technique brute renvoyée à l'utilisateur.
      return NextResponse.json(
        { error: "L'envoi d'email n'est pas configuré (clé API manquante). Contactez l'administrateur." },
        { status: 503 }
      )
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { contractId } = await request.json()
    if (!contractId) return NextResponse.json({ error: 'contractId manquant' }, { status: 400 })

    const built = await buildContractPdfData(supabase, contractId)
    if (!built) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

    const { pdfData, contract, reservation: r, vehicle: v, client: c } = built

    if (!c?.email) return NextResponse.json({ error: 'Le client n\'a pas d\'email' }, { status: 400 })

    // PDF COMPLET (contrat + EDL départ + EDL retour + documents) — identique au téléchargement
    const element = createElement(ContractPDF, { data: pdfData }) as ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    const hasArrivee = (pdfData.inspections ?? []).some(i => i.type === 'arrivee')
    const docLabel = hasArrivee ? 'contrat de restitution (avec les états des lieux de départ et de retour)' : 'contrat de location'

    await resend.emails.send({
      from: RESEND_FROM,
      to: resendTo(c.email),
      subject: `Votre ${hasArrivee ? 'contrat de restitution' : 'contrat de location'} ${contract.contract_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">LMS Drive — ${hasArrivee ? 'Contrat de restitution' : 'Contrat de location'}</h2>
          <p>Bonjour ${c.first_name} ${c.last_name},</p>
          <p>Veuillez trouver ci-joint votre ${docLabel} <strong>${contract.contract_number}</strong> pour le véhicule <strong>${v?.brand} ${v?.model} — ${v?.plate}</strong>.</p>
          <p>
            <strong>Départ :</strong> ${r?.start_datetime ? new Date(r.start_datetime).toLocaleString('fr-FR') : '—'}<br>
            <strong>Retour ${hasArrivee ? '' : 'prévu '}:</strong> ${r?.end_datetime ? new Date(r.end_datetime).toLocaleString('fr-FR') : '—'}<br>
            <strong>Montant total :</strong> ${r?.total_price?.toFixed(2)} €
          </p>
          <p>Conservez ce document : il détaille les conditions de location et l'état du véhicule au départ comme au retour.</p>
          <p style="color: #64748b; font-size: 12px;">— LMS Drive</p>
        </div>
      `,
      attachments: [
        {
          filename: `${contract.contract_number}.pdf`,
          content: Buffer.from(buffer),
        },
      ],
    })

    await supabase.from('contracts').update({ email_sent_at: new Date().toISOString() }).eq('id', contractId)
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'contract_email_sent',
      entity_type: 'contracts',
      entity_id: contractId,
      metadata: { recipient: c.email, with_arrival_edl: hasArrivee },
    })
    await logEmail({
      type: hasArrivee ? 'contrat_restitution' : 'contrat_location',
      recipient: c.email,
      subject: `Votre ${hasArrivee ? 'contrat de restitution' : 'contrat de location'} ${contract.contract_number}`,
      status: 'envoye',
      referenceType: 'contract',
      referenceId: contractId,
      clientId: c.id,
      sentBy: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Email send error:', e)
    return NextResponse.json({ error: e.message ?? 'Erreur envoi email' }, { status: 500 })
  }
}
