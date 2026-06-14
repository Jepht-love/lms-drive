'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { updateDepositStatus } from '@/lib/actions/delete'

const DEPOSIT_STATUSES = [
  {
    value: 'en_attente',
    label: 'En attente',
    description: 'Caution encaissée, non encore restituée',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  {
    value: 'liberee',
    label: 'Libérée',
    description: 'Caution restituée au client après vérification',
    color: 'bg-green-50 text-green-800 border-green-200',
    dot: 'bg-green-500',
  },
  {
    value: 'saisie_partielle',
    label: 'Saisie partielle',
    description: 'Une partie de la caution est retenue (dommages)',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    value: 'saisie_totale',
    label: 'Saisie totale',
    description: 'Caution intégralement retenue',
    color: 'bg-red-50 text-red-800 border-red-200',
    dot: 'bg-red-500',
  },
  {
    value: 'litigieuse',
    label: 'Litigieuse',
    description: 'En cours de traitement / contestation',
    color: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
  },
]

export default function DepositStatusEditor({ reservationId, currentStatus, contractClosed }: { reservationId: string; currentStatus: string; contractClosed: boolean }) {
  const [status, setStatus] = useState(currentStatus ?? 'en_attente')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const current = DEPOSIT_STATUSES.find(s => s.value === status) ?? DEPOSIT_STATUSES[0]

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setLoading(true)
    setSaved(false)
    await updateDepositStatus(reservationId, newStatus)
    setStatus(newStatus)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      {/* Statut actuel */}
      <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${current.color}`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${current.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{current.label}</p>
          <p className="text-xs opacity-70 mt-0.5">{current.description}</p>
        </div>
        {saved && <span className="text-xs text-green-600 font-medium">✓ Enregistré</span>}
        {loading && <span className="text-xs opacity-60">…</span>}
      </div>

      {/* Changer le statut */}
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Modifier le statut</p>
      <div className="grid grid-cols-1 gap-1.5">
        {DEPOSIT_STATUSES.filter(s => s.value !== status).map(s => {
          const isLocked = s.value === 'liberee' && !contractClosed
          return (
            <button
              key={s.value}
              onClick={() => !isLocked && handleChange(s.value)}
              disabled={loading || isLocked}
              title={isLocked ? 'Le contrat doit être validé avant de libérer la caution' : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all border flex items-center gap-2.5 ${
                isLocked
                  ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                  : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-200 disabled:opacity-50'
              }`}
            >
              {isLocked
                ? <Lock className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" />
                : <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />}
              <span>{s.label}</span>
              {isLocked
                ? <span className="text-xs text-slate-300 ml-auto hidden sm:block">Contrat à valider d'abord</span>
                : <span className="text-xs text-slate-400 ml-auto hidden sm:block">{s.description}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
