import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistance, isAfter, isBefore, addHours } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, fmt = 'dd/MM/yyyy') {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, fmt, { locale: fr })
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr })
}

/**
 * Écrit une date au format `2026-07-31` en se basant sur le calendrier local.
 *
 * À utiliser partout où une date part vers la base ou vers un filtre de période.
 * Ne JAMAIS écrire `.toISOString().slice(0, 10)` pour ça : en France (UTC+2 en
 * été) minuit local devient 22 h la veille, donc la date recule d'un jour et une
 * période entière se décale : le 30 juin est compté en juillet, le 31 juillet
 * nulle part.
 */
export function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatRelative(date: string | Date | null | undefined) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return formatDistance(d, new Date(), { locale: fr, addSuffix: true })
}

export function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatDateRange(start: string | Date, end?: string | Date | null): string {
  if (!end) return `À partir du ${formatDate(start)}`
  return `${formatDate(start)} → ${formatDate(end)}`
}

export function generateReservationNumber(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `RES-${year}${month}-${rand}`
}

export function generateContractNumber(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `CTR-${year}${month}-${rand}`
}

export function calculateRentalDays(start: string | Date, end: string | Date): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

// Destination d'un clic sur une tâche : on va DROIT à l'action à réaliser.
// Si la tâche est rattachée à une réservation, on ouvre la réservation (où se
// font l'EDL, le contrat, la préparation…). Sinon (tâche autonome : RDV garage,
// marketing…), on retombe sur la fiche tâche, qui EST l'action dans ce cas.
export function taskActionHref(task: { id: string; reservation_id?: string | null }): string {
  return task.reservation_id
    ? `/reservations/${task.reservation_id}`
    : `/calendar/tasks/${task.id}`
}

/**
 * Jours facturés au tarif week-end (numérotation JavaScript : dimanche = 0).
 * 5 = vendredi, 6 = samedi, 0 = dimanche.
 *
 * ⚠️ C'EST LA SEULE LIGNE À MODIFIER si le gérant change la règle.
 * Exemple pour un week-end samedi + dimanche uniquement : [6, 0]
 */
export const WEEKEND_DAYS: readonly number[] = [5, 6, 0]

export function isWeekendDay(date: Date): boolean {
  return WEEKEND_DAYS.includes(date.getDay())
}

export interface RentalRates {
  /** Tarif d'un jour de semaine. */
  daily: number
  /** Tarif d'un jour de week-end. `null` → aucune majoration, tout au tarif `daily`. */
  weekend?: number | null
  /** Forfait « week-end complet » couvrant les 3 jours de `WEEKEND_DAYS`. */
  weekendFull?: number | null
  /** Forfait 7 jours. `null` → pas de forfait semaine. */
  weekly?: number | null
}

/**
 * Prix d'une location, jour par jour.
 *
 * Un « jour » est une tranche de 24 h depuis l'heure de départ, pas une date de
 * calendrier (voir `calculateRentalDays`) : un départ vendredi 20 h pour un
 * retour lundi 20 h fait 3 jours facturés — vendredi, samedi, dimanche.
 *
 * Trois tarifs, du plus prioritaire au moins prioritaire :
 *
 *  1. le **forfait 7 jours** : chaque tranche complète de 7 jours ;
 *  2. le **forfait week-end complet** : si les jours restants forment exactement
 *     le week-end (vendredi + samedi + dimanche), un prix unique remplace la
 *     somme des trois journées — c'est toujours moins cher dans la grille du
 *     gérant (M135i : 800 € au lieu de 3 × 300 = 900 €) ;
 *  3. sinon chaque journée à son tarif propre, majoré si elle tombe un jour de
 *     `WEEKEND_DAYS`. Un lundi reste au tarif de semaine.
 */
export function calculateRentalPrice(
  rates: RentalRates,
  start: string | Date,
  days: number,
): number {
  if (days <= 0) return 0
  const { daily, weekend = null, weekendFull = null, weekly = null } = rates

  // Jour de la semaine de la n-ième tranche de 24 h (0 = tranche du départ).
  const dayOfWeek = (offset: number): Date => {
    const d = new Date(start)
    d.setDate(d.getDate() + offset)
    return d
  }

  const rateForDay = (offset: number): number => {
    if (weekend == null) return daily
    return isWeekendDay(dayOfWeek(offset)) ? weekend : daily
  }

  let total = 0
  let firstCountedDay = 0

  if (weekly && days >= 7) {
    const weeks = Math.floor(days / 7)
    total += weeks * weekly
    firstCountedDay = weeks * 7
  }

  // Forfait week-end : uniquement si le reliquat est EXACTEMENT le week-end
  // entier. La double condition (bon nombre de jours + tous en week-end) ne
  // laisse passer qu'un départ le vendredi ; un samedi → mardi fait bien 3 jours
  // mais inclut un lundi, donc pas de forfait.
  const remaining = days - firstCountedDay
  const isFullWeekend =
    weekendFull != null &&
    remaining === WEEKEND_DAYS.length &&
    Array.from({ length: remaining }, (_, i) => firstCountedDay + i)
      .every(offset => isWeekendDay(dayOfWeek(offset)))

  if (isFullWeekend) {
    total += weekendFull
  } else {
    for (let i = firstCountedDay; i < days; i++) total += rateForDay(i)
  }

  return Math.round(total * 100) / 100
}

/**
 * Tarifs à appliquer à une réservation donnée.
 *
 * Si l'agent a saisi un prix/jour DIFFÉRENT du barème du véhicule, c'est un
 * tarif négocié : il s'applique alors à tous les jours, week-end compris.
 * Majorer un prix négocié reviendrait à annuler la remise consentie.
 */
export function ratesFor(
  dailyPrice: number,
  vehicle?: {
    daily_price?: number | null
    price_day_weekend?: number | null
    price_weekend_full?: number | null
    weekly_price?: number | null
  } | null,
): RentalRates {
  const atBareme = vehicle?.daily_price != null
    && Number(vehicle.daily_price) === Number(dailyPrice)
  return {
    daily: dailyPrice,
    weekend: atBareme ? (vehicle?.price_day_weekend ?? null) : null,
    weekendFull: atBareme ? (vehicle?.price_weekend_full ?? null) : null,
    weekly: vehicle?.weekly_price ?? null,
  }
}

/**
 * Remise accordée sur une réservation, DÉRIVÉE (aucune colonne dédiée) :
 * écart entre le tarif au barème (prix/jour figé de la résa, tarif semaine
 * appliqué) et le prix total réellement facturé. Positif = remise consentie
 * (prix total négocié à la baisse via « Modifier les dates & tarif »).
 * Zéro si le total colle au barème ou le dépasse (majoration, pas une remise).
 * Fiable car en mode « prix total » daily_price reste le barème d'origine.
 */
type DiscountVehicle = {
  daily_price?: number | null
  price_day_weekend?: number | null
  price_weekend_full?: number | null
  weekly_price?: number | null
}

export function reservationDiscount(r: {
  start_datetime: string
  end_datetime: string
  daily_price: number | null
  total_price: number | null
  vehicle?: DiscountVehicle | DiscountVehicle[] | null
}): { standard: number; discount: number; percent: number } {
  const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle
  const days = calculateRentalDays(r.start_datetime, r.end_datetime)
  const standard = calculateRentalPrice(ratesFor(r.daily_price ?? 0, v), r.start_datetime, days)
  const raw = standard - (r.total_price ?? 0)
  const discount = raw > 0 ? Math.round(raw * 100) / 100 : 0
  const percent = standard > 0 ? Math.round((discount / standard) * 100) : 0
  return { standard, discount, percent }
}

export function isReturnLate(endDatetime: string): boolean {
  return isBefore(new Date(endDatetime), new Date())
}

export function isDepartureSoon(startDatetime: string, hoursThreshold = 1): boolean {
  const now = new Date()
  const start = new Date(startDatetime)
  return isAfter(start, now) && isBefore(start, addHours(now, hoursThreshold))
}

export function getVehicleStatusColor(status: string): string {
  const colors: Record<string, string> = {
    disponible: 'bg-green-100 text-green-800 border-green-200',
    loue: 'bg-blue-100 text-blue-800 border-blue-200',
    reserve: 'bg-orange-100 text-orange-800 border-orange-200',
    maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    hors_service: 'bg-red-100 text-red-800 border-red-200',
    en_verification: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    immobilise: 'bg-red-100 text-red-800 border-red-200',
    mis_a_disposition: 'bg-purple-100 text-purple-800 border-purple-200',
    a_reparer: 'bg-red-100 text-red-800 border-red-200',
    fourriere: 'bg-rose-100 text-rose-800 border-rose-200',
    non_restitue: 'bg-red-100 text-red-800 border-red-200',
    deplacement_pro: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-200'
}

export function getVehicleStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    disponible: 'Disponible',
    loue: 'Loué',
    reserve: 'Réservé',
    maintenance: 'Maintenance',
    hors_service: 'Hors service',
    en_verification: 'Vérification',
    immobilise: 'Immobilisé',
    mis_a_disposition: 'Chez partenaire',
    a_reparer: 'À réparer',
    fourriere: 'Fourrière',
    non_restitue: 'Non restitué',
    deplacement_pro: 'Déplacement pro',
  }
  return labels[status] ?? status
}

export function getReservationStatusColor(status: string): string {
  const colors: Record<string, string> = {
    option: 'bg-gray-100 text-gray-700',
    confirmee: 'bg-blue-100 text-blue-700',
    en_cours: 'bg-green-100 text-green-700',
    terminee: 'bg-gray-100 text-gray-700',
    annulee: 'bg-red-100 text-red-700',
    en_retard: 'bg-orange-100 text-orange-700',
    // Ambre plutôt que rouge : ce n'est pas une faute de l'agence, et l'acompte
    // reste acquis. Se distingue quand même d'une annulation ordinaire.
    non_presente: 'bg-amber-100 text-amber-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

export function getReservationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    option: 'À venir',
    confirmee: 'Confirmée',
    en_cours: 'En location',
    terminee: 'Terminée',
    annulee: 'Annulée',
    en_retard: 'En retard',
    non_presente: 'Client non présenté',
  }
  return labels[status] ?? status
}

export function getClientStatusColor(status: string): string {
  const colors: Record<string, string> = {
    standard: 'bg-gray-100 text-gray-700',
    vip: 'bg-amber-100 text-amber-700',
    blackliste: 'bg-red-100 text-red-700',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

export function compressImageToBase64(file: File, maxSizeKB = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    // L'adresse temporaire créée pour lire la photo retient le fichier ENTIER en
    // mémoire jusqu'à ce qu'on la libère. Sans ça, un état des lieux de dix photos
    // gardait dix fichiers de 3 à 5 Mo en mémoire jusqu'au rechargement de la page —
    // sur iPhone, l'onglet finit par être fermé d'office par le système.
    let objectUrl = ''
    const release = () => { if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = '' } }

    img.onload = () => {
      let { width, height } = img
      const maxDim = 1920

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      // Libéré une fois la photo recopiée dans le canevas : à partir de là, plus
      // besoin du fichier d'origine.
      release()

      let quality = 0.85
      let dataUrl = canvas.toDataURL('image/jpeg', quality)

      while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }

      resolve(dataUrl)
    }

    img.onerror = e => { release(); reject(e) }
    objectUrl = URL.createObjectURL(file)
    img.src = objectUrl
  })
}

/**
 * Réduit une photo avant envoi, en gardant un vrai fichier (pas du base64 : celui-ci
 * pèse 37 % de plus sur le réseau). Mêmes réglages que `compressImageToBase64`, déjà
 * éprouvés sur les états des lieux : 1920 px au plus grand côté, JPEG qualité 0,85,
 * puis baisse par paliers jusqu'à tenir sous la limite.
 *
 * Une photo de permis prise au téléphone fait 3 à 5 Mo et s'affiche en vignette de
 * 96 px : la transmettre en pleine taille ralentit la fiche client sur le terrain,
 * dans les deux sens.
 *
 * Prudence volontaire — on ne touche pas :
 * - aux PDF et autres documents non-images ;
 * - aux PNG (une transparence deviendrait un fond noir) ni aux GIF (animation perdue)
 *   ni aux SVG (image vectorielle, aucun intérêt à la pixeliser) ;
 * - aux fichiers déjà légers (≤ 800 Ko), inutile de les ré-encoder et d'y perdre.
 *
 * En cas d'échec de lecture (format que le navigateur ne décode pas), on renvoie le
 * fichier d'origine : un envoi qui aboutit vaut mieux qu'un envoi optimisé qui casse.
 */
const COMPRESSIBLE = ['image/jpeg', 'image/jpg', 'image/heic', 'image/heif', 'image/webp']

export async function compressImageFile(file: File, maxSizeKB = 1500): Promise<File> {
  if (!COMPRESSIBLE.includes(file.type.toLowerCase())) return file
  if (file.size <= 800 * 1024) return file

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('décodage impossible'))
      i.src = objectUrl
    })

    let { width, height } = img
    const maxDim = 1920
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
      else { width = Math.round((width * maxDim) / height); height = maxDim }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)

    const toBlob = (q: number) =>
      new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', q))

    let quality = 0.85
    let blob = await toBlob(quality)
    while (blob && blob.size > maxSizeKB * 1024 && quality > 0.3) {
      quality -= 0.1
      blob = await toBlob(quality)
    }
    // Le ré-encodage n'a rien gagné (photo déjà bien compressée) → on garde l'original.
    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
