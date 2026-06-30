'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  monthlyForecast: { label: string; revenue: number; expenses: number }[]
}

const euro = (v: number) => `${(v ?? 0).toLocaleString('fr-FR')} €`

export default function DueDatesChart({ monthlyForecast }: Props) {
  if (monthlyForecast.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
        Prévisionnel des échéances non réglées, par mois
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthlyForecast} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v: any) => euro(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" fill="#16A34A" radius={[4, 4, 0, 0]} name="Paiements attendus" />
          <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} name="Factures à régler" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
