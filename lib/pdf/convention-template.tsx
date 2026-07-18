import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConventionData {
  contractNumber: string
  ownerName: string
  ownerSiret?: string | null
  ownerAddress?: string | null
  ownerPhone?: string | null
  ownerEmail?: string | null
  ownerLogoUrl?: string | null
  partnerName: string
  partnerContact?: string | null
  partnerPhone?: string | null
  partnerSiret?: string | null
  partnerAddress?: string | null
  vehicleBrand?: string | null
  vehicleModel?: string | null
  vehicleVersion?: string | null
  vehiclePlate?: string | null
  vehicleColor?: string | null
  startDate?: string | null
  endDateExpected?: string | null
  rentalCost?: number | null
  depositAmount?: number | null
  partnerSignature?: string
  signedAt?: string
}

function fmtDate(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dt }
}

function fmtPrice(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// Clauses de mise à disposition inter-agences — mêmes termes que l'aperçu écran.
function conventionClauses(partnerName: string, depositAmount: number) {
  return [
    { title: '1 — Objet', body: `Le propriétaire met le véhicule désigné ci-dessus à la disposition de ${partnerName} (le bénéficiaire) pour la période indiquée, dans le cadre d'une coopération inter-agences.` },
    { title: "2 — Restitution dans l'état", body: `Le bénéficiaire s'engage à restituer le véhicule dans l'état constaté à l'état des lieux de départ, propre et avec le même niveau de carburant, sauf usure normale.` },
    { title: '3 — Responsabilité & sinistres', body: `Pendant toute la durée de la mise à disposition, le bénéficiaire est responsable du véhicule. Tout dommage, infraction ou sinistre survenu durant cette période est à sa charge et constaté à l'état des lieux de retour.` },
    { title: '4 — Assurance', body: `Le bénéficiaire garantit que le véhicule est couvert par une assurance valide pendant la mise à disposition, et fait son affaire de toute déclaration nécessaire en cas de sinistre.` },
    { title: '5 — Caution', body: `Une caution de ${fmtPrice(depositAmount)} peut être retenue en garantie de la bonne restitution du véhicule et de la couverture d'éventuels frais (dommages, carburant, kilométrage).` },
    { title: '6 — États des lieux', body: `Les états des lieux de départ et de retour, photos horodatées à l'appui, font foi entre les parties pour constater l'état du véhicule à la remise et à la reprise.` },
  ]
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 36, color: '#1e293b', backgroundColor: '#ffffff' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid #2563eb' },
  logo: { height: 40, objectFit: 'contain', marginBottom: 4 },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2563eb' },
  meta: { fontSize: 8, color: '#94a3b8', marginTop: 1 },
  ref: { textAlign: 'right' },
  refNumber: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1e293b' },
  refSub: { fontSize: 9, color: '#64748b', marginTop: 2 },

  section: { marginBottom: 14 },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, paddingBottom: 3, borderBottom: '1px solid #e2e8f0',
  },

  partiesRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  partyBox: { flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 4 },
  partyLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  partyLine: { fontSize: 8, color: '#64748b', marginTop: 1 },

  vehicleBox: { backgroundColor: '#111111', padding: 12, borderRadius: 4, marginBottom: 12 },
  vehicleLabel: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  vehicleName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  vehicleMeta: { fontSize: 9, color: '#cbd5e1', marginTop: 2 },

  gridRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  gridBox: { flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 4, alignItems: 'center' },
  gridLabel: { fontSize: 8, color: '#64748b', marginBottom: 3 },
  gridValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

  articleBlock: { marginBottom: 7 },
  articleTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 2 },
  articleBody: { fontSize: 7.5, color: '#475569', lineHeight: 1.4 },

  signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigBox: { width: '47%', borderTop: '1px solid #e2e8f0', paddingTop: 6 },
  sigLabel: { fontSize: 8, color: '#64748b', textAlign: 'center', marginBottom: 4 },
  sigImage: { height: 55, objectFit: 'contain', marginBottom: 3 },
  sigPlaceholder: { height: 55, marginBottom: 3 },
  sigDate: { fontSize: 7, color: '#94a3b8', textAlign: 'center' },
})

// ─── Document ────────────────────────────────────────────────────────────────

export function ConventionPDF({ data }: { data: ConventionData }) {
  const clauses = conventionClauses(data.partnerName, data.depositAmount ?? 0)
  const vehicleTitle = [data.vehicleBrand, data.vehicleModel, data.vehicleVersion].filter(Boolean).join(' ')

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* En-tête */}
        <View style={s.header}>
          <View>
            {data.ownerLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.ownerLogoUrl} style={s.logo} />
            ) : (
              <Text style={s.company}>{data.ownerName}</Text>
            )}
            {data.ownerSiret ? <Text style={s.meta}>SIRET : {data.ownerSiret}</Text> : null}
            {data.ownerAddress ? <Text style={s.meta}>{data.ownerAddress}</Text> : null}
            {data.ownerPhone ? <Text style={s.meta}>{data.ownerPhone}</Text> : null}
          </View>
          <View style={s.ref}>
            <Text style={s.refNumber}>{data.contractNumber}</Text>
            <Text style={s.refSub}>Convention de mise à disposition</Text>
            <Text style={s.refSub}>inter-agences</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={s.partiesRow}>
          <View style={s.partyBox}>
            <Text style={s.partyLabel}>Propriétaire</Text>
            <Text style={s.partyName}>{data.ownerName}</Text>
            {data.ownerAddress ? <Text style={s.partyLine}>{data.ownerAddress}</Text> : null}
            {data.ownerPhone ? <Text style={s.partyLine}>{data.ownerPhone}</Text> : null}
          </View>
          <View style={s.partyBox}>
            <Text style={s.partyLabel}>Bénéficiaire (agence partenaire)</Text>
            <Text style={s.partyName}>{data.partnerName}</Text>
            {data.partnerContact ? <Text style={s.partyLine}>{data.partnerContact}</Text> : null}
            {data.partnerPhone ? <Text style={s.partyLine}>{data.partnerPhone}</Text> : null}
            {data.partnerSiret ? <Text style={s.partyLine}>SIRET : {data.partnerSiret}</Text> : null}
          </View>
        </View>

        {/* Véhicule */}
        <View style={s.vehicleBox}>
          <Text style={s.vehicleLabel}>Véhicule mis à disposition</Text>
          <Text style={s.vehicleName}>{vehicleTitle || 'Véhicule'}</Text>
          <Text style={s.vehicleMeta}>
            {data.vehiclePlate ?? '—'}{data.vehicleColor ? ` · ${data.vehicleColor}` : ''}
          </Text>
        </View>

        {/* Période + valeur */}
        <View style={s.gridRow}>
          <View style={s.gridBox}>
            <Text style={s.gridLabel}>Départ</Text>
            <Text style={s.gridValue}>{fmtDate(data.startDate)}</Text>
          </View>
          <View style={s.gridBox}>
            <Text style={s.gridLabel}>Retour prévu</Text>
            <Text style={s.gridValue}>{fmtDate(data.endDateExpected)}</Text>
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={s.gridBox}>
            <Text style={s.gridLabel}>Montant convenu</Text>
            <Text style={s.gridValue}>{fmtPrice(data.rentalCost)}</Text>
          </View>
          <View style={s.gridBox}>
            <Text style={s.gridLabel}>Caution</Text>
            <Text style={s.gridValue}>{fmtPrice(data.depositAmount)}</Text>
          </View>
        </View>

        {/* Conditions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Conditions de la mise à disposition</Text>
          {clauses.map((art, i) => (
            <View key={i} style={s.articleBlock}>
              <Text style={s.articleTitle}>Art. {art.title}</Text>
              <Text style={s.articleBody}>{art.body}</Text>
            </View>
          ))}
        </View>

        {/* Signatures */}
        <View style={s.signaturesRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Représentant partenaire</Text>
            {data.partnerSignature ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.partnerSignature} style={s.sigImage} />
            ) : (
              <View style={s.sigPlaceholder} />
            )}
            <Text style={s.sigDate}>{data.signedAt ? fmtDate(data.signedAt) : ''}</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Cachet & Visa propriétaire</Text>
            {data.ownerLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.ownerLogoUrl} style={s.sigImage} />
            ) : (
              <View style={s.sigPlaceholder} />
            )}
            <Text style={s.sigDate}>{data.ownerName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
