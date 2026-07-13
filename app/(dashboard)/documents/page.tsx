import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocumentsClient, { type ReservationDoc } from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role ?? 'employe'
  const isManager = userRole === 'gerant' || userRole === 'associe'

  const { data: docPerm } = await supabase
    .from('profiles')
    .select('allowed_doc_categories')
    .eq('id', user.id)
    .maybeSingle()
  const allowedDocCats = (docPerm as { allowed_doc_categories?: string[] | null } | null)?.allowed_doc_categories ?? null
  const ALL_CATS = ['entreprise', 'vehicule', 'client', 'partenaire']
  const visibleCategories = isManager || !allowedDocCats ? ALL_CATS : allowedDocCats

  const [
    { data: documents },
    { data: vehicles },
    { data: clients },
    { data: partners },
    { data: reservations },
    { data: allContracts },
    { data: allInvoices },
  ] = await Promise.all([
    supabase
      // select('*') : tolérant aux colonnes de la migration 050 (status, version,
      // supersedes_id, is_current) tant qu'elle n'a pas été exécutée à la main.
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .eq('is_active', true)
      .order('brand'),
    supabase
      .from('clients')
      .select('id, first_name, last_name')
      .order('last_name'),
    supabase
      .from('partner_agencies')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('reservations')
      .select('id, reservation_number, status, start_datetime, end_datetime, clients(first_name, last_name), vehicles(brand, model, plate)')
      .order('start_datetime', { ascending: false }),
    supabase
      .from('contracts')
      .select('id, contract_number, reservation_id, status, pdf_storage_path'),
    supabase
      .from('invoices')
      .select('id, invoice_number, reservation_id, pdf_storage_path'),
  ])

  // Signed URLs pour les PDFs (managers uniquement, bucket privé)
  let reservationDocs: ReservationDoc[] = []
  if (isManager) {
    const contractPaths = (allContracts ?? []).filter(c => c.pdf_storage_path).map(c => c.pdf_storage_path as string)
    const invoicePaths  = (allInvoices ?? []).filter(i => i.pdf_storage_path).map(i => i.pdf_storage_path as string)

    const [{ data: cSigned }, { data: iSigned }] = await Promise.all([
      contractPaths.length > 0
        ? supabase.storage.from('contracts-pdf').createSignedUrls(contractPaths, 3600)
        : Promise.resolve({ data: [] as Array<{ path: string; signedUrl: string }> }),
      invoicePaths.length > 0
        ? supabase.storage.from('contracts-pdf').createSignedUrls(invoicePaths, 3600)
        : Promise.resolve({ data: [] as Array<{ path: string; signedUrl: string }> }),
    ])

    const cMap = new Map((cSigned ?? []).map(d => [d.path, d.signedUrl]))
    const iMap = new Map((iSigned ?? []).map(d => [d.path, d.signedUrl]))

    reservationDocs = (reservations ?? []).map(r => {
      const clientData = r.clients as unknown as { first_name: string; last_name: string } | null
      const vehicleData = r.vehicles as unknown as { brand: string; model: string; plate: string } | null
      const contract = (allContracts ?? []).find(ct => ct.reservation_id === r.id) ?? null
      const invoice  = (allInvoices ?? []).find(inv => inv.reservation_id === r.id) ?? null
      return {
        id: r.id,
        reservation_number: r.reservation_number,
        status: (r.status as string) ?? 'option',
        start_datetime: r.start_datetime as string,
        end_datetime: r.end_datetime as string,
        client_name:   clientData  ? `${clientData.first_name} ${clientData.last_name}` : 'Client inconnu',
        vehicle_label: vehicleData ? `${vehicleData.brand} ${vehicleData.model} · ${vehicleData.plate}` : 'Véhicule inconnu',
        contract_number:  contract?.contract_number ?? null,
        contract_pdf_url: contract?.pdf_storage_path ? (cMap.get(contract.pdf_storage_path) ?? null) : null,
        contract_status:  contract?.status ?? null,
        invoice_number:   invoice?.invoice_number ?? null,
        invoice_pdf_url:  invoice?.pdf_storage_path ? (iMap.get(invoice.pdf_storage_path) ?? null) : null,
      }
    })
  }

  const visibleDocuments = (documents ?? []).filter(d => visibleCategories.includes(d.category))

  // URLs signées pour chaque document archivé. Deux formats coexistent :
  // - Ancien : URL publique complète (ex-getPublicUrl) → regex extrait bucket+path
  // - Nouveau : chemin brut (ex: "infractions/sub/file.pdf") → bucket = 'documents'
  const docSignedUrls: Record<string, string> = {}
  const byBucket = new Map<string, { docId: string; path: string }[]>()
  for (const d of visibleDocuments) {
    const url = d.file_url as string | null
    if (!url) continue
    const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/)
    let bucket: string
    let path: string
    if (m) {
      bucket = m[1]
      path = decodeURIComponent(m[2])
    } else if (!url.startsWith('http')) {
      bucket = 'documents'
      path = decodeURIComponent(url)
    } else {
      continue
    }
    const arr = byBucket.get(bucket) ?? []
    arr.push({ docId: d.id, path })
    byBucket.set(bucket, arr)
  }
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, entries]) => {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrls(entries.map(e => e.path), 3600)
      const signedByPath = new Map((data ?? []).map(s => [s.path, s.signedUrl]))
      for (const e of entries) {
        const signed = signedByPath.get(e.path)
        if (signed) docSignedUrls[e.docId] = signed
      }
    })
  )

  return (
    <DocumentsClient
      documents={visibleDocuments}
      vehicles={vehicles ?? []}
      clients={clients ?? []}
      partners={partners ?? []}
      userRole={userRole}
      visibleCategories={visibleCategories}
      reservationDocs={reservationDocs}
      docSignedUrls={docSignedUrls}
    />
  )
}
