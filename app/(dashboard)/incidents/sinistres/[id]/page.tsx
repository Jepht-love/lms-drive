import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, formatDate } from '@/lib/utils'
import { SINISTRE_STATUS } from '@/lib/incidents'
import SinistreActions from './SinistreActions'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-3">
      <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold flex-shrink-0">{label}</span>
      <div className="text-sm font-semibold text-gray-900 text-right">{children}</div>
    </div>
  )
}

export default async function SinistreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const { data: acc } = await supabase
    .from('accidents')
    .select('*, vehicles(plate, brand, model), clients(id, first_name, last_name)')
    .eq('id', id).single()
  if (!acc) notFound()

  const v = Array.isArray(acc.vehicles) ? acc.vehicles[0] : acc.vehicles
  const c = Array.isArray(acc.clients) ? acc.clients[0] : acc.clients
  const st = SINISTRE_STATUS[acc.status] ?? SINISTRE_STATUS.declare

  let internalName: string | null = null
  if (acc.internal_user_id) {
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', acc.internal_user_id).single()
    internalName = p?.full_name ?? null
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, file_url, file_type')
    .eq('entity_id', acc.vehicle_id)
    .eq('subcategory', 'pv_expertise')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/incidents/sinistres" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Sinistres
      </BackButton>

      {/* Hero */}
      <div className="bg-[#111111] rounded-2xl p-5">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
        <h1 className="text-white text-lg font-extrabold mt-2">
          {v?.brand} {v?.model}
          <span className="text-white/40 text-xs font-mono font-normal ml-2">{v?.plate}</span>
        </h1>
        <p className="text-white/60 text-sm mt-1 leading-relaxed">{acc.description}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-base font-black text-white">{formatPrice(acc.repair_cost)}</div>
            <div className="text-[10px] text-white/50 mt-0.5 uppercase">Réparations</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-base font-black text-white">{formatPrice(acc.insurance_amount)}</div>
            <div className="text-[10px] text-white/50 mt-0.5 uppercase">Assurance</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-base font-black text-white">{formatPrice(acc.deposit_retained)}</div>
            <div className="text-[10px] text-white/50 mt-0.5 uppercase">Caution</div>
          </div>
        </div>
      </div>

      {/* Actions / workflow */}
      <SinistreActions id={acc.id} status={acc.status} />

      {/* Détails */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <Row label="Date sinistre">{formatDate(acc.accident_date)}</Row>
        <Row label="Conducteur">
          {c ? `${c.first_name} ${c.last_name}` : internalName ? `${internalName} (interne)` : 'Utilisation interne'}
        </Row>
        {acc.dossier_number && <Row label="N° dossier">{acc.dossier_number}</Row>}
        <Row label="Couvert assurance">{acc.insurance_covered ? 'Oui' : 'Non'}</Row>
        <Row label="Responsabilité client">{acc.client_responsibility ? 'Oui' : 'Non'}</Row>
      </div>

      {acc.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700/70 mb-1.5">Notes</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{acc.notes}</p>
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
