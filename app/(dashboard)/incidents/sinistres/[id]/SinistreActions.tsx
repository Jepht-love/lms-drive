'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Wrench, Lock, FileDown, Trash2 } from 'lucide-react'
import { SINISTRE_FLOW, SINISTRE_STATUS } from '@/lib/incidents'
import { updateAccidentStatus, addAccidentToVehicle, deleteAccident } from '@/lib/actions/incidents'
import { useToast } from '@/components/Toast'

export default function SinistreActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const { show } = useToast()
  const [pending, startTransition] = useTransition()
  const [pdfPending, setPdfPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  async function downloadPdf() {
    setPdfPending(true)
    try {
      const res = await fetch(`/api/sinistres/${id}/pdf`)
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_sinistre_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message ?? 'Erreur PDF')
    } finally {
      setPdfPending(false)
    }
  }

  function run(fn: () => Promise<{ error?: string; success?: boolean }>, okMsg: string) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else { show(okMsg, 'success'); router.refresh() }
    })
  }

  const idx = SINISTRE_FLOW.indexOf(status)
  const next = idx >= 0 && idx < SINISTRE_FLOW.length - 1 ? SINISTRE_FLOW[idx + 1] : null
  const btn = 'flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors active:scale-[.99] disabled:opacity-40'

  return (
    <div className="space-y-2">
      {next ? (
        <button onClick={() => run(() => updateAccidentStatus(id, next), 'Statut avancé ✓')} disabled={pending}
          className={`${btn} bg-[#111111] text-white hover:bg-gray-800 w-full active:scale-[.97]`}>
          <ArrowRight className="w-4 h-4" /> Étape suivante : {SINISTRE_STATUS[next].label}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 py-3 bg-green-50 border border-green-100 rounded-2xl text-sm font-semibold text-green-700">
          <Lock className="w-4 h-4" /> Sinistre clôturé
        </div>
      )}

      <button onClick={() => run(() => addAccidentToVehicle(id), 'Ajouté au suivi entretien ✓')} disabled={pending}
        className={`${btn} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 w-full`}>
        <Wrench className="w-4 h-4" /> Ajouter au suivi véhicule (réparation)
      </button>

      <button onClick={downloadPdf} disabled={pdfPending}
        className={`${btn} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 w-full`}>
        <FileDown className="w-4 h-4" /> {pdfPending ? 'Génération…' : 'Télécharger le rapport PDF'}
      </button>

      {confirmDel ? (
        <div className="flex gap-2">
          <button onClick={() => setConfirmDel(false)} disabled={pending}
            className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-gray-600 disabled:opacity-40">
            Annuler
          </button>
          <button
            onClick={() => { setError(null); startTransition(async () => { const r = await deleteAccident(id); if (r?.error) setError(r.error); else { show('Sinistre supprimé', 'success'); router.push('/suivi?tab=sinistres') } }) }}
            disabled={pending}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold disabled:opacity-40">
            {pending ? 'Suppression...' : 'Confirmer la suppression'}
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)}
          className={`${btn} bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-100 w-full`}>
          <Trash2 className="w-4 h-4" /> Supprimer le sinistre
        </button>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
