import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import AvailabilityClient from './AvailabilityClient'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Les événements (pour déduire les créneaux occupés) sont chargés côté client
  // par semaine affichée — la navigation semaine par semaine impose ce fetch
  // dynamique. Ici on ne charge que le planning hebdomadaire récurrent, valable
  // pour toutes les semaines.
  const [{ data: mySlots }, { data: profiles }, { data: allSlots }] = await Promise.all([
    supabase.from('availability_slots').select('day_of_week, start_time, end_time').eq('user_id', user.id),
    supabase.from('profiles').select('id, full_name, role').in('role', ['gerant', 'associe', 'employe', 'prestataire']).order('full_name'),
    supabase.from('availability_slots').select('user_id, day_of_week, start_time, end_time'),
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
      />
    </div>
  )
}
