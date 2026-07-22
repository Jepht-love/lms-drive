import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgencySettings } from '@/lib/contracts/agency'
import type { ContractData, InspectionPDFData } from '@/lib/pdf/contract-template'
import { readFileSync } from 'fs'
import { join } from 'path'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export function loadLogoDataUrl(): string | null {
  try {
    const buf = readFileSync(join(process.cwd(), 'public', 'logo.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** Cachet/tampon officiel (coordonnées + SIRET) apposé dans l'encart « Cachet & Visa ». */
export function loadCachetDataUrl(): string | null {
  try {
    const buf = readFileSync(join(process.cwd(), 'public', 'cachet-lms.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** Fond du schéma EDL (le même détourage que l'app) pour les pages EDL du PDF. */
export function loadEdlSchemaDataUrl(): string | null {
  try {
    const buf = readFileSync(join(process.cwd(), 'public', 'edl', 'vehicle-blueprint-v3.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function fetchPhotoAsDataUrl(
  supabase: SupabaseServer,
  storagePath: string,
  bucket = 'vehicle-photos',
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath)
    if (error || !data) return null
    const buf = Buffer.from(await data.arrayBuffer())
    const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpeg'
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export interface BuiltContractData {
  pdfData: ContractData
  contract: any
  reservation: any
  vehicle: any
  client: any
}

/**
 * Assemble la totalité des données du contrat PDF (parties, véhicule, tarifs,
 * LES DEUX états des lieux départ + retour avec photos/signatures, documents
 * d'identité, agence). Source unique utilisée par generate-pdf ET send-email
 * pour que le document téléchargé et le document envoyé par mail soient identiques.
 */
export async function buildContractPdfData(
  supabase: SupabaseServer,
  contractId: string,
): Promise<BuiltContractData | null> {
  const { data: contract } = await supabase
    .from('contracts')
    .select('*, reservation:reservations(*, vehicle:vehicles(*), client:clients(*))')
    .eq('id', contractId)
    .single()

  if (!contract) return null

  const r = (contract as any).reservation
  const v = r?.vehicle
  const c = r?.client

  // États des lieux complets (départ + retour)
  const { data: rawInspections } = await supabase
    .from('inspections')
    .select('id, type, km_reading, fuel_range_km, exterior_cleanliness, interior_cleanliness, damaged_zones, client_signature_svg, agent_signature_svg, signed_at')
    .eq('contract_id', contractId)
    .in('type', ['depart', 'arrivee'])
    .order('signed_at')

  // Signature de la facture de restitution : requête séparée et tolérante à
  // l'absence de colonne (migration 059 pas encore appliquée) — ne casse pas la
  // génération de PDF si le champ n'existe pas.
  const invoiceSigById = new Map<string, string>()
  try {
    const { data: sigs } = await supabase
      .from('inspections')
      .select('id, invoice_signature_svg')
      .eq('contract_id', contractId)
    for (const s of sigs ?? []) {
      const v = (s as { invoice_signature_svg?: string | null }).invoice_signature_svg
      if (v) invoiceSigById.set(s.id, v)
    }
  } catch { /* colonne absente : facture non signée dans le PDF */ }

  // Perf : les EDL (départ + retour) et leurs photos sont assemblés EN PARALLÈLE.
  // Avant, jusqu'à 2×8 = 16 photos étaient téléchargées une par une depuis le
  // storage (≈14 s pour générer le PDF). On lance tous les téléchargements de
  // front tout en conservant l'ordre (Promise.all préserve l'ordre du tableau).
  const inspectionData: InspectionPDFData[] = await Promise.all(
    (rawInspections ?? []).map(async (insp): Promise<InspectionPDFData> => {
      const { data: photos } = await supabase
        .from('inspection_photos')
        .select('storage_path, photo_type')
        .eq('inspection_id', insp.id)
        .limit(12)

      const photoUrls = (
        await Promise.all(
          (photos ?? []).slice(0, 8).map(async p => {
            const url = await fetchPhotoAsDataUrl(supabase, p.storage_path)
            return url ? { url, label: p.photo_type } : null
          }),
        )
      ).filter(Boolean) as { url: string; label: string }[]

      // Sépare les vrais dommages des « photos d'élément » (kind:'zone_photo') :
      // ces dernières ne doivent pas gonfler le compteur/table de dommages ni le
      // schéma, mais apparaissent dans la galerie photo du contrat.
      const allZones = (insp.damaged_zones as any[]) ?? []
      const realDamages = allZones.filter(z => z?.kind !== 'zone_photo')
      const zonePhotoUrls = allZones
        .filter(z => z?.kind === 'zone_photo')
        .flatMap((z: any) => ((z.photos as string[]) ?? []).map(url => ({ url, label: z.label ?? 'Élément' })))

      return {
        type: insp.type as 'depart' | 'arrivee',
        kmReading: insp.km_reading ?? 0,
        fuelRangeKm: insp.fuel_range_km ?? 0,
        exteriorCleanliness: insp.exterior_cleanliness ?? 3,
        interiorCleanliness: insp.interior_cleanliness ?? 3,
        damagedZones: realDamages,
        clientSignature: insp.client_signature_svg ?? undefined,
        agentSignature: insp.agent_signature_svg ?? undefined,
        invoiceSignature: invoiceSigById.get(insp.id) ?? undefined,
        signedAt: insp.signed_at ?? undefined,
        photos: [...photoUrls, ...zonePhotoUrls],
      }
    }),
  )

  // Documents d'identité du client (bucket client-docs)
  const [idFrontUrl, idBackUrl, licFrontUrl, licBackUrl] = await Promise.all([
    c?.id_doc_front_path  ? fetchPhotoAsDataUrl(supabase, c.id_doc_front_path,  'client-documents') : Promise.resolve(null),
    c?.id_doc_back_path   ? fetchPhotoAsDataUrl(supabase, c.id_doc_back_path,   'client-documents') : Promise.resolve(null),
    c?.license_front_path ? fetchPhotoAsDataUrl(supabase, c.license_front_path, 'client-documents') : Promise.resolve(null),
    c?.license_back_path  ? fetchPhotoAsDataUrl(supabase, c.license_back_path,  'client-documents') : Promise.resolve(null),
  ])

  const clientDocs = [
    idFrontUrl  ? { url: idFrontUrl,  label: 'CNI / Passeport — Recto' } : null,
    idBackUrl   ? { url: idBackUrl,   label: 'CNI / Passeport — Verso' } : null,
    licFrontUrl ? { url: licFrontUrl, label: 'Permis de conduire — Recto' } : null,
    licBackUrl  ? { url: licBackUrl,  label: 'Permis de conduire — Verso' } : null,
  ].filter(Boolean) as { url: string; label: string }[]

  // Historique des prolongations (depuis l'audit) — détail à rappeler dans le contrat.
  // Lecture via client admin pour rester insensible à la RLS de audit_logs.
  let prolongations: { date: string; additionalDays: number; addedAmount: number }[] = []
  if (r?.id) {
    const admin = createAdminClient()
    const { data: prologs } = await admin
      .from('audit_logs')
      .select('metadata, created_at')
      .eq('entity_type', 'reservations')
      .eq('entity_id', r.id)
      .eq('action', 'reservation_prolonged')
      .order('created_at', { ascending: true })
    prolongations = (prologs ?? []).map((l: any) => {
      const m = l.metadata ?? {}
      return {
        date: new Date(l.created_at).toLocaleDateString('fr-FR'),
        additionalDays: Number(m.additional_days ?? 0),
        addedAmount: Number(m.added_amount ?? 0),
      }
    })
  }

  const agency = await getAgencySettings(supabase)
  const logoDataUrl = loadLogoDataUrl()

  const pdfData: ContractData = {
    contractNumber: contract.contract_number,
    reservationNumber: r?.reservation_number ?? '',
    startDatetime: r?.start_datetime ?? '',
    endDatetime: r?.end_datetime ?? '',
    clientName: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
    clientPhone: c?.phone ?? '',
    clientEmail: c?.email ?? undefined,
    clientAddress: c?.address
      ? `${c.address}${c.postal_code ? ', ' + c.postal_code : ''}${c.city ? ' ' + c.city : ''}`
      : undefined,
    clientLicense: c?.license_number ?? undefined,
    vehiclePlate: v?.plate ?? '',
    vehicleBrand: v?.brand ?? '',
    vehicleModel: v?.model ?? '',
    vehicleVersion: v?.version ?? undefined,
    vehicleVin: v?.vin ?? undefined,
    vehicleColor: v?.color ?? undefined,
    vehicleCategory: v?.category ?? undefined,
    isSmartFortwo: v?.model?.toLowerCase().includes('smart') || v?.brand?.toLowerCase().includes('smart') || false,
    dailyPrice: r?.daily_price ?? 0,
    totalPrice: r?.total_price ?? 0,
    kmIncluded: r?.km_included ?? undefined,
    extraKmPrice: r?.extra_km_price ?? undefined,
    depositAmount: r?.deposit_amount ?? undefined,
    depositMethod: r?.deposit_method ?? undefined,
    depositDeducted: r?.deposit_deducted > 0 ? r.deposit_deducted : undefined,
    lateFeeAmount: r?.late_fee_amount > 0 ? r.late_fee_amount : undefined,
    lateMinutes: r?.late_minutes > 0 ? r.late_minutes : undefined,
    extraKmCount: r?.extra_km_count > 0 ? r.extra_km_count : undefined,
    extraKmAmount: r?.extra_km_amount > 0 ? r.extra_km_amount : undefined,
    damageFeeAmount: r?.damage_fee_amount > 0 ? r.damage_fee_amount : undefined,
    prolongations: prolongations.length > 0 ? prolongations : undefined,
    clientSignature: contract.client_signature_svg ?? undefined,
    agentSignature: contract.agent_signature_svg ?? undefined,
    signedAt: contract.signed_at ?? undefined,
    inspections: inspectionData,
    edlSchemaImage: loadEdlSchemaDataUrl() ?? undefined,
    clientDocs,
    agency: {
      companyName: agency.company_name,
      siret: agency.siret,
      address: agency.address,
      phone: agency.phone,
      email: agency.email,
      logoUrl: logoDataUrl,
    },
  }

  return { pdfData, contract, reservation: r, vehicle: v, client: c }
}
