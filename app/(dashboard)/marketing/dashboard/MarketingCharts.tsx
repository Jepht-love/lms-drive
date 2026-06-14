'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts'

interface Props {
  monthlyData:  { month: string; count: number }[]
  channelData:  { label: string; roi: number }[]
}

export default function MarketingCharts({ monthlyData, channelData }: Props) {
  return (
    <div className="space-y-4">
      {/* D1 — Évolution réservations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Réservations / mois</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} allowDecimals={false} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [`${v} résa`, 'Réservations']}
              contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #F3F4F6' }}
            />
            <Line type="monotone" dataKey="count" stroke="#111111" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* D2 — ROI par canal */}
      {channelData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">ROI par canal (campagnes terminées)</p>
          <ResponsiveContainer width="100%" height={Math.max(160, channelData.length * 36)}>
            <BarChart data={channelData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} width={110} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${v}%`, 'ROI']}
                contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #F3F4F6' }}
              />
              <Bar
                dataKey="roi"
                fill="#111111"
                radius={[0, 4, 4, 0]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={{ position: 'right', fontSize: 10, fill: '#6B7280', formatter: (v: any) => `${v > 0 ? '+' : ''}${Number(v).toFixed(0)}%` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
