import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import DeleteButton from '@/components/ui/DeleteButton'
import BackButton from '@/components/ui/BackButton'

const TYPES: Record<string, string> = {
  lavage: 'Lavage', preparation: 'Préparation',
  rendez_vous_client: 'RDV client', rendez_vous_garage: 'RDV garage',
  livraison: 'Livraison', recuperation: 'Récupération',
  entretien: 'Entretien', controle_etat_lieux: 'État des lieux',
  paiement_caution: 'Paiement caution', document_manquant: 'Document manquant',
  marketing: 'Marketing', autre: 'Autre',
}

const STATUSES = [
  { id: 'a_faire',  label: 'À faire',  color: 'bg-gray-100 text-gray-600' },
  { id: 'en_cours', label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  { id: 'termine',  label: 'Terminé',  color: 'bg-green-100 text-green-700' },
  { id: 'reporte',  label: 'Reporté',  color: 'bg-purple-100 text-purple-700' },
  { id: 'annule',   label: 'Annulé',   color: 'bg-red-100 text-red-700' },
]

async function updateTask(id: string, formData: FormData) {
  'use server'
  const supabase = await createClient()
  const status = formData.get('status') as string
  const notes  = (formData.get('notes') as string)?.trim() || null
  await supabase.from('tasks').update({ status, notes, completed_at: status === 'termine' ? new Date().toISOString() : null }).eq('id', id)
  revalidatePath('/calendar/tasks')
  redirect('/calendar/tasks')
}

async function deleteTask(id: string) {
  'use server'
  const supabase = await createClient()
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath('/calendar/tasks')
  redirect('/calendar/tasks')
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('*, vehicles(plate, brand, model), profiles!tasks_assigned_to_fkey(full_name)')
    .eq('id', id)
    .single()

  if (!task) notFound()

  const vehicle  = task.vehicles as any
  const assignee = task.profiles as any
  const status   = STATUSES.find(s => s.id === task.status) ?? STATUSES[0]
  const updateWithId  = updateTask.bind(null, id)
  const deleteWithId  = deleteTask.bind(null, id)

  const field = 'bg-gray-50 rounded-xl px-4 py-3 text-[13px] text-gray-900'
  const label = 'text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/calendar/tasks" className="p-2 hover:bg-white rounded-xl transition-colors min-h-[auto]">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <h1 className="text-xl font-black text-gray-900 flex-1 truncate">{task.title}</h1>
        <DeleteButton onConfirm={deleteWithId} confirmMessage="Supprimer cette tâche ?" />
      </div>

      {/* Détails */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${status.color}`}>{status.label}</span>
          {task.type && <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{TYPES[task.type] ?? task.type}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={label}>Échéance</p>
            <p className={field}>{format(new Date(task.due_datetime), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
          </div>
          {vehicle && (
            <div>
              <p className={label}>Véhicule</p>
              <p className={field}>
                {vehicle.brand} {vehicle.model}
                <span className="text-gray-400 font-mono text-xs"> · {vehicle.plate}</span>
              </p>
            </div>
          )}
          {assignee && (
            <div>
              <p className={label}>Assigné à</p>
              <p className={field}>{assignee.full_name}</p>
            </div>
          )}
        </div>

        {task.description && (
          <div>
            <p className={label}>Description</p>
            <p className="text-[13px] text-gray-700 leading-relaxed">{task.description}</p>
          </div>
        )}
      </div>

      {/* Formulaire mise à jour statut */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <form action={updateWithId} className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Changer le statut</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value={s.id} defaultChecked={task.status === s.id} className="accent-black" />
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Notes</p>
            <textarea name="notes" rows={3} defaultValue={task.notes ?? ''} placeholder="Notes de suivi..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-black/10" />
          </div>

          <button type="submit" className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold text-sm active:scale-[.97] transition-transform">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  )
}
