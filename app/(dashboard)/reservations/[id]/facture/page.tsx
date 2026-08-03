import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TZDate } from '@date-fns/tz'
import { BUSINESS_TZ } from '@/lib/calendar/constants'
import { getAgencySettings } from '@/lib/contracts/agency'
import { MENTIONS_LEGALES_FACTURE } from '@/lib/invoices/mentions-legales'
import type { InvoiceLineItem } from '@/lib/pdf/invoice-template'
import InvoicePreviewClient from './InvoicePreviewClient'

/**
 * Aperçu de la facture de restitution, À L'INTÉRIEUR de l'application.
 *
 * Écrit le 03/08/2026 : le bouton « Prévisualiser » de la fiche réservation
 * ouvrait le PDF brut dans un nouvel onglet (`/api/invoices/[id]/preview`).
 * Sur le téléphone du gérant, cette visionneuse s'affiche en plein écran sans
 * bouton retour : l'application paraissait bloquée. Cette page reprend le
 * gabarit de l'aperçu du contrat (barre du haut avec retour, document dans une
 * carte), et le PDF ne s'obtient plus que par un téléchargement volontaire.
 *
 * Toutes les dates sont mises en forme ICI, côté serveur, à l'heure de l'agence :
 * Vercel tourne en temps universel, et un composant client rendu d'abord côté
 * serveur afficherait deux heures de moins avant de se corriger tout seul.
 *
 * Ne pas casser : le contenu affiché doit rester le miroir exact de
 * `lib/pdf/invoice-template.tsx`. Une ligne ajoutée au PDF s'ajoute ici aussi,
 * sinon le gérant valide un document qui n'est pas celui que le client reçoit.
 */
export default async function FacturePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name, address, postal_code, city), reservations(end_datetime)')
    .eq('reservation_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!invoice) notFound()

  const v = Array.isArray(invoice.vehicles) ? invoice.vehicles[0] : invoice.vehicles
  const c = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
  const res = Array.isArray(invoice.reservations) ? invoice.reservations[0] : invoice.reservations

  const agency = await getAgencySettings(supabase)
  const heureAgence = (dt: string) => new TZDate(new Date(dt), BUSINESS_TZ)

  return (
    <InvoicePreviewClient
      retourHref={`/reservations/${id}`}
      pdfHref={`/api/invoices/${invoice.id}/preview`}
      invoiceId={invoice.id}
      numero={invoice.invoice_number}
      envoyeeLe={invoice.sent_at ? format(heureAgence(invoice.sent_at), 'dd/MM/yyyy') : null}
      annulee={Boolean(invoice.cancelled_at)}
      dateEmission={format(heureAgence(invoice.sent_at ?? new Date().toISOString()), 'dd/MM/yyyy')}
      client={{
        nom: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim() || '—',
        adresse: c?.address
          ? `${c.address}${c.postal_code ? ', ' + c.postal_code : ''}${c.city ? ' ' + c.city : ''}`
          : '—',
      }}
      vehicule={{
        libelle: `${v?.brand ?? ''} ${v?.model ?? ''}`.trim() || '—',
        plaque: v?.plate ?? '—',
      }}
      retourLe={
        res?.end_datetime
          ? format(heureAgence(res.end_datetime), "d MMMM yyyy 'à' HH'h'mm", { locale: fr })
          : '—'
      }
      lignes={(invoice.line_items as InvoiceLineItem[]) ?? []}
      total={Number(invoice.total_amount ?? 0)}
      mentions={MENTIONS_LEGALES_FACTURE(agency.company_name)}
      agence={{
        nom: agency.company_name,
        siret: agency.siret ?? null,
        adresse: agency.address ?? null,
      }}
    />
  )
}
