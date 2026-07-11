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

export function calculateRentalPrice(
  dailyPrice: number,
  weeklyPrice: number | null,
  days: number
): number {
  if (weeklyPrice && days >= 7) {
    const weeks = Math.floor(days / 7)
    const remainingDays = days % 7
    return weeks * weeklyPrice + remainingDays * dailyPrice
  }
  return days * dailyPrice
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
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

export function getReservationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    option: 'En cours',
    confirmee: 'Confirmée',
    en_cours: 'En location',
    terminee: 'Terminée',
    annulee: 'Annulée',
    en_retard: 'En retard',
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

      let quality = 0.85
      let dataUrl = canvas.toDataURL('image/jpeg', quality)

      while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }

      resolve(dataUrl)
    }

    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
