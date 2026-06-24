import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Plus, Building2, Phone } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'

export default async function AgenciesPage() {
  const supabase = await createClient()

  const [{ data: agencies }, { data: ops }] = await Promise.all([
    supabase.from('partner_agencies').select('*').eq('is_active', true).order('name'),
    supabase.from('inter_agency_rentals').select('partner_agency_id, status').in('status', ['planifie', 'en_cours', 'termine']),
  ])

  const countByAgency = new Map<string, number>()
  for (const o of ops ?? []) countByAgency.set(o.partner_agency_id, (countByAgency.get(o.partner_agency_id) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/partnerships" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Partenariats
      </BackButton>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">Agences partenaires</h1>
        <Link href="/partnerships/agencies/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors active:scale-[.98]">
          <Plus className="w-4 h-4" /> Ajouter
        </Link>
      </div>

      {!agencies || agencies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucune agence partenaire</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agencies.map(a => {
            const n = countByAgency.get(a.id) ?? 0
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900">{a.name}</p>
                    {a.contact_name && <p className="text-xs text-gray-500 mt-0.5">{a.contact_name}</p>}
                    {a.phone && (
                      <a href={`tel:${a.phone}`} className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {a.phone}
                      </a>
                    )}
                  </div>
                  {n > 0 && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                      {n} op. active{n > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
