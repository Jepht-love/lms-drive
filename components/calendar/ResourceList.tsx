'use client'

import { Users, Pencil, Trash2 } from 'lucide-react'
import type { CalendarResource } from '@/types/calendar'

interface ResourceListProps {
  resources: CalendarResource[]
  onToggle: (id: string) => void
  onSelectOnly: (id: string) => void
  canManageTeams?: boolean
  onRenameTeam?: (id: string, name: string) => void
  onDeleteTeam?: (id: string) => void
}

const ROLE_LABELS: Record<string, string> = {
  gerant: 'gérant',
  associe: 'associé',
  employe: 'employé',
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return fullName.slice(0, 2).toUpperCase()
}

export default function ResourceList({
  resources, onToggle, onSelectOnly, canManageTeams, onRenameTeam, onDeleteTeam,
}: ResourceListProps) {
  const allVisible = resources.length > 0 && resources.every(r => r.visible)

  const toggleAll = () => {
    for (const r of resources) {
      if (r.visible === allVisible) onToggle(r.id)
    }
  }

  const handleRename = (r: CalendarResource) => {
    const next = window.prompt('Renommer l’équipe', r.full_name)
    if (next && next.trim() && next.trim() !== r.full_name) onRenameTeam?.(r.id, next.trim())
  }

  const handleDelete = (r: CalendarResource) => {
    if (window.confirm(`Supprimer l’équipe « ${r.full_name} » ? Les événements déjà assignés la conservent, mais elle disparaît du calendrier.`)) {
      onDeleteTeam?.(r.id)
    }
  }

  return (
    <div>
      {resources.map(r => (
        <div key={r.id} className="w-full flex items-center gap-2 h-[44px] px-1">
          <button
            type="button"
            onClick={() => onToggle(r.id)}
            title="Ajouter/retirer du comparatif"
            className="flex-shrink-0 p-1 -m-1"
          >
            <span
              className="w-[16px] h-[16px] rounded-[4px] border block"
              style={{
                backgroundColor: r.visible ? r.color : 'white',
                borderColor: r.visible ? r.color : '#D1D5DB',
              }}
            />
          </button>
          <button
            type="button"
            onClick={() => onSelectOnly(r.id)}
            title="Voir uniquement son planning"
            className="flex-1 flex items-center gap-2 min-w-0 text-left"
          >
            {r.type === 'team' ? (
              <span
                className="w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: r.color }}
              >
                <Users size={12} className="text-white" />
              </span>
            ) : (
              <span
                className="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0"
                style={{ backgroundColor: r.color }}
              >
                {initialsOf(r.full_name)}
              </span>
            )}
            <span className="flex-1 text-left text-[13px] font-medium truncate">{r.full_name}</span>
            {!(canManageTeams && r.type === 'team') && (
              <span className="text-[10px] text-gray-400">{r.role ? ROLE_LABELS[r.role] ?? r.role : 'équipe'}</span>
            )}
          </button>

          {canManageTeams && r.type === 'team' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleRename(r)}
                title="Renommer l’équipe"
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(r)}
                title="Supprimer l’équipe"
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={toggleAll}
        className="text-[11px] text-[#111111] font-medium px-1 mt-1"
      >
        {allVisible ? 'Tout masquer' : 'Tout afficher'}
      </button>
    </div>
  )
}
