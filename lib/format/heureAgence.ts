import { TZDate } from '@date-fns/tz'
import { BUSINESS_TZ } from '@/lib/calendar/constants'

/**
 * Convertit une heure SAISIE dans un formulaire en instant réel.
 *
 * Les champs de date rendent « 2026-07-27T10:00 », une heure murale sans
 * fuseau. Envoyée telle quelle en base, elle est comprise comme de l'heure
 * universelle : une restitution saisie à 10:00 se relit 12:00 en France l'été.
 * Constaté le 27/07/2026 sur toutes les réservations, d'où des retours qui ne
 * passaient en retard que deux heures trop tard.
 *
 * Cette fonction fait l'inverse de `heureAgence` : elle interprète la saisie
 * dans le fuseau de l'agence et rend l'instant correspondant. Le changement
 * d'heure est géré (10:00 → 08:00 l'été, 09:00 l'hiver).
 *
 * À utiliser dans TOUTE action serveur qui écrit une date saisie. Inutile dans
 * le navigateur, où `new Date('...')` interprète déjà la saisie dans le fuseau
 * de l'utilisateur.
 */
export function instantDepuisSaisie(valeur: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(valeur)
  // Valeur déjà horodatée (avec fuseau) ou format inattendu : on ne réinterprète
  // rien, au risque de décaler une date déjà juste.
  if (!m) return new Date(valeur).toISOString()
  const [, annee, mois, jour, heures, minutes, secondes] = m
  const t = new TZDate(
    +annee, +mois - 1, +jour,
    +heures, +minutes, +(secondes ?? 0),
    BUSINESS_TZ,
  )
  return new Date(t.getTime()).toISOString()
}

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

/**
 * Bornes de la journée en cours, de minuit à minuit, à l'heure de l'agence.
 *
 * C'est la frontière qui décide de tout sur le tableau de bord : ce qui est
 * dedans est une « tâche du jour », ce qui est avant devient une alerte. Règle
 * de Jeff du 30/07/2026 : « à minuit une, ça bascule en alerte. »
 *
 * Pourquoi ne pas se contenter de `startOfDay(new Date())` : Vercel tourne en
 * temps universel. Minuit y arrive deux heures avant minuit en France l'été,
 * et le tableau de bord du gérant changerait de jour à 22h.
 */
export function bornesDuJourAgence(reference: Date = new Date()): { debut: Date; fin: Date } {
  const [jour, mois, annee] = dateAgence(reference).split('/')
  const debut = new Date(instantDepuisSaisie(`${annee}-${mois}-${jour}T00:00`))
  const fin = new Date(debut.getTime() + 24 * 3600 * 1000 - 1)
  return { debut, fin }
}
