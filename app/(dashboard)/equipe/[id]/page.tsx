import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format, addDays, startOfDay, startOfWeek, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Phone, Mail, Calendar, Briefcase,
  ChevronRight, Plus, CheckCircle2, Clock,
} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import MemberTabsEditor from './MemberTabsEditor'
import MemberActiveToggle from './MemberActiveToggle'

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  gerant:      { label: 'Gérant',      bg: 'bg-black',    text: 'text-white' },
  associe:     { label: 'Associé',     bg: 'bg-gray-800', text: 'text-white' },
  employe:     { label: 'Employé',     bg: 'bg-gray-100', text: 'text-gray-700' },
  prestataire: { label: 'Prestataire', bg: 'bg-blue-50',  text: 'text-blue-700' },
}

const STATUS_BADGE: Record<string, string> = {
  a_faire:  'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-50 text-blue-700',
  termine:  'bg-green-50 text-green-700',
  reporte:  'bg-orange-50 text-orange-700',
  annule:   'bg-red-50 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé',
  reporte: 'Reporté', annule: 'Annulé',
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (caller?.role !== 'gerant' && caller?.role !== 'associe') redirect('/')

  const isManager = caller?.role === 'gerant'

  const { data: member } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, color, is_active, hire_date')
    .eq('id', id)
    .single()

  if (!member) redirect('/equipe')

  // Permissions par onglet — requête séparée tolérante à l'absence de la colonne
  // (avant migration 017 : memberPerm = null → considéré comme accès complet).
  const { data: memberPerm } = await supabase
    .from('profiles')
    .select('allowed_tabs')
    .eq('id', id)
    .maybeSingle()
  const memberTabs = (memberPerm as { allowed_tabs?: string[] | null } | null)?.allowed_tabs ?? null
  const memberRestricted = member.role === 'employe' || member.role === 'prestataire'

  // Permissions fines (catégories documents + bloc flotte) — requête séparée
  // tolérante à l'absence des colonnes avant la migration 020.
  const { data: memberPerm2 } = await supabase
    .from('profiles')
    .select('allowed_doc_categories, can_view_fleet')
    .eq('id', id)
    .maybeSingle()
  const memberDocCats = (memberPerm2 as { allowed_doc_categories?: string[] | null } | null)?.allowed_doc_categories ?? null
  const memberCanViewFleet = (memberPerm2 as { can_view_fleet?: boolean | null } | null)?.can_view_fleet ?? true

  const now      = new Date()
  const today    = startOfDay(now)
  const in14Days = addDays(today, 14)

  // Tâches à venir (14 jours)
  const { data: upcomingTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, type, status, due_datetime,
      vehicles ( plate, brand, model )
    `)
    .eq('assigned_to', id)
    .in('status', ['a_faire', 'en_cours'])
    .gte('due_datetime', today.toISOString())
    .lte('due_datetime', in14Days.toISOString())
    .order('due_datetime')

  // Compteurs globaux
  const { count: pendingCount } = await supabase
    .from('tasks').select('*', { count: 'exact', head: true })
    .eq('assigned_to', id).in('status', ['a_faire', 'en_cours'])

  const { count: doneCount } = await supabase
    .from('tasks').select('*', { count: 'exact', head: true })
    .eq('assigned_to', id).eq('status', 'termine')

  // Mini calendrier semaine
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: weekTasks } = await supabase
    .from('tasks')
    .select('id, due_datetime, status')
    .eq('assigned_to', id)
    .neq('status', 'annule')
    .gte('due_datetime', weekStart.toISOString())
    .lte('due_datetime', addDays(weekStart, 6).toISOString())

  const initials = member.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const role     = ROLE_CONFIG[member.role] ?? { label: member.role, bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <div className="space-y-4">

      {/* Retour */}
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/equipe" className="w-9 h-9 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </BackButton>
        <h1 className="text-lg font-black text-gray-900">Profil membre</h1>
      </div>

      {/* Carte profil */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0"
            style={{ backgroundColor: member.color ?? '#6366f1' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-black text-gray-900">{member.full_name}</p>
              {!member.is_active && (
                <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactif</span>
              )}
            </div>
            <span className={`inline-block mt-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${role.bg} ${role.text}`}>
              {role.label}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {member.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <a href={`tel:${member.phone}`} className="text-sm text-gray-700 font-medium">{member.phone}</a>
            </div>
          )}
          {member.hire_date && (
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <p className="text-sm text-gray-500">
                Embauché le {format(new Date(member.hire_date), 'd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-gray-900">{pendingCount ?? 0}</p>
          <p className="text-[10px] font-bold uppercase text-gray-400 mt-1">Tâches en cours</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-green-500">{doneCount ?? 0}</p>
          <p className="text-[10px] font-bold uppercase text-gray-400 mt-1">Terminées</p>
        </div>
      </div>

      {/* Mini calendrier semaine */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Cette semaine</p>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const isToday    = isSameDay(day, today)
            const dayTasks   = weekTasks?.filter(t => isSameDay(new Date(t.due_datetime), day)) ?? []
            const hasDone    = dayTasks.some(t => t.status === 'termine')
            const hasPending = dayTasks.some(t => t.status !== 'termine')
            return (
              <div key={day.toISOString()} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold uppercase text-gray-400">
                  {format(day, 'EEE', { locale: fr })}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isToday ? 'text-white' : 'text-gray-700'}`}
                  style={{ backgroundColor: isToday ? (member.color ?? '#6366f1') : 'transparent' }}>
                  <span className="text-xs font-black">{format(day, 'd')}</span>
                </div>
                <div className="flex gap-0.5">
                  {hasPending && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: member.color ?? '#6366f1' }} />}
                  {hasDone    && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                  {dayTasks.length === 0 && <div className="w-1.5 h-1.5" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tâches à venir */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Tâches à venir</h2>
            {(upcomingTasks?.length ?? 0) > 0 && (
              <span className="w-5 h-5 bg-gray-200 rounded-full text-gray-600 text-[10px] font-bold flex items-center justify-center">
                {upcomingTasks!.length}
              </span>
            )}
          </div>
          <Link
            href={`/calendar/tasks/new?assigned_to=${id}`}
            className="flex items-center gap-1 text-[11px] text-gray-400 font-medium hover:text-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> ASSIGNER
          </Link>
        </div>

        {!upcomingTasks || upcomingTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-medium">Aucune tâche à venir</p>
            <Link
              href={`/calendar/tasks/new?assigned_to=${id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-black underline underline-offset-2"
            >
              <Plus className="w-3.5 h-3.5" /> Assigner une tâche
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {upcomingTasks.map(task => {
              const tv = Array.isArray((task as any).vehicles) ? (task as any).vehicles[0] : (task as any).vehicles
              const isToday = isSameDay(new Date(task.due_datetime), today)
              return (
                <Link key={task.id} href={`/calendar/tasks/${task.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col items-center flex-shrink-0 w-12 text-center">
                      <span className={`text-[10px] font-bold capitalize ${isToday ? 'text-black' : 'text-gray-400'}`}>
                        {isToday ? 'Auj.' : format(new Date(task.due_datetime), 'EEE', { locale: fr })}
                      </span>
                      <span className="text-sm font-black text-gray-900 font-mono">
                        {format(new Date(task.due_datetime), 'HH:mm')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{task.title}</p>
                      {(tv as any)?.plate && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {(tv as any).brand} {(tv as any).model}
                          <span className="font-mono"> · {(tv as any).plate}</span>
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Permissions par onglet (membre restreint) */}
      {isManager && memberRestricted && (
        <MemberTabsEditor
          memberId={id}
          role={member.role}
          initialTabs={memberTabs}
          initialDocCategories={memberDocCats}
          initialCanViewFleet={memberCanViewFleet}
        />
      )}

      {/* Actions gérant */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <Link href={`/equipe/${id}/edit`}>
            <div className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-sm font-semibold text-gray-700">Modifier le profil</span>
              <ChevronRight className="w-4 h-4 text-gray-200" />
            </div>
          </Link>
          <div className="flex items-center gap-3 px-4 py-4">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">Compte actif</p>
              <p className="text-xs text-gray-400">Un compte inactif ne peut plus se connecter.</p>
            </div>
            <MemberActiveToggle memberId={id} initialActive={member.is_active} />
          </div>
        </div>
      )}

    </div>
  )
}
