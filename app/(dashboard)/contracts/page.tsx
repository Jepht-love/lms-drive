import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ChevronRight, CheckCircle2, Clock, Lock, Search } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Config statut contrat ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bar: string; badge: string; icon: React.ReactNode }> = {
  brouillon: { label: 'Brouillon', bar: 'bg-gray-200',   badge: 'bg-gray-100 text-gray-500',    icon: <FileText className="w-3.5 h-3.5" /> },
  a_signer:  { label: 'À signer',  bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700',   icon: <Clock className="w-3.5 h-3.5" /> },
  signe:     { label: 'Signé',     bar: 'bg-green-500',  badge: 'bg-green-50 text-green-700',   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cloture:   { label: 'Clôturé',   bar: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600',    icon: <Lock className="w-3.5 h-3.5" /> },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const supabase = await createClient()

  // Compteurs
  const { data: allContracts } = await supabase.from('contracts').select('status')
  const counts: Record<string, number> = {}
  for (const c of allContracts ?? []) counts[c.status] = (counts[c.status] ?? 0) + 1

  let query = supabase
    .from('contracts')
    .select(
      `*, reservation:reservations(
        reservation_number, start_datetime, end_datetime,
        vehicle:vehicles(plate, brand, model),
        client:clients(first_name, last_name)
      )`
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: rawContracts } = await query

  const needle = q?.trim().toLowerCase()
  const contracts = needle
    ? (rawContracts ?? []).filter(c => {
        const r = c.reservation as any
        const v = r?.vehicle
        const cl = r?.client
        const haystack = [
          c.contract_number, v?.plate, v?.brand, v?.model, cl?.first_name, cl?.last_name,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(needle)
      })
    : (rawContracts ?? [])

  const total   = allContracts?.length ?? 0
  const aSigner = counts['a_signer'] ?? 0

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div>
        <h1 className="text-xl font-black text-gray-900">Contrats</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {total} contrat{total !== 1 ? 's' : ''}
          {aSigner > 0 && (
            <span className="ml-2 text-amber-600 font-semibold">· {aSigner} à signer</span>
          )}
        </p>
      </div>

      {/* Recherche */}
      <form method="get" className="relative">
        {status && <input type="hidden" name="status" value={status} />}
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Rechercher par n°, véhicule, client…"
          className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </form>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <Link
          href="/contracts"
          className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
            !status ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          Tous ({total})
        </Link>
        {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
          const count = counts[s] ?? 0
          if (count === 0 && status !== s) return null
          return (
            <Link
              key={s}
              href={`/contracts?status=${s}`}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                status === s ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {cfg.label} ({count})
            </Link>
          )
        })}
      </div>

      {/* Liste */}
      {!contracts || contracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">
            {needle ? `Aucun résultat pour « ${q} »` : 'Aucun contrat'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {contracts.map(c => {
            const r   = c.reservation as any
            const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.brouillon

            return (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="flex items-stretch hover:bg-gray-50/80 transition-colors"
              >
                {/* Barre statut */}
                <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />

                <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-4">
                  {/* Icône statut */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
                    {cfg.icon}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">{c.contract_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {c.email_sent_at && (
                        <span className="text-[10px] text-green-600 font-semibold">✓ Email envoyé</span>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-sm">
                      <span>{r?.vehicle?.brand} {r?.vehicle?.model}</span>
                      <span className="font-mono font-normal text-gray-400 text-xs ml-1.5">{r?.vehicle?.plate}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r?.client?.first_name} {r?.client?.last_name}
                    </p>
                  </div>

                  {/* Date + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r?.start_datetime && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-700">
                          {format(new Date(r.start_datetime), 'd MMM', { locale: fr })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(r.start_datetime), 'HH:mm')}
                        </p>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
