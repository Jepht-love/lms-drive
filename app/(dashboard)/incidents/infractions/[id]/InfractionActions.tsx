'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, CheckCircle2, Lock, Trash2 } from 'lucide-react'
import { transmitInfractionToClient, markInfractionPaid, closeInfraction, deleteInfraction } from '@/lib/actions/incidents'
import { useToast } from '@/components/Toast'

export default function InfractionActions({
  id, status, hasClientEmail,
}: {
  id: string; status: string; hasClientEmail: boolean
}) {
  const router = useRouter()
  const { show } = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  function run(fn: () => Promise<{ error?: string; success?: boolean }>, okMsg: string) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else { show(okMsg, 'success'); router.refresh() }
    })
  }

  function doDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteInfraction(id)
      if (res?.error) setError(res.error)
      else { show('Infraction supprimée', 'success'); router.push('/incidents/infractions') }
    })
  }

  const deleteBlock = confirmDel ? (
    <div className="flex gap-2">
      <button onClick={() => setConfirmDel(false)} disabled={pending}
        className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-gray-600 disabled:opacity-40">
        Annuler
      </button>
      <button onClick={doDelete} disabled={pending}
        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold disabled:opacity-40">
        {pending ? 'Suppression...' : 'Confirmer la suppression'}
      </button>
    </div>
  ) : (
    <button onClick={() => setConfirmDel(true)}
      className="w-full py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-red-600 flex items-center justify-center gap-1.5 hover:bg-red-50 hover:border-red-100 transition-colors">
      <Trash2 className="w-4 h-4" /> Supprimer l&apos;infraction
    </button>
  )

  if (status === 'cloture') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-400">
          <Lock className="w-4 h-4" /> Infraction clôturée
        </div>
        {deleteBlock}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      </div>
    )
  }

  const canTransmit = hasClientEmail && status !== 'transmis_client' && status !== 'regle'
  const canPay = status !== 'regle'

  const btn = 'flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors active:scale-[.99] disabled:opacity-40'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {canTransmit && (
          <button onClick={() => run(() => transmitInfractionToClient(id), 'Transmis au client ✓')} disabled={pending}
            className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
            <Send className="w-4 h-4" /> Transmettre au client (email)
          </button>
        )}
        {canPay && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => run(() => markInfractionPaid(id, 'client'), 'Réglé par le client ✓')} disabled={pending}
              className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
              <CheckCircle2 className="w-4 h-4" /> Réglé (client)
            </button>
            <button onClick={() => run(() => markInfractionPaid(id, 'agence'), 'Réglé par l\'agence ✓')} disabled={pending}
              className={`${btn} bg-green-700 text-white hover:bg-green-800`}>
              <CheckCircle2 className="w-4 h-4" /> Réglé (agence)
            </button>
          </div>
        )}
        <button onClick={() => run(() => closeInfraction(id), 'Clôturé ✓')} disabled={pending}
          className={`${btn} w-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`}>
          <Lock className="w-4 h-4" /> Clôturer
        </button>
      </div>
      {deleteBlock}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
