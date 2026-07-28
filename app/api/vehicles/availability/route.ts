import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { instantDepuisSaisie } from '@/lib/format/heureAgence'
import { vehiculesIndisponibles } from '@/lib/reservations/disponibilite'

/**
 * Quels véhicules sont pris sur une période ?
 *
 * Sert au formulaire de réservation, pour dire « libre » ou « pris » AVANT la
 * saisie complète. Les règles ne sont pas réécrites ici : elles viennent de
 * `vehiculesIndisponibles`, le même code que celui qui refuse l'enregistrement.
 *
 * Les dates arrivent telles qu'elles ont été saisies (heure murale) et passent
 * par `instantDepuisSaisie` : Vercel tourne en temps universel, une conversion
 * naïve décalerait la fenêtre de deux heures l'été.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const start = request.nextUrl.searchParams.get('start')
  const end   = request.nextUrl.searchParams.get('end')
  const ignore = request.nextUrl.searchParams.get('ignore') ?? undefined
  if (!start || !end) {
    return NextResponse.json({ error: 'start et end requis' }, { status: 400 })
  }

  const debut = instantDepuisSaisie(start)
  const fin   = instantDepuisSaisie(end)
  if (!(Date.parse(debut) < Date.parse(fin))) {
    return NextResponse.json({ busy: {} })
  }

  const indispo = await vehiculesIndisponibles(supabase, debut, fin, {
    ignorerReservationId: ignore,
  })

  return NextResponse.json({ busy: Object.fromEntries(indispo) })
}
