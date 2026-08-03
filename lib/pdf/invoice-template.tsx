import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { fmtNombre } from './nombres'
import { TZDate } from '@date-fns/tz'
import { BUSINESS_TZ } from '@/lib/calendar/constants'
import { MENTIONS_LEGALES_FACTURE } from '@/lib/invoices/mentions-legales'

/**
 * Toute date imprimée passe par l'heure de l'agence. `format(new Date(...))` met
 * en forme dans le fuseau du SERVEUR, et Vercel tourne en temps universel : un
 * retour à 12:00 s'imprimait 10:00 l'été. Constaté le 28/07/2026.
 */
function heureLocale(dt: string): Date {
  return new TZDate(new Date(dt), BUSINESS_TZ)
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface InvoiceData {
  invoiceNumber: string
  issueDate: string
  vehiclePlate: string
  vehicleBrand: string
  vehicleModel: string
  returnDatetime: string
  returnLocation?: string
  clientName: string
  clientAddress?: string
  lineItems: InvoiceLineItem[]
  totalAmount: number
  agency: {
    companyName: string
    siret: string | null
    address: string | null
    logoUrl?: string | null
  }
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 36, color: '#1e293b', backgroundColor: '#ffffff' },
  logo: { width: 70, marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  meta: { fontSize: 9, color: '#334155' },
  clientBox: { borderWidth: 1, borderColor: '#1e293b', padding: 8, width: 220 },
  clientLabel: { fontSize: 9, color: '#1e293b' },
  vehicleInfo: { fontSize: 9, marginBottom: 4, color: '#334155' },
  vehiclePlateInfo: { fontSize: 8, marginBottom: 4, color: '#94a3b8' },
  table: { marginTop: 12, borderWidth: 1, borderColor: '#1e293b' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' },
  cellDesc: { flex: 3, fontSize: 9, padding: 6 },
  cellQty: { flex: 1, fontSize: 9, padding: 6, textAlign: 'center' },
  cellPrice: { flex: 1, fontSize: 9, padding: 6, textAlign: 'center' },
  cellTotal: { flex: 1, fontSize: 9, padding: 6, textAlign: 'center' },
  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#f1f5f9' },
  totalLabel: { flex: 4, fontSize: 10, fontFamily: 'Helvetica-Bold', padding: 6, textAlign: 'right' },
  totalValue: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', padding: 6, textAlign: 'center' },
  legalSection: { marginTop: 24 },
  legalLine: { fontSize: 7, color: '#475569', textAlign: 'center', marginBottom: 6, lineHeight: 1.3 },
  footer: { position: 'absolute', bottom: 24, left: 36, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
})

// Les mentions légales vivent dans `lib/invoices/mentions-legales.ts` depuis le
// 03/08/2026 : l'aperçu à l'écran affiche exactement le même texte que le PDF.
const LEGAL_LINES = MENTIONS_LEGALES_FACTURE

export function InvoicePDF({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {data.agency.logoUrl && <Image src={data.agency.logoUrl} style={s.logo} />}
        <Text style={s.title}>FACTURE – RESTITUTION DE VÉHICULE</Text>

        <View style={s.metaRow}>
          <View>
            <Text style={s.meta}>Facture N° {data.invoiceNumber}</Text>
            <Text style={s.meta}>Date : {format(heureLocale(data.issueDate), 'dd/MM/yyyy')}</Text>
          </View>
          <View style={s.clientBox}>
            <Text style={s.clientLabel}>Client : {data.clientName}</Text>
            <Text style={s.clientLabel}>Adresse : {data.clientAddress ?? '—'}</Text>
          </View>
        </View>

        <Text style={s.vehicleInfo}>Véhicule : {data.vehicleBrand} {data.vehicleModel}</Text>
        <Text style={s.vehiclePlateInfo}>Plaque : {data.vehiclePlate}</Text>
        <Text style={s.vehicleInfo}>
          Retour : {format(heureLocale(data.returnDatetime), "d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
        </Text>
        {data.returnLocation && <Text style={s.vehicleInfo}>Lieu : {data.returnLocation}</Text>}

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.cellDesc, s.headerCell]}>Description</Text>
            <Text style={[s.cellQty, s.headerCell]}>Quantité</Text>
            <Text style={[s.cellPrice, s.headerCell]}>Prix unitaire (€)</Text>
            <Text style={[s.cellTotal, s.headerCell]}>Total (€)</Text>
          </View>
          {data.lineItems.map((item, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.cellDesc}>{item.description}</Text>
              <Text style={s.cellQty}>{item.quantity}</Text>
              <Text style={s.cellPrice}>{fmtNombre(item.unit_price)}</Text>
              <Text style={s.cellTotal}>{fmtNombre(item.total)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total (€)</Text>
            <Text style={s.totalValue}>{fmtNombre(data.totalAmount)} €</Text>
          </View>
        </View>

        <View style={s.legalSection}>
          {LEGAL_LINES(data.agency.companyName).map((line, i) => (
            <Text key={i} style={s.legalLine}>{line}</Text>
          ))}
        </View>

        <Text style={s.footer}>
          {data.agency.companyName}{data.agency.siret ? ` - N° de SIRET : ${data.agency.siret}` : ''}
          {data.agency.address ? `\n${data.agency.address}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
