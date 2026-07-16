'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, Search, Star, Ban, RotateCcw, X } from 'lucide-react'
import { updateClientStatus } from '@/lib/actions/clients'
import { useToast } from '@/components/Toast'
import type { ClientStatus } from '@/types/database'

interface MiniClient { id: string; first_name: string; last_name: string; phone: string; status: string }

// 2ᵉ façon d'attribuer un statut (demande gérant) : au lieu d'ouvrir la fiche,
// on part du statut → on sélectionne un client déjà répertorié → on lui applique
// VIP / Particulier / Blacklisté. La 1ʳᵉ façon reste la fiche client.
export default function AssignStatusButton({ clients }: { clients: MiniClient[] }) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<MiniClient | null>(null)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const base = needle
      ? clients.filter(c => `${c.first_name} ${c.last_name} ${c.phone}`.toLowerCase().includes(needle))
      : clients
    return base.slice(0, 40)
  }, [q, clients])

  function close() { setOpen(false); setSelected(null); setReason(''); setQ('') }

  function assign(status: ClientStatus, blacklistReason?: string) {
    if (!selected) return
    startTransition(async () => {
      const r = await updateClientStatus(selected.id, status, blacklistReason)
      if (r?.error) { toast(r.error, 'error'); return }
      const msg: Record<ClientStatus, string> = {
        vip: 'Client marqué VIP',
        blackliste: 'Client blacklisté',
        standard: 'Statut réinitialisé (Particulier)',
      }
      toast(msg[status] ?? 'Statut mis à jour')
      close()
      router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm min-h-[44px]"
      >
        <UserCog className="w-4 h-4" /> Attribuer un statut
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
          <button type="button" aria-label="Fermer" onClick={close} className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full md:w-[420px] bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-gray-100 max-h-[80vh] flex flex-col"
            style={{ paddingBottom: 'calc(76px + env(safe-area-inset-bottom))' }}
          >
            <div className="md:hidden flex justify-center pt-2"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="font-bold text-gray-900 text-base">
                {selected ? `${selected.first_name} ${selected.last_name}` : 'Attribuer un statut'}
              </h3>
              <button onClick={close} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            {!selected ? (
              <>
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      autoFocus
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="Rechercher un client…"
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto px-2 pb-2">
                  {results.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Aucun client</p>
                  ) : results.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 truncate">{c.first_name} {c.last_name}</span>
                        <span className="block text-xs text-gray-400">{c.phone}</span>
                      </span>
                      {c.status !== 'standard' && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${c.status === 'vip' ? 'bg-black text-white' : 'bg-red-100 text-red-700'}`}>
                          {c.status === 'vip' ? '★ VIP' : '⚠ Blacklisté'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-4 pb-4 space-y-2 overflow-y-auto">
                <button
                  disabled={pending}
                  onClick={() => assign('vip')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  <Star className="w-4 h-4" /> Marquer VIP
                </button>
                <button
                  disabled={pending}
                  onClick={() => assign('standard')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  <RotateCcw className="w-4 h-4" /> Retirer le statut
                </button>
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 space-y-2">
                  <label className="block text-xs font-bold text-red-700 uppercase tracking-wide">Blacklister</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    placeholder="Motif (impayé, dégradation…)"
                    className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    disabled={pending || !reason.trim()}
                    onClick={() => assign('blackliste', reason.trim())}
                    className="w-full py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Ban className="w-4 h-4" /> Confirmer le blacklistage
                  </button>
                </div>
                <button onClick={() => setSelected(null)} className="w-full py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg">
                  ← Choisir un autre client
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
