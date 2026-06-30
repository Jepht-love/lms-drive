import { formatPrice, formatDate } from '@/lib/utils'
import { Car, CheckCircle2 } from 'lucide-react'

export interface VehicleSchedule {
  vehicle: { id: string; plate: string; brand: string; model: string }
  total: number
  paid: number
  remaining: number
  nbTotal: number
  nbPaid: number
  nextDue: string | null
}

/**
 * Échéancier des mensualités PAR véhicule (loyers / charges planifiées) :
 * pour chaque voiture, combien a déjà été payé et combien il reste, avec la
 * prochaine échéance et une barre de progression. Remplace la lecture à plat,
 * jugée peu lisible par le gérant.
 */
export default function VehicleDueSummary({ schedules }: { schedules: VehicleSchedule[] }) {
  if (schedules.length === 0) return null

  const totalRemaining = schedules.reduce((s, v) => s + v.remaining, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">
          Mensualités par véhicule
        </h2>
        <span className="text-[11px] font-bold text-red-500">
          {formatPrice(totalRemaining)} restant
        </span>
      </div>

      <div className="space-y-2.5">
        {schedules.map(({ vehicle, total, paid, remaining, nbTotal, nbPaid, nextDue }) => {
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0
          const done = remaining <= 0
          return (
            <div key={vehicle.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Car className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900 truncate">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">{vehicle.plate}</p>
                  </div>
                </div>
                {done ? (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-600 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Soldé
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                    {nbPaid}/{nbTotal} versées
                  </span>
                )}
              </div>

              {/* Barre de progression payé / total */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${done ? 'bg-green-500' : 'bg-[#111111]'}`}
                  style={{ width: `${pct}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Total</p>
                  <p className="text-sm font-black text-gray-900">{formatPrice(total)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Payé</p>
                  <p className="text-sm font-black text-green-600">{formatPrice(paid)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Reste</p>
                  <p className={`text-sm font-black ${done ? 'text-gray-300' : 'text-red-500'}`}>
                    {formatPrice(remaining)}
                  </p>
                </div>
              </div>

              {!done && nextDue && (
                <p className="text-[11px] text-gray-400 mt-2.5 pt-2.5 border-t border-gray-50">
                  Prochaine échéance : <span className="font-semibold text-gray-600">{formatDate(nextDue)}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
