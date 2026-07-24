import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ContractPDF } from '@/lib/pdf/contract-template'
import { buildContractPdfData } from '@/lib/pdf/build-contract-data'
import { renderContractInvoiceAttachment, markRestitutionInvoiceSent } from '@/lib/actions/invoices'
import { createElement, type ReactElement } from 'react'
import { logEmail } from '@/lib/email/log'
import { RESEND_FROM, resendTo } from '@/lib/email/config'
import { contractDepartEmail, contractRetourEmail } from '@/lib/email/templates'

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

    // Facture de restitution jointe AU MÊME EMAIL que le contrat signé : le client
    // reçoit le contrat détaillant l'état des lieux ET la facture des éléments
    // facturés en une seule fois. La facture n'est marquée « envoyée » qu'après
    // l'envoi effectif de l'email (voir plus bas). `skipped` = pas de facture à
    // joindre (aucun frais, déjà envoyée, ou tarif incomplet) → le contrat part seul.
    const invoiceResult = await renderContractInvoiceAttachment(contractId)
    const invoiceAttachment = 'attachment' in invoiceResult ? invoiceResult.attachment : null

    const attachments: { filename: string; content: Buffer }[] = [
      { filename: `${contract.contract_number}.pdf`, content: Buffer.from(buffer) },
    ]
    if (invoiceAttachment) attachments.push(invoiceAttachment)

    // Modèle « agence » : confirmation au départ, restitution (+ estimation des
    // frais) au retour. Corps HTML + objet centralisés dans lib/email/templates.
    const parties = {
      client: { firstName: c.first_name, lastName: c.last_name },
      vehicle: { brand: v?.brand, model: v?.model, plate: v?.plate },
      contractNumber: contract.contract_number,
      startDatetime: r?.start_datetime,
      endDatetime: r?.end_datetime,
      agency: pdfData.agency,
    }
    const mail = hasArrivee
      ? contractRetourEmail({ ...parties, hasInvoice: !!invoiceAttachment })
      : contractDepartEmail({ ...parties, totalPrice: r?.total_price })

    // Resend ne LÈVE PAS d'exception quand il refuse un envoi (domaine non
    // vérifié, pièce jointe trop lourde, quota…) : il renvoie `{ data, error }`.
    // Il FAUT donc inspecter `error`, sinon on marque « envoyé » un mail qui n'est
    // jamais parti (cause du « le mail ne s'envoie pas » alors que la route rend 200).
    const { error: sendError } = await resend.emails.send({
      from: RESEND_FROM,
      to: resendTo(c.email),
      subject: mail.subject,
      html: mail.html,
      attachments,
    })

    if (sendError) {
      // Échec réel : NE PAS marquer « envoyé » (ni le contrat, ni la facture).
      // On journalise l'échec avec le message Resend et on le remonte au gérant.
      const totalMo = (attachments.reduce((s, a) => s + a.content.length, 0) / (1024 * 1024)).toFixed(1)
      console.error(`Resend send error (contract ${contractId}, pièces jointes ${totalMo} Mo):`, sendError)
      await logEmail({
        type: hasArrivee ? 'contrat_restitution' : 'contrat_location',
        recipient: c.email,
        subject: mail.subject,
        status: 'echec',
        error: sendError.message,
        referenceType: 'contract',
        referenceId: contractId,
        clientId: c.id,
        sentBy: user.id,
      })
      return NextResponse.json(
        { error: `L'email n'a pas pu être envoyé : ${sendError.message}` },
        { status: 502 }
      )
    }

    // L'email (contrat + éventuelle facture) est parti : on fige maintenant l'état
    // « envoyée » de la facture (archive, échéance, audit) — jamais avant.
    if ('attachment' in invoiceResult) {
      await markRestitutionInvoiceSent(invoiceResult.invoiceId, invoiceResult.attachment.content, user.id)
    }

    await supabase.from('contracts').update({ email_sent_at: new Date().toISOString() }).eq('id', contractId)
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'contract_email_sent',
      entity_type: 'contracts',
      entity_id: contractId,
      metadata: { client_id: c.id, with_arrival_edl: hasArrivee },
    })
    await logEmail({
      type: hasArrivee ? 'contrat_restitution' : 'contrat_location',
      recipient: c.email,
      subject: mail.subject,
      status: 'envoye',
      referenceType: 'contract',
      referenceId: contractId,
      clientId: c.id,
      sentBy: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Email send error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: e.message ?? 'Erreur envoi email' }, { status: 500 })
  }
}
