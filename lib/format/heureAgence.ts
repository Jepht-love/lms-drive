import { BUSINESS_TZ } from '@/lib/calendar/constants'

/**
 * Met en forme une date à l'heure de l'agence (BUSINESS_TZ), et non à l'heure
 * du serveur.
 *
 * Indispensable partout où un texte est fabriqué côté serveur et lu par un
 * humain : notification poussée sur le téléphone, e-mail, nom de document,
 * contrat PDF. Vercel tourne en UTC : sans ce fuseau, une restitution prévue à
 * 12:00 s'écrit « 10:00 » l'été et « 11:00 » l'hiver. Constaté le 27/07/2026
 * sur la notification « Retour dans 1 h », qui annonçait 10:00 pour un retour
 * réellement prévu à 12:00 — le rappel partait à la bonne heure, seul le texte
 * était faux, ce qui le rendait incompréhensible.
 *
 * Dans un composant affiché par le navigateur, ce détour est inutile : le
 * téléphone du gérant est déjà à l'heure française.
 */
export function fmtAgence(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleString('fr-FR', { ...options, timeZone: BUSINESS_TZ })
}

/** Heure seule : « 12:00 ». */
export function heureAgence(value: string | number | Date): string {
  return fmtAgence(value, { hour: '2-digit', minute: '2-digit' })
}

/** Jour et heure, sans l'année : « 27/07 12:00 ». */
export function jourHeureAgence(value: string | number | Date): string {
  return fmtAgence(value, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Date seule : « 27/07/2026 ». */
export function dateAgence(value: string | number | Date): string {
  return fmtAgence(value, { day: '2-digit', month: '2-digit', year: 'numeric' })
}
