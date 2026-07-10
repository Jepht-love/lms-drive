import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { startOfDay, endOfDay } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { businessNow } from '@/lib/calendar/dateUtils'
import AvailabilityClient from './AvailabilityClient'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fenêtre large autour de "aujourd'hui" (heure agence) : on récupère les
  // événements déjà attribués à un collaborateur pour en déduire, côté client,
  // les créneaux réellement libres. Le padding ±12h absorbe l'écart de fuseau
  // serveur (UTC sur Vercel) ; le client filtre ensuite au jour calendaire exact.
  const now = businessNow()
  const queryStart = new Date(startOfDay(now).getTime() - 12 * 3_600_000)
  const queryEnd = new Date(endOfDay(now).getTime() + 12 * 3_600_000)

  const [{ data: mySlots }, { data: profiles }, { data: allSlots }, { data: todayEvents }] = await Promise.all([
    supabase.from('availability_slots').select('day_of_week, start_time, end_time').eq('user_id', user.id),
    supabase.from('profiles').select('id, full_name, role').in('role', ['gerant', 'associe', 'employe', 'prestataire']).order('full_name'),
    supabase.from('availability_slots').select('user_id, day_of_week, start_time, end_time'),
    supabase.from('calendar_events')
      .select('assigned_to, start_at, end_at, title, event_type')
      .not('assigned_to', 'is', null)
      .gte('start_at', queryStart.toISOString())
      .lte('start_at', queryEnd.toISOString()),
  ])

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/calendrier" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Calendrier
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Disponibilités</h1>
      <AvailabilityClient
        userId={user.id}
        mySlots={mySlots ?? []}
        profiles={profiles ?? []}
        allSlots={allSlots ?? []}
        todayEvents={todayEvents ?? []}
      />
    </div>
  )
}
