'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Vehicle { id: string; plate: string; brand: string; model: string }

export default function VehicleFilter({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get('vehicle') ?? ''

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString())
    if (e.target.value) next.set('vehicle', e.target.value)
    else next.delete('vehicle')
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white focus:outline-none focus:border-gray-400"
    >
      <option value="">Tous les véhicules</option>
      {vehicles.map(v => (
        <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>
      ))}
    </select>
  )
}
