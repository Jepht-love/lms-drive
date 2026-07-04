import { redirect } from 'next/navigation'

// L'ancien calendrier (`/calendar`) est fusionné dans `/calendrier` — un seul
// calendrier actionnable. On redirige toute entrée héritée (liens, favoris,
// notifications push anciennes) vers la route canonique.
export default function LegacyCalendarPage() {
  redirect('/calendrier')
}
