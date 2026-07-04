import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users, Search } from 'lucide-react'
import ClientsListSwipeable from './ClientsListSwipeable'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  // « meilleurs » / « a_risque » sont des segments calculés (pas des statuts en
  // base) → on ne les passe pas à un .eq(), on filtre en mémoire plus bas.
  const isSegment = status === 'meilleurs' || status === 'a_risque'

  let query = supabase.from('clients').select('*').order('last_name')

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
    )
  }
  if (status && !isSegment) query = query.eq('status', status)

  const { data: clientsRaw } = await query

  // Agrégats de fiabilité / valeur par client (locations soldées, impayés,
  // litiges) — sert aux segments « meilleurs » et « à risque » + compteurs.
  const { data: resAgg } = await supabase
    .from('reservations')
    .select('client_id, status, payment_status, deposit_status, total_price')

  type Agg = { completed: number; unpaid: number; litige: number; ca: number }
  const byClient = new Map<string, Agg>()
  for (const r of resAgg ?? []) {
    if (!r.client_id) continue
    const a = byClient.get(r.client_id) ?? { completed: 0, unpaid: 0, litige: 0, ca: 0 }
    if (r.status === 'terminee') { a.completed++; a.ca += r.total_price ?? 0 }
    if (r.status === 'terminee' && r.payment_status && r.payment_status !== 'paye') a.unpaid++
    if (r.deposit_status === 'litigieuse') a.litige++
    byClient.set(r.client_id, a)
  }

  // À risque : blacklisté, ou au moins un impayé / litige avéré.
  const isRisk = (c: { id: string; status: string }) => {
    const a = byClient.get(c.id)
    return c.status === 'blackliste' || (a ? a.unpaid > 0 || a.litige > 0 : false)
  }
  // Meilleurs : VIP, ou ≥ 3 locations soldées sans aucun impayé ni litige.
  const isBest = (c: { id: string; status: string }) => {
    const a = byClient.get(c.id)
    return c.status === 'vip' || (a ? a.completed >= 3 && a.unpaid === 0 && a.litige === 0 : false)
  }

  let clients = clientsRaw ?? []
  if (status === 'meilleurs') clients = clients.filter(isBest)
  if (status === 'a_risque')  clients = clients.filter(isRisk)

  // Compteurs par statut / segment (sur l'ensemble, indépendamment de la recherche)
  const { data: allClients } = await supabase.from('clients').select('id, status')
  const counts = {
    total:      allClients?.length ?? 0,
    vip:        allClients?.filter(c => c.status === 'vip').length ?? 0,
    blackliste: allClients?.filter(c => c.status === 'blackliste').length ?? 0,
    meilleurs:  allClients?.filter(isBest).length ?? 0,
    aRisque:    allClients?.filter(isRisk).length ?? 0,
  }

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {counts.total} client{counts.total !== 1 ? 's' : ''}
            {counts.vip > 0 && <span className="ml-2 font-semibold text-black">· {counts.vip} VIP</span>}
            {counts.blackliste > 0 && <span className="ml-2 text-red-500">· {counts.blackliste} blacklisté{counts.blackliste > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors text-sm active:scale-[.98]"
        >
          <Plus className="w-4 h-4" />
          Nouveau
        </Link>
      </div>

      {/* Recherche */}
      <form method="get" className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Rechercher par nom, téléphone, email…"
          className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </form>

      {/* Filtres rapides */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Tous', value: undefined },
          { label: '★ VIP', value: 'vip' },
          { label: `◆ Meilleurs${counts.meilleurs > 0 ? ` · ${counts.meilleurs}` : ''}`, value: 'meilleurs' },
          { label: `▲ À risque${counts.aRisque > 0 ? ` · ${counts.aRisque}` : ''}`, value: 'a_risque' },
          { label: '⚠ Blacklisté', value: 'blackliste' },
        ].map(f => (
          <Link
            key={f.label}
            href={f.value ? `/clients?status=${f.value}` : '/clients'}
            className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px] flex items-center ${
              status === f.value || (!status && !f.value)
                ? 'bg-[#111111] text-white'
                : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Liste */}
      {!clients || clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">
            {q ? `Aucun résultat pour « ${q} »` : 'Aucun client enregistré'}
          </p>
          {!q && (
            <Link
              href="/clients/new"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-2"
            >
              <Plus className="w-4 h-4" /> Ajouter le premier client
            </Link>
          )}
        </div>
      ) : (
        <ClientsListSwipeable clients={clients} />
      )}
    </div>
  )
}
