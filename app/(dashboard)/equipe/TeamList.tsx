'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, ChevronRight, Trash2, X, Check } from 'lucide-react'

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  gerant:      { label: 'Gérant',      bg: 'bg-black',       text: 'text-white' },
  associe:     { label: 'Associé',     bg: 'bg-gray-800',    text: 'text-white' },
  employe:     { label: 'Employé',     bg: 'bg-gray-100',    text: 'text-gray-700' },
  prestataire: { label: 'Prestataire', bg: 'bg-blue-50',     text: 'text-blue-700' },
}

export interface TeamMember {
  id: string
  full_name: string
  role: string
  phone: string | null
  color: string | null
  is_active: boolean
}

interface Props {
  active: TeamMember[]
  inactive: TeamMember[]
  taskCount: Record<string, number>
  isManager: boolean
  currentUserId: string
}

export default function TeamList({ active, inactive, taskCount, isManager, currentUserId }: Props) {
  const router = useRouter()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Soi-même et les gérants ne sont pas supprimables (mêmes règles que l'API).
  const deletable = (m: TeamMember) => m.id !== currentUserId && m.role !== 'gerant'

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelection() {
    setSelecting(false)
    setSelected(new Set())
    setConfirming(false)
    setErrors([])
  }

  async function handleDelete() {
    setDeleting(true)
    setErrors([])
    const failed: string[] = []
    const all = [...active, ...inactive]

    for (const id of selected) {
      try {
        const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const name = all.find(m => m.id === id)?.full_name ?? 'Membre'
          failed.push(data.error ?? `${name} : suppression impossible`)
        }
      } catch {
        failed.push('Erreur réseau')
      }
    }

    setDeleting(false)
    if (failed.length > 0) {
      setErrors(failed)
      setConfirming(false)
      setSelected(new Set())
      router.refresh()
    } else {
      exitSelection()
      router.refresh()
    }
  }

  const totalActive = active.length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Équipe</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {selecting
              ? 'Sélectionnez les profils à supprimer'
              : `${totalActive} membre${totalActive > 1 ? 's' : ''} actif${totalActive > 1 ? 's' : ''}`}
          </p>
        </div>
        {isManager && !selecting && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelecting(true)}
              aria-label="Sélectionner des profils à supprimer"
              className="w-10 h-10 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Link href="/equipe/new"
              className="flex items-center gap-2 bg-[#111111] text-white text-xs font-bold px-4 py-2.5 rounded-2xl">
              <UserPlus className="w-4 h-4" />
              INVITER
            </Link>
          </div>
        )}
        {selecting && (
          <button
            onClick={exitSelection}
            className="flex items-center gap-1.5 bg-white text-gray-600 text-xs font-bold px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm"
          >
            <X className="w-4 h-4" />
            ANNULER
          </button>
        )}
      </div>

      {/* Erreurs de suppression */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs font-bold text-red-600">{e}</p>
          ))}
        </div>
      )}

      {/* Membres actifs */}
      <div className="space-y-2">
        {active.map(m => (
          <MemberCard key={m.id} member={m} tasks={taskCount[m.id] ?? 0}
            selecting={selecting} selectable={deletable(m)}
            selected={selected.has(m.id)} onToggle={() => toggle(m.id)} />
        ))}
      </div>

      {/* Membres inactifs */}
      {inactive.length > 0 && (
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Inactifs</h2>
          <div className={`space-y-2 ${selecting ? '' : 'opacity-50'}`}>
            {inactive.map(m => (
              <MemberCard key={m.id} member={m} tasks={0}
                selecting={selecting} selectable={deletable(m)}
                selected={selected.has(m.id)} onToggle={() => toggle(m.id)} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && inactive.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400 font-medium">Aucun membre dans l'équipe</p>
          {isManager && (
            <Link href="/equipe/new" className="mt-3 inline-block text-xs font-bold text-black underline underline-offset-2">
              Inviter le premier membre
            </Link>
          )}
        </div>
      )}

      {/* Barre d'action flottante en mode sélection */}
      {selecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md">
          <button
            onClick={() => setConfirming(true)}
            disabled={selected.size === 0 || deleting}
            className="w-full bg-red-500 text-white font-black text-sm py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {`SUPPRIMER${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      )}

      {/* Confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-base font-black text-gray-900">
                Supprimer {selected.size} profil{selected.size > 1 ? 's' : ''} ?
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Le compte et l'accès à l'application seront définitivement supprimés. Cette action est irréversible.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)} disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 font-bold text-sm py-3.5 rounded-2xl"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 text-white font-black text-sm py-3.5 rounded-2xl disabled:opacity-60"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function MemberCard({ member, tasks, selecting, selectable, selected, onToggle }: {
  member: TeamMember
  tasks: number
  selecting: boolean
  selectable: boolean
  selected: boolean
  onToggle: () => void
}) {
  const initials = member.full_name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'
  const role = ROLE_CONFIG[member.role] ?? { label: member.role, bg: 'bg-gray-100', text: 'text-gray-600' }

  const body = (
    <div className={`bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-4 transition-all ${
      selecting && selected ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'
    } ${selecting && !selectable ? 'opacity-40' : ''}`}>

      {/* Case de sélection */}
      {selecting && (
        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          selected ? 'bg-red-500 border-red-500' : 'border-gray-200 bg-white'
        }`}>
          {selected && <Check className="w-4 h-4 text-white" />}
        </div>
      )}

      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-sm"
        style={{ backgroundColor: member.color ?? '#6366f1' }}>
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">{member.full_name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${role.bg} ${role.text}`}>
            {role.label}
          </span>
          {member.phone && (
            <span className="text-[10px] text-gray-400">{member.phone}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {tasks > 0 && (
          <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-[11px] font-black text-orange-600">{tasks}</span>
          </div>
        )}
        {!selecting && <ChevronRight className="w-4 h-4 text-gray-200" />}
      </div>
    </div>
  )

  if (selecting) {
    return (
      <button type="button" onClick={selectable ? onToggle : undefined}
        disabled={!selectable} className="w-full text-left" aria-pressed={selected}>
        {body}
      </button>
    )
  }
  return <Link href={`/equipe/${member.id}`}>{body}</Link>
}
