'use client'

import { useState, useEffect } from 'react'
import {
  DndContext, DragEndEvent, closestCenter,
  DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'

const COLUMNS = [
  { id: 'a_faire',  label: 'À faire',   color: '#9CA3AF' },
  { id: 'en_cours', label: 'En cours',  color: '#F59E0B' },
  { id: 'termine',  label: 'Terminé',   color: '#22C55E' },
  { id: 'reporte',  label: 'Reporté',   color: '#8B5CF6' },
  { id: 'annule',   label: 'Annulé',    color: '#EF4444' },
]

type Task = {
  id: string
  title: string
  status: string
  due_datetime: string
  assignee_name?: string
  vehicle_plate?: string
}

function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-2 cursor-grab active:cursor-grabbing select-none touch-none ${isDragging && !overlay ? 'opacity-40' : ''}`}
    >
      <p className="text-[13px] font-medium text-[#111111] leading-tight">{task.title}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {task.vehicle_plate && (
          <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{task.vehicle_plate}</span>
        )}
        <span className="text-[11px] text-gray-400">{formatDate(task.due_datetime)}</span>
        {task.assignee_name && (
          <span className="text-[11px] text-gray-400">{task.assignee_name}</span>
        )}
      </div>
    </div>
  )
}

export default function TasksKanban() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    supabase
      .from('tasks')
      .select('id, title, status, due_datetime, vehicles(plate), profiles!tasks_assigned_to_fkey(full_name)')
      .order('due_datetime', { ascending: true })
      .then(({ data }) => {
        setTasks((data ?? []).map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status ?? 'a_faire',
          due_datetime: t.due_datetime,
          vehicle_plate: Array.isArray(t.vehicles) ? t.vehicles[0]?.plate : t.vehicles?.plate,
          assignee_name: Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name,
        })))
        setLoading(false)
      })
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === event.active.id) ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as string
    if (!COLUMNS.find(c => c.id === newStatus)) return
    const task = tasks.find(t => t.id === active.id)
    if (!task || task.status === newStatus) return
    setTasks(prev => prev.map(t => t.id === active.id ? { ...t, status: newStatus } : t))
    // Passe par l'action serveur : met à jour le statut (+ completed_at) et
    // notifie les managers par push en précisant le nouveau statut.
    await updateTaskStatus(active.id as string, newStatus)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/calendrier" className="p-2 hover:bg-white rounded-xl transition-colors min-h-[auto]">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div>
          <h1 className="text-xl font-black text-gray-900">Tâches</h1>
          <p className="text-sm text-gray-400">Suivi par statut</p>
        </div>
        <Link href="/calendar/tasks/new" className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors min-h-[auto] active:scale-[.97]">
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
            {COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.id)
              return (
                <div key={col.id} className="flex-shrink-0 w-[240px]">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{col.label}</p>
                    <span className="text-[11px] text-gray-300 ml-auto">{colTasks.length}</span>
                  </div>
                  <SortableContext
                    id={col.id}
                    items={colTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="min-h-[80px] bg-gray-50/60 rounded-2xl p-2">
                      {colTasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="flex items-center justify-center h-16">
                          <p className="text-[11px] text-gray-300">Vide</p>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              )
            })}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} overlay />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
