import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page:    { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#111111' },
  header:  { marginBottom: 24 },
  title:   { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sub:     { fontSize: 10, color: '#666666' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1, color: '#888888', marginBottom: 8, borderBottom: '1pt solid #e5e7eb', paddingBottom: 4 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottom: '0.5pt solid #f3f4f6' },
  label:   { color: '#666666', flex: 1 },
  value:   { fontFamily: 'Helvetica-Bold', flex: 2, textAlign: 'right' },
  box:     { backgroundColor: '#f9fafb', border: '1pt solid #e5e7eb', borderRadius: 4, padding: 10, marginBottom: 10 },
  alert:   { backgroundColor: '#fef2f2', border: '1pt solid #fecaca', borderRadius: 4, padding: 10, marginBottom: 10 },
  alertText: { color: '#dc2626', fontFamily: 'Helvetica-Bold', fontSize: 9 },
  total:   { backgroundColor: '#111111', borderRadius: 4, padding: 12, marginTop: 8 },
  totalLabel: { color: '#ffffff', opacity: 0.6, fontSize: 8 },
  totalValue: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 14, marginTop: 2 },
  notes:   { backgroundColor: '#fffbeb', border: '1pt solid #fde68a', borderRadius: 4, padding: 10 },
  footer:  { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af' },
  chip:    { backgroundColor: '#f3f4f6', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
})

function fmt(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}
function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export type SinistrePDFData = {
  dossier_number: string | null
  accident_date: string
  generated_at: string
  vehicle: { brand: string; model: string; plate: string }
  driver: string
  driver_type: 'client' | 'interne'
  description: string
  repair_cost: number
  insurance_covered: boolean
  insurance_amount: number
  deposit_retained: number
  client_responsibility: boolean
  status: string
  notes: string | null
  agency_name: string
}

const STATUS_LABELS: Record<string, string> = {
  declare: 'Déclaré',
  en_attente_traitement: 'En attente de traitement',
  en_expertise: 'En expertise',
  en_reparation: 'En réparation',
  en_attente_remboursement: 'En attente de remboursement',
  cloture: 'Clôturé',
}

export function SinistrePDF({ data }: { data: SinistrePDFData }) {
  const net = Math.max(0, data.repair_cost - (data.insurance_covered ? data.insurance_amount : 0) - data.deposit_retained)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Rapport de sinistre</Text>
          <Text style={s.sub}>{data.agency_name} · Généré le {fmtDate(data.generated_at)}</Text>
          {data.dossier_number && <Text style={[s.sub, { marginTop: 4 }]}>N° dossier : {data.dossier_number}</Text>}
        </View>

        {/* Statut */}
        <View style={s.box}>
          <Text style={{ fontSize: 8, color: '#888', marginBottom: 4 }}>STATUT DU DOSSIER</Text>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{STATUS_LABELS[data.status] ?? data.status}</Text>
        </View>

        {/* Véhicule & conducteur */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Informations du sinistre</Text>
          <View style={s.row}><Text style={s.label}>Date du sinistre</Text><Text style={s.value}>{fmtDate(data.accident_date)}</Text></View>
          <View style={s.row}><Text style={s.label}>Véhicule</Text><Text style={s.value}>{data.vehicle.brand} {data.vehicle.model} · {data.vehicle.plate}</Text></View>
          <View style={s.row}><Text style={s.label}>Conducteur</Text><Text style={s.value}>{data.driver} {data.driver_type === 'interne' ? '(utilisation interne)' : '(client)'}</Text></View>
          <View style={s.row}><Text style={s.label}>Responsabilité client</Text><Text style={s.value}>{data.client_responsibility ? 'Oui' : 'Non'}</Text></View>
        </View>

        {/* Description */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Description des faits</Text>
          <View style={s.box}>
            <Text style={{ lineHeight: 1.5 }}>{data.description}</Text>
          </View>
        </View>

        {/* Finances */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Détail financier</Text>
          <View style={s.row}><Text style={s.label}>Coût total des réparations</Text><Text style={s.value}>{fmt(data.repair_cost)}</Text></View>
          {data.insurance_covered && (
            <View style={s.row}><Text style={s.label}>Prise en charge assurance</Text><Text style={[s.value, { color: '#16a34a' }]}>− {fmt(data.insurance_amount)}</Text></View>
          )}
          {data.deposit_retained > 0 && (
            <View style={s.row}><Text style={s.label}>Retenue sur caution</Text><Text style={[s.value, { color: '#16a34a' }]}>− {fmt(data.deposit_retained)}</Text></View>
          )}
          <View style={s.total}>
            <Text style={s.totalLabel}>CHARGE NETTE AGENCE</Text>
            <Text style={s.totalValue}>{fmt(net)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Observations</Text>
            <View style={s.notes}>
              <Text style={{ lineHeight: 1.5 }}>{data.notes}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>{data.agency_name}</Text>
          <Text>Sinistre — {data.vehicle.brand} {data.vehicle.model} {data.vehicle.plate}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
