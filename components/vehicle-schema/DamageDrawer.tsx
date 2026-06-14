'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Drawer from '@/components/Drawer'
import { type DamageZone, type DamageEntry } from './inspection-types'

interface DamageDrawerProps {
  open: boolean
  zone: DamageZone
  existingDamages: DamageEntry[]
  onAdd: (entry: DamageEntry) => void
  onRemove: (index: number) => void
  onClose: () => void
}

const SEVERITY_STYLES: Record<DamageEntry['severity'], string> = {
  rayure:    'bg-yellow-100 text-yellow-700',
  dommage:   'bg-red-100 text-red-700',
  attention: 'bg-orange-100 text-orange-700',
}

const SEVERITY_ACTIVE: Record<DamageEntry['severity'], string> = {
  rayure:    'bg-yellow-400 text-yellow-900',
  dommage:   'bg-red-600 text-white',
  attention: 'bg-orange-400 text-white',
}

export default function DamageDrawer({ open, zone, existingDamages, onAdd, onRemove, onClose }: DamageDrawerProps) {
  const [severity, setSeverity] = useState<DamageEntry['severity']>('rayure')
  const [comment, setComment] = useState('')

  function handleAdd() {
    onAdd({ severity, comment, photos: [] })
    setComment('')
    setSeverity('rayure')
  }

  return (
    <Drawer open={open} title={zone.label} onClose={onClose}>
      <div className="space-y-4">
        {/* Dommages existants sur cette zone */}
        {existingDamages.length > 0 && (
          <div className="space-y-2">
            {existingDamages.map((entry, i) => (
              <div key={i} className="flex items-start justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex-1 min-w-0">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[entry.severity]}`}>
                    {entry.severity}
                  </span>
                  {entry.comment && (
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{entry.comment}</p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(i)}
                  className="ml-2 p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Saisie nouveau dommage */}
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Type de dommage</p>
            <div className="grid grid-cols-3 gap-2">
              {(['rayure', 'dommage', 'attention'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-colors ${
                    severity === s ? SEVERITY_ACTIVE[s] : 'border border-gray-200 text-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Commentaire</p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="Détails du dommage..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#111111] text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium"
            >
              Fermer
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 py-3 bg-[#111111] text-white rounded-2xl text-sm font-semibold"
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
