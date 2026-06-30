import {
  Document, Page, Text, View, StyleSheet, Image,
  Svg, Polygon, Ellipse,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getLegalArticles, getFeesTable, VIDEO_CLAUSE } from '@/lib/contracts/legal-articles'
import { EDL_ZONES, zoneBox, EDL_IMG } from '@/components/vehicle-schema/edl-zones'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DamagedZone {
  id: string
  label: string
  severity: 'rayure' | 'dommage' | 'attention'
  description: string
}

export interface InspectionPDFData {
  type: 'depart' | 'arrivee'
  kmReading: number
  fuelRangeKm: number
  exteriorCleanliness: number
  interiorCleanliness: number
  damagedZones: DamagedZone[]
  clientSignature?: string
  agentSignature?: string
  signedAt?: string
  photos: { url: string; label: string }[]
}

export interface ContractData {
  contractNumber: string
  reservationNumber: string
  startDatetime: string
  endDatetime: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  clientAddress?: string
  clientLicense?: string
  vehiclePlate: string
  vehicleBrand: string
  vehicleModel: string
  vehicleVersion?: string
  vehicleVin?: string
  vehicleColor?: string
  vehicleCategory?: string   // 'sportif' | 'citadine' | etc.
  isSmartFortwo?: boolean
  dailyPrice: number
  totalPrice: number
  kmIncluded?: number
  extraKmPrice?: number
  depositAmount?: number
  depositMethod?: string
  lateFeeAmount?: number
  lateMinutes?: number
  extraKmCount?: number
  extraKmAmount?: number
  damageFeeAmount?: number
  prolongations?: { date: string; additionalDays: number; addedAmount: number }[]
  clientSignature?: string
  agentSignature?: string
  signedAt?: string
  inspections?: InspectionPDFData[]
  edlSchemaImage?: string   // data URL du fond schéma EDL (vehicle-blueprint-v2.png)
  clientDocs?: { url: string; label: string }[]
  agency?: {
    companyName: string
    siret?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    logoUrl?: string | null   // data URL du vrai logo
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 36, color: '#1e293b', backgroundColor: '#ffffff' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid #2563eb' },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2563eb' },
  subtitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  contractRef: { textAlign: 'right', fontSize: 9, color: '#64748b' },
  contractNumber: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1e293b' },

  section: { marginBottom: 14 },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, paddingBottom: 3, borderBottom: '1px solid #e2e8f0',
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 9, color: '#64748b', flex: 1 },
  value: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b', flex: 2, textAlign: 'right' },

  box: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 4, marginBottom: 6 },
  totalBox: {
    backgroundColor: '#eff6ff', padding: 10, borderRadius: 4, marginBottom: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  totalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },

  // Articles juridiques
  articleBlock: { marginBottom: 7 },
  articleTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 2 },
  articleBody: { fontSize: 7.5, color: '#475569', lineHeight: 1.4 },

  // Signatures
  signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  sigBox: { width: '47%', borderTop: '1px solid #e2e8f0', paddingTop: 6 },
  sigLabel: { fontSize: 8, color: '#64748b', textAlign: 'center', marginBottom: 3 },
  sigImage: { height: 55, objectFit: 'contain', marginBottom: 3 },
  sigDate: { fontSize: 7, color: '#94a3b8', textAlign: 'center' },

  // Damage table
  damageHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '4 6', borderRadius: 3, marginBottom: 2 },
  damageRow: { flexDirection: 'row', padding: '3 6', borderBottom: '1px solid #f1f5f9' },
  damageCol1: { width: '35%', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  damageCol2: { width: '20%', fontSize: 8 },
  damageCol3: { width: '45%', fontSize: 8, color: '#64748b' },
  badgeRayure: { color: '#854d0e', backgroundColor: '#fef9c3', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  badgeDommage: { color: '#991b1b', backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  badgeAttention: { color: '#9a3412', backgroundColor: '#fff7ed', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },

  // Photos
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  photoItem: { width: '23%', aspectRatio: 4 / 3 },
  photoLabel: { fontSize: 6, color: '#94a3b8', textAlign: 'center', marginTop: 1 },

  // EDL page
  edlPage: { fontFamily: 'Helvetica', fontSize: 10, padding: 36, color: '#1e293b', backgroundColor: '#ffffff' },
  edlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #0f172a' },
  edlTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  edlSubtitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  metricBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 4, padding: 8, alignItems: 'center' },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'center' },
  metricLabel: { fontSize: 7, color: '#94a3b8', textAlign: 'center', marginTop: 2, textTransform: 'uppercase' },
  edlSigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  edlSigBox: { width: '47%', borderTop: '1px solid #e2e8f0', paddingTop: 6 },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n?: number) {
  return n != null ? `${n.toFixed(2)} €` : '—'
}
function fmtDT(dt: string) {
  try { return format(new Date(dt), 'dd/MM/yyyy HH:mm', { locale: fr }) }
  catch { return dt }
}
function fmtDate(dt?: string) {
  if (!dt) return '—'
  try { return format(new Date(dt), 'dd/MM/yyyy à HH:mm', { locale: fr }) }
  catch { return dt }
}
function stars(n: number, max = 5) {
  return '★'.repeat(Math.min(n, max)) + '☆'.repeat(Math.max(max - n, 0))
}

// ─── Agency stamp ─────────────────────────────────────────────────────────────

function AgencyStamp({ logoUrl, companyName }: { logoUrl?: string | null; companyName: string }) {
  if (logoUrl) {
    return (
      <View style={{ height: 55, alignItems: 'center', justifyContent: 'center' }}>
        <Image src={logoUrl} style={{ maxHeight: 50, maxWidth: 140, objectFit: 'contain' }} />
      </View>
    )
  }
  return (
    <View style={{ height: 55, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ borderWidth: 2, borderColor: '#2563eb', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#2563eb', letterSpacing: 1 }}>{companyName}</Text>
        <View style={{ width: 44, height: 1, backgroundColor: '#2563eb', marginTop: 4 }} />
        <Text style={{ fontSize: 6, color: '#64748b', letterSpacing: 0.5, marginTop: 3 }}>LOCATION DE VÉHICULES</Text>
      </View>
    </View>
  )
}

// ─── Vehicle Schema SVG ───────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, { fill: string; stroke: string }> = {
  ok:        { fill: '#dcfce7', stroke: '#16a34a' },
  rayure:    { fill: '#fef9c3', stroke: '#ca8a04' },
  dommage:   { fill: '#fee2e2', stroke: '#dc2626' },
  attention: { fill: '#fff7ed', stroke: '#ea580c' },
}

/**
 * Schéma EDL « réel » : le même fond détouré que l'app (vehicle-blueprint-v2.png)
 * surchargé des polygones de zones endommagées (mêmes coordonnées que VehicleMap2D,
 * via le module partagé edl-zones). Les zones saines restent transparentes.
 */
function VehicleSchemaImage({ damages, bgImage, size = 250 }: { damages: DamagedZone[]; bgImage?: string; size?: number }) {
  const damagedIds = new Set(damages.map(d => d.id))
  const sevById = new Map(damages.map(d => [d.id, d.severity]))
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {bgImage && <Image src={bgImage} style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }} />}
      <Svg viewBox={`0 0 ${EDL_IMG} ${EDL_IMG}`} style={{ width: size, height: size }}>
        {EDL_ZONES.map((z, i) => {
          if (!damagedIds.has(z.id)) return null
          const c = ZONE_COLORS[sevById.get(z.id) ?? 'attention'] ?? ZONE_COLORS.attention
          if (z.shape === 'ellipse') {
            const b = zoneBox(z)
            return <Ellipse key={i} cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={c.fill} fillOpacity={0.55} stroke={c.stroke} strokeWidth={4} />
          }
          if (z.points) {
            return <Polygon key={i} points={z.points.map(p => p.join(',')).join(' ')} fill={c.fill} fillOpacity={0.55} stroke={c.stroke} strokeWidth={4} />
          }
          return null
        })}
      </Svg>
    </View>
  )
}

function SchemaLegend() {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
      {[
        { color: ZONE_COLORS.ok,        label: 'OK / Aucun dommage' },
        { color: ZONE_COLORS.rayure,    label: 'Rayure' },
        { color: ZONE_COLORS.dommage,   label: 'Dommage' },
        { color: ZONE_COLORS.attention, label: 'À surveiller' },
      ].map(({ color, label }) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <View style={{ width: 10, height: 10, backgroundColor: color.fill, borderWidth: 1, borderColor: color.stroke, borderRadius: 2 }} />
          <Text style={{ fontSize: 7, color: '#64748b' }}>{label}</Text>
        </View>
      ))}
    </View>
  )
}

function DamageTable({ zones }: { zones: DamagedZone[] }) {
  if (zones.length === 0) {
    return (
      <View style={{ padding: '6 8', backgroundColor: '#f0fdf4', borderRadius: 4, marginBottom: 8 }}>
        <Text style={{ fontSize: 9, color: '#16a34a', fontFamily: 'Helvetica-Bold' }}>✓ Aucun dommage signalé</Text>
      </View>
    )
  }

  const badgeStyle = (sev: string) =>
    sev === 'dommage' ? s.badgeDommage : sev === 'rayure' ? s.badgeRayure : s.badgeAttention
  const sevLabel = (sev: string) =>
    sev === 'dommage' ? 'Dommage' : sev === 'rayure' ? 'Rayure' : 'Attention'

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={s.damageHeader}>
        <Text style={[s.damageCol1, { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b' }]}>ZONE</Text>
        <Text style={[s.damageCol2, { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b' }]}>SÉVÉRITÉ</Text>
        <Text style={[s.damageCol3, { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b' }]}>DESCRIPTION</Text>
      </View>
      {zones.map((z, i) => (
        <View key={i} style={[s.damageRow, i % 2 === 0 ? { backgroundColor: '#ffffff' } : { backgroundColor: '#f8fafc' }]}>
          <Text style={s.damageCol1}>{z.label}</Text>
          <View style={s.damageCol2}>
            <Text style={[{ fontSize: 7, fontFamily: 'Helvetica-Bold' }, badgeStyle(z.severity)]}>
              {sevLabel(z.severity)}
            </Text>
          </View>
          <Text style={s.damageCol3}>{z.description || '—'}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── EDL Page ─────────────────────────────────────────────────────────────────

function InspectionPage({ insp, contractNumber, clientName, vehiclePlate, vehicleModel, companyName, logoUrl, edlImage }: {
  insp: InspectionPDFData
  contractNumber: string
  clientName: string
  vehiclePlate: string
  vehicleModel: string
  companyName: string
  logoUrl?: string | null
  edlImage?: string
}) {
  const isDepart = insp.type === 'depart'
  const titleColor = isDepart ? '#2563eb' : '#7c3aed'

  return (
    <Page size="A4" style={s.edlPage}>
      <View style={[s.edlHeader, { borderBottomColor: titleColor }]}>
        <View>
          <Text style={[s.edlTitle, { color: titleColor }]}>
            État des lieux de {isDepart ? 'DÉPART' : 'RETOUR'}
          </Text>
          <Text style={s.edlSubtitle}>
            {vehicleModel} — {vehiclePlate} · Client : {clientName}
          </Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#1e293b' }}>{contractNumber}</Text>
          {insp.signedAt && (
            <Text style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>
              Signé le {fmtDate(insp.signedAt)}
            </Text>
          )}
        </View>
      </View>

      <View style={s.metricsRow}>
        <View style={s.metricBox}>
          <Text style={s.metricValue}>{insp.kmReading.toLocaleString('fr-FR')}</Text>
          <Text style={s.metricLabel}>Kilométrage</Text>
        </View>
        <View style={s.metricBox}>
          <Text style={s.metricValue}>{insp.fuelRangeKm} km</Text>
          <Text style={s.metricLabel}>Autonomie carburant</Text>
        </View>
        <View style={s.metricBox}>
          <Text style={s.metricValue}>{stars(insp.exteriorCleanliness)}</Text>
          <Text style={s.metricLabel}>Propreté ext.</Text>
        </View>
        <View style={s.metricBox}>
          <Text style={s.metricValue}>{stars(insp.interiorCleanliness)}</Text>
          <Text style={s.metricLabel}>Propreté int.</Text>
        </View>
        <View style={[s.metricBox, { backgroundColor: insp.damagedZones.length > 0 ? '#fff7ed' : '#f0fdf4' }]}>
          <Text style={[s.metricValue, { color: insp.damagedZones.length > 0 ? '#ea580c' : '#16a34a' }]}>
            {insp.damagedZones.length}
          </Text>
          <Text style={s.metricLabel}>Dommage(s)</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Schéma du véhicule & dommages constatés</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <View>
          <VehicleSchemaImage damages={insp.damagedZones} bgImage={edlImage} size={250} />
          <SchemaLegend />
        </View>
        <View style={{ flex: 1 }}>
          <DamageTable zones={insp.damagedZones} />
        </View>
      </View>

      {insp.photos.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Photos ({insp.photos.length})</Text>
          <View style={s.photosGrid}>
            {insp.photos.map((p, i) => (
              <View key={i} style={s.photoItem}>
                <Image src={p.url} style={{ width: '100%', borderRadius: 3 }} />
                <Text style={s.photoLabel}>{p.label.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Signatures EDL */}
      <View style={s.edlSigRow}>
        <View style={s.edlSigBox}>
          <Text style={s.sigLabel}>Signature du client</Text>
          {insp.clientSignature ? (
            <Image src={insp.clientSignature} style={s.sigImage} />
          ) : (
            <View style={{ height: 55, backgroundColor: '#f8fafc', borderRadius: 4 }} />
          )}
          {insp.signedAt && <Text style={s.sigDate}>{fmtDate(insp.signedAt)}</Text>}
        </View>
        <View style={s.edlSigBox}>
          <Text style={s.sigLabel}>Pour l'agence</Text>
          <AgencyStamp logoUrl={logoUrl} companyName={companyName} />
        </View>
      </View>

      <Text style={{ fontSize: 7, color: '#cbd5e1', textAlign: 'center', marginTop: 20 }}>
        {contractNumber} — État des lieux {isDepart ? 'départ' : 'retour'} — LMS Drive
      </Text>
    </Page>
  )
}

// ─── Main PDF Component ───────────────────────────────────────────────────────

export function ContractPDF({ data }: { data: ContractData }) {
  const depInsp = data.inspections?.find(i => i.type === 'depart')
  const arrInsp = data.inspections?.find(i => i.type === 'arrivee')
  const hasReturnSig = !!arrInsp?.clientSignature

  const isSport = data.vehicleCategory === 'sportif'
  const fees = getFeesTable(data.vehicleCategory ?? 'citadine', data.isSmartFortwo)
  const articles = getLegalArticles({
    franchise: fees.franchise,
    retardHeure: fees.retard,
    caution: data.depositAmount ?? 0,
  })

  const companyName = data.agency?.companyName ?? 'LMS Drive'
  const logoUrl = data.agency?.logoUrl

  return (
    <Document title={`Contrat ${data.contractNumber}`}>

      {/* ── Page 1 : Contrat principal ── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={{ height: 36, maxWidth: 160, objectFit: 'contain', marginBottom: 4 }} />
            ) : (
              <Text style={s.company}>{companyName}</Text>
            )}
            {data.agency?.siret && <Text style={s.subtitle}>SIRET : {data.agency.siret}</Text>}
            {data.agency?.address && <Text style={s.subtitle}>{data.agency.address}</Text>}
            <Text style={s.subtitle}>Contrat de location de véhicule</Text>
          </View>
          <View style={s.contractRef}>
            <Text style={s.contractNumber}>{data.contractNumber}</Text>
            <Text style={s.subtitle}>Réf. {data.reservationNumber}</Text>
            <Text style={s.subtitle}>Établi le {format(new Date(), 'dd/MM/yyyy', { locale: fr })}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={[s.section, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <View style={[s.box, { width: '47%' }]}>
            <Text style={s.sectionTitle}>Loueur</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{companyName}</Text>
            {data.agency?.siret && <Text style={{ fontSize: 8, color: '#64748b' }}>SIRET : {data.agency.siret}</Text>}
            {data.agency?.address && <Text style={{ fontSize: 8, color: '#64748b' }}>{data.agency.address}</Text>}
            {data.agency?.phone && <Text style={{ fontSize: 8, color: '#64748b' }}>{data.agency.phone}</Text>}
          </View>
          <View style={[s.box, { width: '47%' }]}>
            <Text style={s.sectionTitle}>Locataire</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{data.clientName}</Text>
            <Text style={{ fontSize: 9, color: '#64748b' }}>{data.clientPhone}</Text>
            {data.clientEmail && <Text style={{ fontSize: 8, color: '#64748b' }}>{data.clientEmail}</Text>}
            {data.clientAddress && <Text style={{ fontSize: 8, color: '#64748b' }}>{data.clientAddress}</Text>}
            {data.clientLicense && <Text style={{ fontSize: 8, color: '#64748b' }}>Permis : {data.clientLicense}</Text>}
          </View>
        </View>

        {/* Documents identité client */}
        {data.clientDocs && data.clientDocs.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Documents d'identité du locataire</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {data.clientDocs.map((doc, i) => (
                <View key={i} style={{ width: '23%' }}>
                  <Image src={doc.url} style={{ width: '100%', borderRadius: 3, border: '1px solid #e2e8f0' }} />
                  <Text style={{ fontSize: 6, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>{doc.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Véhicule */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Véhicule loué</Text>
          <View style={s.box}>
            <View style={s.row}>
              <Text style={s.label}>Véhicule</Text>
              <Text style={s.value}>{data.vehicleBrand} {data.vehicleModel} {data.vehicleVersion ?? ''}</Text>
            </View>
            {data.vehicleCategory && (
              <View style={s.row}>
                <Text style={s.label}>Catégorie</Text>
                <Text style={[s.value, { color: isSport ? '#dc2626' : '#2563eb' }]}>
                  {isSport ? 'Véhicule Sportif' : data.isSmartFortwo ? 'Smart Fortwo' : 'Citadine'}
                </Text>
              </View>
            )}
            <View style={s.row}>
              <Text style={s.label}>Immatriculation</Text>
              <Text style={[s.value, { fontFamily: 'Courier', fontSize: 8, color: '#64748b' }]}>{data.vehiclePlate}</Text>
            </View>
            {data.vehicleColor && (
              <View style={s.row}><Text style={s.label}>Couleur</Text><Text style={s.value}>{data.vehicleColor}</Text></View>
            )}
            {data.vehicleVin && (
              <View style={s.row}><Text style={s.label}>VIN</Text><Text style={s.value}>{data.vehicleVin}</Text></View>
            )}
          </View>
        </View>

        {/* Période */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Période de location</Text>
          <View style={[s.box, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <View>
              <Text style={{ fontSize: 8, color: '#64748b' }}>Départ</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>{fmtDT(data.startDatetime)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: '#64748b', textAlign: 'right' }}>Retour prévu</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>{fmtDT(data.endDatetime)}</Text>
            </View>
          </View>
        </View>

        {/* Tarification */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tarification</Text>
          <View style={s.box}>
            <View style={s.row}><Text style={s.label}>Prix par jour</Text><Text style={s.value}>{fmtMoney(data.dailyPrice)}</Text></View>
            {data.kmIncluded && (
              <View style={s.row}><Text style={s.label}>KM inclus / jour</Text><Text style={s.value}>{data.kmIncluded} km</Text></View>
            )}
            {data.extraKmPrice && (
              <View style={s.row}><Text style={s.label}>Supplément KM</Text><Text style={s.value}>{fmtMoney(data.extraKmPrice)} / km</Text></View>
            )}
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Total TTC</Text>
            <Text style={s.totalValue}>{fmtMoney(data.totalPrice)}</Text>
          </View>

          {/* Prolongation(s) — mise à jour du prix sans nouvelle signature */}
          {(data.prolongations?.length ?? 0) > 0 && (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 4, padding: 8, marginTop: 4 }}>
              <Text style={[s.sectionTitle, { color: '#1d4ed8', borderBottom: '1px solid #bfdbfe' }]}>
                Prolongation(s) du contrat
              </Text>
              {data.prolongations!.map((p, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.label}>
                    {p.date} · +{p.additionalDays} jour{p.additionalDays > 1 ? 's' : ''}
                  </Text>
                  <Text style={[s.value, { color: '#1d4ed8' }]}>+{fmtMoney(p.addedAmount)}</Text>
                </View>
              ))}
              <View style={[s.row, { marginTop: 4, paddingTop: 4, borderTop: '1px solid #bfdbfe' }]}>
                <Text style={[s.label, { fontFamily: 'Helvetica-Bold' }]}>Nouveau total après prolongation</Text>
                <Text style={[s.value, { fontFamily: 'Helvetica-Bold', color: '#1d4ed8' }]}>{fmtMoney(data.totalPrice)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Caution */}
        {data.depositAmount && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Caution / Dépôt de garantie</Text>
            <View style={s.box}>
              <View style={s.row}><Text style={s.label}>Montant</Text><Text style={s.value}>{fmtMoney(data.depositAmount)}</Text></View>
              {data.depositMethod && (
                <View style={s.row}><Text style={s.label}>Mode de remise</Text><Text style={s.value}>{data.depositMethod}</Text></View>
              )}
            </View>
          </View>
        )}

        {/* Frais complémentaires */}
        {((data.lateFeeAmount ?? 0) > 0 || (data.extraKmCount ?? 0) > 0 || (data.damageFeeAmount ?? 0) > 0) && (
          <View style={[s.section, { backgroundColor: '#fff7ed', borderRadius: 4, padding: 8 }]}>
            <Text style={[s.sectionTitle, { color: '#9a3412' }]}>Frais complémentaires</Text>
            {(data.lateFeeAmount ?? 0) > 0 && (
              <View style={s.row}>
                <Text style={s.label}>Frais de retard ({data.lateMinutes} min · tol. 60 min)</Text>
                <Text style={[s.value, { color: '#dc2626' }]}>{fmtMoney(data.lateFeeAmount)}</Text>
              </View>
            )}
            {(data.extraKmCount ?? 0) > 0 && (
              <View style={s.row}>
                <Text style={s.label}>Dépassement km ({data.extraKmCount} km × {fmtMoney(data.extraKmPrice)})</Text>
                <Text style={[s.value, { color: '#ea580c' }]}>{fmtMoney(data.extraKmAmount)}</Text>
              </View>
            )}
            {(data.damageFeeAmount ?? 0) > 0 && (
              <View style={s.row}>
                <Text style={s.label}>Dommages constatés à l'état des lieux de retour</Text>
                <Text style={[s.value, { color: '#dc2626' }]}>{fmtMoney(data.damageFeeAmount)}</Text>
              </View>
            )}
            <View style={[s.row, { marginTop: 4, paddingTop: 4, borderTop: '1px solid #fed7aa' }]}>
              <Text style={[s.label, { fontFamily: 'Helvetica-Bold' }]}>Total frais supplémentaires</Text>
              <Text style={[s.value, { fontFamily: 'Helvetica-Bold', color: '#9a3412' }]}>
                {fmtMoney((data.lateFeeAmount ?? 0) + (data.extraKmAmount ?? 0) + (data.damageFeeAmount ?? 0))}
              </Text>
            </View>
          </View>
        )}

        {/* Récapitulatif EDL */}
        {(depInsp || arrInsp) && (
          <View style={[s.section, { backgroundColor: '#f8fafc', borderRadius: 4, padding: 8 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 4 }]}>Récapitulatif des états des lieux</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {depInsp && (
                <View style={{ flex: 1, backgroundColor: '#eff6ff', borderRadius: 3, padding: 6 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#2563eb', marginBottom: 3 }}>ÉTAT DES LIEUX DÉPART</Text>
                  <Text style={{ fontSize: 8 }}>KM : {depInsp.kmReading.toLocaleString('fr-FR')}</Text>
                  <Text style={{ fontSize: 8 }}>Carburant : {depInsp.fuelRangeKm} km</Text>
                  <Text style={{ fontSize: 8, color: depInsp.damagedZones.length > 0 ? '#ea580c' : '#16a34a' }}>
                    {depInsp.damagedZones.length > 0 ? `${depInsp.damagedZones.length} dommage(s) constaté(s)` : '✓ Aucun dommage'}
                  </Text>
                </View>
              )}
              {arrInsp && (
                <View style={{ flex: 1, backgroundColor: '#f5f3ff', borderRadius: 3, padding: 6 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#7c3aed', marginBottom: 3 }}>ÉTAT DES LIEUX RETOUR</Text>
                  <Text style={{ fontSize: 8 }}>KM : {arrInsp.kmReading.toLocaleString('fr-FR')}</Text>
                  <Text style={{ fontSize: 8 }}>Carburant : {arrInsp.fuelRangeKm} km</Text>
                  <Text style={{ fontSize: 8, color: arrInsp.damagedZones.length > 0 ? '#ea580c' : '#16a34a' }}>
                    {arrInsp.damagedZones.length > 0 ? `${arrInsp.damagedZones.length} dommage(s) constaté(s)` : '✓ Aucun dommage'}
                  </Text>
                </View>
              )}
              {!arrInsp && (
                <View style={{ flex: 1, backgroundColor: '#fefce8', borderRadius: 3, padding: 6 }}>
                  <Text style={{ fontSize: 8, color: '#92400e' }}>ÉTAT DES LIEUX RETOUR — En attente</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>
              Les détails complets figurent dans les pages suivantes de ce document.
            </Text>
          </View>
        )}

        {/* ══ Tableau des frais applicables ══ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tableau récapitulatif des frais facturables</Text>
          <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 4 }}>
            Catégorie : {isSport ? 'Véhicule Sportif' : data.isSmartFortwo ? 'Smart Fortwo' : 'Citadine'}
          </Text>
          <View style={s.damageHeader}>
            <Text style={{ width: '72%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b' }}>NATURE DES FRAIS</Text>
            <Text style={{ width: '28%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', textAlign: 'right' }}>MONTANT</Text>
          </View>
          {fees.rows.map((row, i) => (
            <View key={i} style={[s.damageRow, i % 2 === 0 ? { backgroundColor: '#ffffff' } : { backgroundColor: '#f8fafc' },
              i < 2 ? { backgroundColor: isSport ? '#fef2f2' : '#eff6ff' } : {}]}>
              <Text style={{ width: '72%', fontSize: 8 }}>{row.label}</Text>
              <Text style={{ width: '28%', fontSize: 8, fontFamily: i < 2 ? 'Helvetica-Bold' : 'Helvetica', textAlign: 'right',
                color: i < 2 ? (isSport ? '#dc2626' : '#1d4ed8') : '#1e293b' }}>
                {row.value}
              </Text>
            </View>
          ))}
          <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>
            Montants TTC. Franchise applicable par sinistre et par véhicule.
          </Text>
        </View>

        {/* ══ Conditions générales — 14 articles ══ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Conditions générales de location</Text>
          {articles.map((art, i) => (
            <View key={i} style={s.articleBlock}>
              <Text style={s.articleTitle}>Art. {art.title}</Text>
              <Text style={s.articleBody}>{art.body}</Text>
            </View>
          ))}
        </View>

        {/* ══ Clause photo horodatée ══ */}
        <View style={{ backgroundColor: '#eff6ff', borderRadius: 4, padding: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', marginBottom: 3 }}>
            Clause photo horodatée — État des lieux
          </Text>
          <Text style={{ fontSize: 7.5, color: '#1e40af', lineHeight: 1.4 }}>
            {VIDEO_CLAUSE}
          </Text>
        </View>

        {/* ══ Signatures contrat — départ + retour ══ */}
        <View style={s.signaturesRow}>
          <View style={[s.sigBox, hasReturnSig ? { width: '31%' } : {}]}>
            <Text style={s.sigLabel}>Signature locataire — Départ</Text>
            {data.clientSignature
              ? <Image src={data.clientSignature} style={s.sigImage} />
              : <View style={{ height: 55 }} />}
            {data.signedAt && <Text style={s.sigDate}>Le {fmtDT(data.signedAt)}</Text>}
          </View>
          {hasReturnSig && (
            <View style={[s.sigBox, { width: '31%' }]}>
              <Text style={s.sigLabel}>Signature locataire — Retour</Text>
              <Image src={arrInsp!.clientSignature!} style={s.sigImage} />
              {arrInsp?.signedAt && <Text style={s.sigDate}>Le {fmtDT(arrInsp.signedAt)}</Text>}
            </View>
          )}
          <View style={[s.sigBox, hasReturnSig ? { width: '31%' } : {}]}>
            <Text style={s.sigLabel}>Cachet & Visa agence</Text>
            <AgencyStamp logoUrl={logoUrl} companyName={companyName} />
            {data.signedAt && <Text style={s.sigDate}>Le {fmtDT(data.signedAt)}</Text>}
          </View>
        </View>

        <Text style={{ fontSize: 7, color: '#cbd5e1', textAlign: 'center', marginTop: 16 }}>
          {data.contractNumber} — LMS Drive — Contrat de location de véhicule
        </Text>
      </Page>

      {/* ── Pages EDL ── */}
      {depInsp && (
        <InspectionPage
          insp={depInsp}
          contractNumber={data.contractNumber}
          clientName={data.clientName}
          vehiclePlate={data.vehiclePlate}
          vehicleModel={`${data.vehicleBrand} ${data.vehicleModel}`}
          companyName={companyName}
          logoUrl={logoUrl}
          edlImage={data.edlSchemaImage}
        />
      )}
      {arrInsp && (
        <InspectionPage
          insp={arrInsp}
          contractNumber={data.contractNumber}
          clientName={data.clientName}
          vehiclePlate={data.vehiclePlate}
          vehicleModel={`${data.vehicleBrand} ${data.vehicleModel}`}
          companyName={companyName}
          logoUrl={logoUrl}
          edlImage={data.edlSchemaImage}
        />
      )}

    </Document>
  )
}
