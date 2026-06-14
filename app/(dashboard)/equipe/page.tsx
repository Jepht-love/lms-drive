import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserPlus, ChevronRight } from 'lucide-react'

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  gerant:      { label: 'Gérant',      bg: 'bg-black',       text: 'text-white' },
  associe:     { label: 'Associé',     bg: 'bg-gray-800',    text: 'text-white' },
  employe:     { label: 'Employé',     bg: 'bg-gray-100',    text: 'text-gray-700' },
  prestataire: { label: 'Prestataire', bg: 'bg-blue-50',     text: 'text-blue-700' },
}

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (myProfile?.role !== 'gerant' && myProfile?.role !== 'associe') redirect('/')

  const isManager = myProfile?.role === 'gerant'

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, color, is_active, hire_date')
    .order('full_name')

  const { data: taskRows } = await supabase
    .from('tasks')
    .select('assigned_to')
    .in('status', ['a_faire', 'en_cours'])
    .not('assigned_to', 'is', null)

  const taskCount: Record<string, number> = {}
  taskRows?.forEach(t => {
    if (t.assigned_to) taskCount[t.assigned_to] = (taskCount[t.assigned_to] ?? 0) + 1
  })

  const active   = members?.filter(m => m.is_active) ?? []
  const inactive = members?.filter(m => !m.is_active) ?? []

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Équipe</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {active.length} membre{active.length > 1 ? 's' : ''} actif{active.length > 1 ? 's' : ''}
          </p>
        </div>
        {isManager && (
          <Link href="/equipe/new"
            className="flex items-center gap-2 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-2xl">
            <UserPlus className="w-4 h-4" />
            INVITER
          </Link>
        )}
      </div>

      {/* Membres actifs */}
      <div className="space-y-2">
        {active.map(member => <MemberCard key={member.id} member={member} tasks={taskCount[member.id] ?? 0} />)}
      </div>

      {/* Membres inactifs */}
      {inactive.length > 0 && (
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-300 mb-2">Inactifs</h2>
          <div className="space-y-2 opacity-50">
            {inactive.map(member => <MemberCard key={member.id} member={member} tasks={0} />)}
          </div>
        </section>
      )}

      {members?.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400 font-medium">Aucun membre dans l'équipe</p>
          {isManager && (
            <Link href="/equipe/new" className="mt-3 inline-block text-xs font-bold text-black underline underline-offset-2">
              Inviter le premier membre
            </Link>
          )}
        </div>
      )}

    </div>
  )
}

function MemberCard({ member, tasks }: { member: any; tasks: number }) {
  const initials = member.full_name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'
  const role = ROLE_CONFIG[member.role] ?? { label: member.role, bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <Link href={`/equipe/${member.id}`}>
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
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
          <ChevronRight className="w-4 h-4 text-gray-200" />
        </div>
      </div>
    </Link>
  )
}
