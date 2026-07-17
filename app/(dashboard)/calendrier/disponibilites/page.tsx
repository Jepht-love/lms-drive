import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import AvailabilityClient from './AvailabilityClient'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Vue « disponibilité = 24 h − créneaux réservés » : plus de planning à
  // déclarer, seuls les membres sont chargés ici. Les événements (créneaux
  // occupés) sont récupérés côté client par semaine affichée.
  // is_active = true : un collaborateur désactivé (ex. « jefe ») ne doit plus
  // apparaître dans le planning des disponibilités — aligné avec l'API du
  // calendrier (/api/calendar/resources) qui filtre déjà les profils inactifs.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['gerant', 'associe', 'employe', 'prestataire'])
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/calendrier" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Calendrier
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Disponibilités</h1>
      <AvailabilityClient profiles={profiles ?? []} />
    </div>
  )
}
