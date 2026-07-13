import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import ClientsListSwipeable from './ClientsListSwipeable'
import AssignStatusButton from './AssignStatusButton'
import SmartSearch from '@/components/ui/SmartSearch'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  // « note_interne » est un segment calculé (pas un statut en base) → on ne le
  // passe pas à un .eq(), on filtre en mémoire plus bas.
  const isSegment = status === 'note_interne'

  let query = supabase.from('clients').select('*').order('last_name')

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
    )
  }
  if (status && !isSegment) query = query.eq('status', status)

  const { data: clientsRaw } = await query

  // Note interne : le gérant / l'équipe a saisi une note sur la fiche client.
  const hasNote = (c: { internal_notes?: string | null }) =>
    !!c.internal_notes && c.internal_notes.trim() !== ''

  let clients = clientsRaw ?? []
  if (status === 'note_interne') clients = clients.filter(hasNote)

  // Compteurs par statut / segment (sur l'ensemble, indépendamment de la recherche)
  const { data: allClients } = await supabase.from('clients').select('id, status, internal_notes, first_name, last_name, phone')
  const assignList = (allClients ?? []).map(c => ({
    id: c.id, first_name: c.first_name, last_name: c.last_name, phone: c.phone, status: c.status,
  }))
  const counts = {
    total:       allClients?.length ?? 0,
    vip:         allClients?.filter(c => c.status === 'vip').length ?? 0,
    particulier: allClients?.filter(c => c.status === 'standard').length ?? 0,
    blackliste:  allClients?.filter(c => c.status === 'blackliste').length ?? 0,
    noteInterne: allClients?.filter(hasNote).length ?? 0,
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
      <form method="get">
        <SmartSearch name="q" placeholder="Rechercher par nom, téléphone, email…" scope="clients" defaultValue={q ?? ''} />
      </form>

      {/* Filtres rapides */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Tous', value: undefined },
          { label: '★ VIP', value: 'vip' },
          { label: `Particulier${counts.particulier > 0 ? ` · ${counts.particulier}` : ''}`, value: 'standard' },
          { label: `✎ Note interne${counts.noteInterne > 0 ? ` · ${counts.noteInterne}` : ''}`, value: 'note_interne' },
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
        <AssignStatusButton clients={assignList} />
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
        <ClientsListSwipeable clients={clients} showNotes={status === 'note_interne'} />
      )}
    </div>
  )
}
