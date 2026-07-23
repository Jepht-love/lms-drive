import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamList, { type TeamMember } from './TeamList'

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
    .select('id, full_name, role, phone, color, is_active, hire_date, is_admin')
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

  const active   = (members?.filter(m => m.is_active) ?? []) as TeamMember[]
  const inactive = (members?.filter(m => !m.is_active) ?? []) as TeamMember[]

  return (
    <TeamList
      active={active}
      inactive={inactive}
      taskCount={taskCount}
      isManager={isManager}
      currentUserId={user.id}
    />
  )
}
