import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface AccountingPdfData {
  periodLabel: string
  agencyName: string
  siret?: string | null
  totalRevenue: number
  totalExpenses: number
  revenueByCategory: { label: string; amount: number }[]
  expenseByCategory: { label: string; amount: number }[]
  generatedAt: string
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid #111111' },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 8, color: '#64748b', marginTop: 2 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  totalsRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  totalBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 4, padding: 10 },
  totalLabel: { fontSize: 8, color: '#64748b' },
  totalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottom: '0.5px solid #f1f5f9' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: '#94a3b8', textAlign: 'center' },
})

const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function AccountingPdf({ data }: { data: AccountingPdfData }) {
  const net = data.totalRevenue - data.totalExpenses
  return (
    <Document title={`Bilan ${data.periodLabel}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.company}>{data.agencyName}</Text>
            {data.siret && <Text style={s.small}>SIRET : {data.siret}</Text>}
          </View>
          <View>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Bilan comptable</Text>
            <Text style={[s.small, { textAlign: 'right' }]}>{data.periodLabel}</Text>
          </View>
        </View>

        <View style={s.totalsRow}>
          <View style={s.totalBox}><Text style={s.totalLabel}>Chiffre d'affaires</Text><Text style={[s.totalValue, { color: '#16a34a' }]}>{fmt(data.totalRevenue)}</Text></View>
          <View style={s.totalBox}><Text style={s.totalLabel}>Dépenses</Text><Text style={[s.totalValue, { color: '#dc2626' }]}>{fmt(data.totalExpenses)}</Text></View>
          <View style={s.totalBox}><Text style={s.totalLabel}>Résultat net</Text><Text style={[s.totalValue, { color: net >= 0 ? '#111111' : '#dc2626' }]}>{fmt(net)}</Text></View>
        </View>

        <Text style={s.sectionTitle}>Recettes par catégorie</Text>
        {data.revenueByCategory.length === 0 ? <Text style={s.small}>Aucune recette</Text> : data.revenueByCategory.map((c, i) => (
          <View key={i} style={s.row}><Text>{c.label}</Text><Text style={{ fontFamily: 'Helvetica-Bold', color: '#16a34a' }}>{fmt(c.amount)}</Text></View>
        ))}

        <Text style={s.sectionTitle}>Dépenses par catégorie</Text>
        {data.expenseByCategory.length === 0 ? <Text style={s.small}>Aucune dépense</Text> : data.expenseByCategory.map((c, i) => (
          <View key={i} style={s.row}><Text>{c.label}</Text><Text style={{ fontFamily: 'Helvetica-Bold', color: '#dc2626' }}>{fmt(c.amount)}</Text></View>
        ))}

        <Text style={s.footer}>Document généré le {data.generatedAt} — {data.agencyName}</Text>
      </Page>
    </Document>
  )
}
