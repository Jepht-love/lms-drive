import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, formatDate } from '@/lib/utils'
import { INFRACTION_STATUS, infractionTypeLabel } from '@/lib/incidents'
import InfractionActions from './InfractionActions'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</span>
      <div className="text-sm font-semibold text-gray-900 text-right">{children}</div>
    </div>
  )
}

export default async function InfractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const { data: inf } = await supabase
    .from('infractions')
    .select('*, vehicles(plate, brand, model), clients(id, first_name, last_name, email, phone)')
    .eq('id', id).single()
  if (!inf) notFound()

  const v = Array.isArray(inf.vehicles) ? inf.vehicles[0] : inf.vehicles
  const c = Array.isArray(inf.clients) ? inf.clients[0] : inf.clients
  const st = INFRACTION_STATUS[inf.status] ?? INFRACTION_STATUS.en_attente

  let internalName: string | null = null
  if (inf.internal_user_id) {
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', inf.internal_user_id).single()
    internalName = p?.full_name ?? null
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, file_url, file_type')
    .eq('entity_id', inf.vehicle_id)
    .eq('subcategory', 'infraction')
    .order('created_at', { ascending: false })

  const total = (inf.amount ?? 0) + (inf.admin_fees ?? 0)

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/incidents/infractions" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Infractions
      </BackButton>

      {/* Hero */}
      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
            <h1 className="text-white text-lg font-extrabold mt-2">{infractionTypeLabel(inf.type)}</h1>
            <p className="text-white/50 text-sm mt-0.5">{v?.brand} {v?.model} · {v?.plate}</p>
          </div>
          <div className="text-right">
            <p className="text-white text-2xl font-black">{formatPrice(total)}</p>
            {inf.admin_fees > 0 && <p className="text-white/40 text-xs">dont {formatPrice(inf.admin_fees)} frais</p>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <InfractionActions id={inf.id} status={inf.status} hasClientEmail={!!c?.email} />

      {/* Détails */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <Row label="Date infraction">
          {formatDate(inf.infraction_date)}{inf.infraction_time ? ` à ${inf.infraction_time.slice(0, 5)}` : ''}
        </Row>
        <Row label="Responsable">
          {c ? `${c.first_name} ${c.last_name}` : internalName ? `${internalName} (interne)` : 'Utilisation interne'}
        </Row>
        {c?.email && <Row label="Email client">{c.email}</Row>}
        {c?.phone && <Row label="Téléphone">{c.phone}</Row>}
        {inf.reference && <Row label="Référence">{inf.reference}</Row>}
        <Row label="Montant amende">{formatPrice(inf.amount)}</Row>
        {inf.points_lost > 0 && <Row label="Points retirés">{inf.points_lost}</Row>}
        {inf.reception_date && <Row label="Réception avis">{formatDate(inf.reception_date)}</Row>}
        {inf.transmission_date && <Row label="Transmis le">{formatDate(inf.transmission_date)}</Row>}
        {inf.payment_date && (
          <Row label="Réglé le">
            {formatDate(inf.payment_date)}{inf.paid_by ? ` · ${inf.paid_by === 'agence' ? 'par l\'agence' : 'par le client'}` : ''}
          </Row>
        )}
      </div>

      {inf.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700/70 mb-1.5">Notes</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{inf.notes}</p>
        </div>
      )}

      {docs && docs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Justificatifs</p>
          <div className="space-y-2">
            {docs.map(doc => (
              <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-[#111111] hover:text-gray-700 transition-colors">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{doc.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
