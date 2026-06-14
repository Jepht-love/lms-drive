import { createClient } from '@/lib/supabase/server'
import InternalTripsClient from './InternalTripsClient'

export default async function InternalTripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  const isManager = profile?.role === 'gerant'

  const [{ data: vehicles }, { data: trips }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate, brand, model, current_km')
      .eq('is_active', true)
      .order('brand'),
    supabase
      .from('internal_trips')
      .select('*, vehicle:vehicles(plate, brand, model), user:profiles(full_name)')
      .order('start_datetime', { ascending: false })
      .limit(50),
  ])

  const total      = trips?.length ?? 0
  const enCours    = trips?.filter(t => !t.end_datetime).length ?? 0

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Déplacements</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {total} déplacement{total !== 1 ? 's' : ''}
          {enCours > 0 && (
            <span className="ml-2 text-orange-500 font-semibold">· {enCours} en cours</span>
          )}
        </p>
      </div>

      <InternalTripsClient
        vehicles={vehicles ?? []}
        trips={trips ?? []}
        isManager={isManager}
        currentUserId={user?.id ?? ''}
      />
    </div>
  )
}
