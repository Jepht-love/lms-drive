'use client'

import { Users } from 'lucide-react'
import type { CalendarResource } from '@/types/calendar'

interface ResourceListProps {
  resources: CalendarResource[]
  onToggle: (id: string) => void
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

export default function ResourceList({ resources, onToggle }: ResourceListProps) {
  const allVisible = resources.length > 0 && resources.every(r => r.visible)

  const toggleAll = () => {
    for (const r of resources) {
      if (r.visible === allVisible) onToggle(r.id)
    }
  }

  return (
    <div>
      {resources.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onToggle(r.id)}
          className="w-full flex items-center gap-2 h-[44px] px-1"
        >
          <span
            className="w-[16px] h-[16px] rounded-[4px] border flex-shrink-0"
            style={{
              backgroundColor: r.visible ? r.color : 'white',
              borderColor: r.visible ? r.color : '#D1D5DB',
            }}
          />
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
          <span className="text-[10px] text-gray-400">{r.role ? ROLE_LABELS[r.role] ?? r.role : 'équipe'}</span>
        </button>
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
