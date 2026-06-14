import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ContractPDF } from '@/lib/pdf/contract-template'
import { createElement, type ReactElement } from 'react'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { contractId } = await request.json()
    if (!contractId) return NextResponse.json({ error: 'contractId manquant' }, { status: 400 })

    const { data: contract } = await supabase
      .from('contracts')
      .select('*, reservation:reservations(*, vehicle:vehicles(*), client:clients(*))')
      .eq('id', contractId)
      .single()

    if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

    const r = contract.reservation as any
    const v = r?.vehicle
    const c = r?.client

    if (!c?.email) return NextResponse.json({ error: 'Le client n\'a pas d\'email' }, { status: 400 })

    const pdfData = {
      contractNumber: contract.contract_number,
      reservationNumber: r?.reservation_number ?? '',
      startDatetime: r?.start_datetime ?? '',
      endDatetime: r?.end_datetime ?? '',
      clientName: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
      clientPhone: c?.phone ?? '',
      clientEmail: c?.email ?? undefined,
      vehiclePlate: v?.plate ?? '',
      vehicleBrand: v?.brand ?? '',
      vehicleModel: v?.model ?? '',
      vehicleVersion: v?.version ?? undefined,
      vehicleVin: v?.vin ?? undefined,
      vehicleColor: v?.color ?? undefined,
      dailyPrice: r?.daily_price ?? 0,
      totalPrice: r?.total_price ?? 0,
      kmIncluded: r?.km_included ?? undefined,
      depositAmount: r?.deposit_amount ?? undefined,
      depositMethod: r?.deposit_method ?? undefined,
      clientSignature: contract.client_signature_svg ?? undefined,
      agentSignature: contract.agent_signature_svg ?? undefined,
      signedAt: contract.signed_at ?? undefined,
    }

    const element = createElement(ContractPDF, { data: pdfData }) as ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    await resend.emails.send({
      from: 'LMS Drive <noreply@lmsdrive.fr>',
      to: c.email,
      subject: `Votre contrat de location ${contract.contract_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">LMS Drive — Contrat de location</h2>
          <p>Bonjour ${c.first_name} ${c.last_name},</p>
          <p>Veuillez trouver ci-joint votre contrat de location <strong>${contract.contract_number}</strong> pour le véhicule <strong>${v?.plate} — ${v?.brand} ${v?.model}</strong>.</p>
          <p>
            <strong>Départ :</strong> ${new Date(r?.start_datetime).toLocaleString('fr-FR')}<br>
            <strong>Retour prévu :</strong> ${new Date(r?.end_datetime).toLocaleString('fr-FR')}<br>
            <strong>Montant total :</strong> ${r?.total_price?.toFixed(2)} €
          </p>
          <p>Pour toute question, n'hésitez pas à nous contacter.</p>
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
      metadata: { recipient: c.email },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Email send error:', e)
    return NextResponse.json({ error: e.message ?? 'Erreur envoi email' }, { status: 500 })
  }
}
