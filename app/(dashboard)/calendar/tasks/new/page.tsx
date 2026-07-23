import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { revalidatePath } from 'next/cache'
import TaskTypeField from './TaskTypeField'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'

async function createTask(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const title       = (formData.get('title') as string)?.trim()
  const type        = formData.get('type') as string
  const due         = formData.get('due_datetime') as string
  const description = (formData.get('description') as string)?.trim() || null
  const vehicle_id  = (formData.get('vehicle_id') as string) || null
  const assigned_to = (formData.get('assigned_to') as string) || null
  const notes       = (formData.get('notes') as string)?.trim() || null

  if (!title || !due) return

  await supabase.from('tasks').insert({
    title, type: type || null, due_datetime: due,
    description, vehicle_id, assigned_to, notes,
    status: 'a_faire', created_by: user.id,
  })

  const dueDate = new Date(due).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  await broadcastPushToManagers({
    title: 'Nouvelle tâche créée',
    body: `${title} — prévu le ${dueDate}`,
    url: '/calendar/tasks',
  }, 'new_task_alert')

  revalidatePath('/calendar/tasks')
  revalidatePath('/')
  redirect('/calendar/tasks')
}

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; hour?: string; min?: string }>
}) {
  const { date, hour, min } = await searchParams
  const supabase = await createClient()

  const [{ data: vehicles }, { data: profiles }] = await Promise.all([
    supabase.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand'),
    // Compte administrateur (concepteur) = profil technique : jamais assignable.
    supabase.from('profiles').select('id, full_name').eq('is_admin', false).order('full_name'),
  ])

  // Pré-remplissage date/heure depuis le calendrier
  let defaultDatetime = ''
  if (date) {
    const h = hour?.padStart(2, '0') ?? '09'
    const m = min?.padStart(2, '0') ?? '00'
    defaultDatetime = `${date}T${h}:${m}`
  }

  const input = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/calendar/tasks" className="p-2 hover:bg-white rounded-xl transition-colors min-h-[auto]">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <h1 className="text-xl font-black text-gray-900">Nouvelle tâche</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <form action={createTask} className="space-y-4">

          <div>
            <label className={label}>Titre *</label>
            <input name="title" type="text" required placeholder="Ex : Lavage Peugeot 208..." className={input} autoFocus />
          </div>

          <TaskTypeField inputClassName={input} labelClassName={label} />

          <div>
            <label className={label}>Date & heure *</label>
            <input name="due_datetime" type="datetime-local" required defaultValue={defaultDatetime} className={input} />
          </div>

          <div>
            <label className={label}>Véhicule concerné</label>
            <select name="vehicle_id" className={input}>
              <option value="">— Aucun —</option>
              {vehicles?.map(v => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Assigné à</label>
            <select name="assigned_to" className={input}>
              <option value="">— Non assigné —</option>
              {profiles?.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Notes internes</label>
            <textarea name="notes" rows={2} placeholder="Notes..." className={`${input} resize-none`} />
          </div>

          <button type="submit" className="w-full py-3.5 bg-[#111111] text-white rounded-xl font-semibold text-sm active:scale-[.97] transition-transform">
            Créer la tâche
          </button>
        </form>
      </div>
    </div>
  )
}
