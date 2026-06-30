import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { SinistrePDF, type SinistrePDFData } from '@/lib/pdf/sinistre-template'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: acc } = await supabase
    .from('accidents')
    .select('*, vehicles(brand, model, plate), clients(first_name, last_name), profiles(full_name)')
    .eq('id', id)
    .single()
  if (!acc) return NextResponse.json({ error: 'Sinistre introuvable' }, { status: 404 })

  const v = Array.isArray(acc.vehicles) ? acc.vehicles[0] : acc.vehicles
  const c = Array.isArray(acc.clients)  ? acc.clients[0]  : acc.clients
  const p = Array.isArray(acc.profiles) ? acc.profiles[0] : acc.profiles

  const driver = c
    ? `${c.first_name} ${c.last_name}`
    : (p?.full_name ?? 'Conducteur inconnu')

  const data: SinistrePDFData = {
    dossier_number:       acc.dossier_number ?? null,
    accident_date:        acc.accident_date,
    generated_at:         new Date().toISOString(),
    vehicle:              { brand: v?.brand ?? '', model: v?.model ?? '', plate: v?.plate ?? '' },
    driver,
    driver_type:          c ? 'client' : 'interne',
    description:          acc.description ?? '',
    repair_cost:          acc.repair_cost ?? 0,
    insurance_covered:    acc.insurance_covered ?? false,
    insurance_amount:     acc.insurance_amount ?? 0,
    deposit_retained:     acc.deposit_retained ?? 0,
    client_responsibility: acc.client_responsibility ?? false,
    status:               acc.status,
    notes:                acc.notes ?? null,
    agency_name:          'LMS Drive',
  }

  const element = createElement(SinistrePDF, { data }) as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)
  const bytes = new Uint8Array(buffer)

  const filename = `sinistre_${acc.accident_date}_${v?.plate ?? id}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_')

  // Archivage auto dans Documents
  try {
    const path = `vehicule/sinistres/${id}.pdf`
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const existing = await supabase.from('documents').select('id').eq('entity_id', id).eq('subcategory', 'rapport_sinistre').maybeSingle()
      if (!existing.data) {
        await supabase.from('documents').insert({
          category: 'vehicule', subcategory: 'rapport_sinistre',
          name: `Rapport sinistre — ${v?.brand ?? ''} ${v?.model ?? ''} (${acc.accident_date})`,
          file_url: publicUrl, file_type: 'application/pdf',
          entity_id: acc.vehicle_id, entity_type: 'vehicle',
          is_auto_generated: true, created_by: user.id,
        })
      }
    }
  } catch { /* archivage non bloquant */ }

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
