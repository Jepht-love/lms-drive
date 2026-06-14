export function calculateLateFee(vehicleCategory: string, lateMinutes: number): number {
  const TOLERANCE = 60
  if (lateMinutes <= TOLERANCE) return 0
  const lateHours = Math.ceil((lateMinutes - TOLERANCE) / 60)
  const ratePerHour = vehicleCategory === 'sportif' ? 150 : 50
  return lateHours * ratePerHour
}

export function calculateExtraKm(
  kmAtDeparture: number,
  kmAtReturn: number,
  kmIncluded: number,
  extraKmPrice: number = 2,
): { extraKm: number; amount: number } {
  const totalDriven = Math.max(0, kmAtReturn - kmAtDeparture)
  const extraKm = Math.max(0, totalDriven - kmIncluded)
  return {
    extraKm,
    amount: Math.round(extraKm * extraKmPrice * 100) / 100,
  }
}
