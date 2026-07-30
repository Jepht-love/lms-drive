import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { status } = await request.json()
  if (!status) return NextResponse.json({ error: 'status requis' }, { status: 400 })

  const [{ data: caller }, { data: event }] = await Promise.all([
    supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
    supabase.from('calendar_events')
      .select('assigned_to, title, vehicle_ids, assignee:profiles!assigned_to(full_name)')
      .eq('id', id).single(),
  ])

  const isManager = caller?.role === 'gerant' || caller?.role === 'associe'
  const isOwner = event?.assigned_to === user.id
  if (!isManager && !isOwner) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const eventTitle = event?.title ?? 'Tâche'

  // L'avancement d'une tâche part à TOUTE l'équipe, salariés compris : c'est
  // ainsi que chacun voit qu'un collègue a déjà pris le travail, au lieu que
  // deux ou trois personnes se retrouvent dessus. Décision de Jeff, 28/07/2026.
  //
  // Les libellés d'avant venaient du vocabulaire des locations (« Départ
  // confirmé », « Retour effectué ») et s'affichaient tels quels pour un lavage
  // ou une course. Ils disent maintenant qui fait quoi.
  const PROGRESS: Record<string, string> = {
    en_cours: 'a commencé',
    termine:  'a terminé',
    reporte:  'a reporté',
    annule:   'a annulé',
  }
  const verbe = PROGRESS[status]

  if (verbe) {
    const auteur = caller?.full_name?.trim() || 'Un membre de l’équipe'
    // Trois lignes : ce qu'il y a à faire, la voiture, à qui la tâche est
    // confiée (Jeff, 30/07/2026). C'est cette notification qui reste, celle
    // qui disait « Tâche · Terminé » a été supprimée le même jour.
    const idVeh = ((event as any)?.vehicle_ids as string[] | null)?.[0]
    let ligneVehicule = ''
    if (idVeh) {
      const { data: veh } = await supabase
        .from('vehicles').select('brand, model, color, plate').eq('id', idVeh).maybeSingle()
      if (veh) ligneVehicule = `${[veh.brand, veh.model, veh.color].filter(Boolean).join(' ')} (${veh.plate})`
    }
    const aQui = Array.isArray((event as any)?.assignee)
      ? (event as any).assignee[0] : (event as any)?.assignee
    await broadcastPushToManagers(
      {
        title: `${auteur} ${verbe} une tâche`,
        body: [
          eventTitle,
          ligneVehicule,
          aQui?.full_name ? `Confiée à ${aQui.full_name}` : 'Non attribuée',
        ].filter(Boolean).join('\n'),
        url: '/calendrier',
      },
      'task_progress_alert',
      { roles: ['gerant', 'associe', 'employe'], excludeUserId: user.id },
    )
  }

  return NextResponse.json(data)
}
