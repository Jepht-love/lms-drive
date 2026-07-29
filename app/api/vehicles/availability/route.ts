import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dateAgence, heureAgence, jourHeureAgence, instantDepuisSaisie } from '@/lib/format/heureAgence'
import { analyserDisponibilite } from '@/lib/reservations/disponibilite'

/**
 * Quels véhicules sont pris sur une période, et quand exactement sont-ils libres ?
 *
 * Sert au formulaire de réservation et au panneau « Véhicules disponibles » des
 * déplacements internes, pour dire « libre » ou « pris » AVANT la saisie complète.
 * Les règles ne sont pas réécrites ici : elles viennent de
 * `analyserDisponibilite`, le même code que celui qui refuse l'enregistrement.
 *
 * Ce qu'elle renvoie :
 *  - `busy` : la forme d'origine, un véhicule pris avec sa raison et sa date de
 *    libération. Le formulaire de réservation ne lit que ça — à ne pas casser.
 *  - `dispo` : ajout du 30/07/2026, une entrée par véhicule examiné avec les
 *    créneaux réellement libres à l'intérieur de la période. Une voiture rendue à
 *    13h et reprise à 15h n'était annoncée que « prise jusqu'à 15h », le trou de
 *    deux heures restait invisible.
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
    return NextResponse.json({ busy: {}, dispo: {} })
  }

  const { busy: indispo, fine } = await analyserDisponibilite(supabase, debut, fin, {
    ignorerReservationId: ignore,
  })

  // Les heures sont mises en forme ICI, à l'heure de l'agence : le navigateur est
  // déjà à l'heure française, mais le serveur tourne en temps universel et une
  // date brute renvoyée telle quelle serait affichée décalée par un rendu serveur.
  const busy = Object.fromEntries(
    [...indispo.entries()].map(([id, v]) => [id, {
      raison: v.raison,
      jusqua: v.jusqua ? jourHeureAgence(v.jusqua) : null,
    }]),
  )

  const dispo = Object.fromEntries(
    [...fine.entries()].map(([id, v]) => [id, {
      raison: v.raison,
      jusqua: v.jusqua ? jourHeureAgence(v.jusqua) : null,
      retourInconnu: v.retourInconnu,
      // `debut` et `fin` restent bruts : l'écran s'en sert pour préremplir les
      // champs du formulaire. `libelle` est le texte affiché.
      creneaux: v.creneaux.map(c => ({
        debut: c.debut,
        fin: c.fin,
        libelle: libelleCreneau(c.debut, c.fin),
      })),
    }]),
  )

  return NextResponse.json({ busy, dispo })
}

/** « 13:00 - 15:00 » sur un même jour, « 30/07 13:00 - 31/07 09:00 » sinon. */
function libelleCreneau(debut: string, fin: string): string {
  if (dateAgence(debut) === dateAgence(fin)) {
    return `${heureAgence(debut)} - ${heureAgence(fin)}`
  }
  return `${jourHeureAgence(debut)} - ${jourHeureAgence(fin)}`
}
