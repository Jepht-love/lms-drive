'use client'

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  monthly: { month: string; revenue: number; expenses: number }[]
  expensesByCategory: { label: string; amount: number }[]
  vehicleData: { name: string; revenue: number; expenses: number }[]
}

const euro = (v: number) => `${(v ?? 0).toLocaleString('fr-FR')} €`

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">{title}</p>
      {children}
    </div>
  )
}

export default function AccountingCharts({ monthly, expensesByCategory, vehicleData }: Props) {
  const hasData = monthly.some(m => m.revenue || m.expenses)

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-gray-400 font-medium text-sm">Aucune donnée à visualiser pour cette année</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card title="Évolution mensuelle">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthly} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: any) => euro(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="revenue" stroke="#16A34A" strokeWidth={2} dot={false} name="Recettes" />
            <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} dot={false} name="Dépenses" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {expensesByCategory.length > 0 && (
        <Card title="Dépenses par catégorie">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={expensesByCategory} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v) => `${v}€`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} width={110} />
              <Tooltip formatter={(v: any) => euro(Number(v))} />
              <Bar dataKey="amount" fill="#EF4444" radius={[0, 4, 4, 0]} name="Montant" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {vehicleData.length > 0 && (
        <Card title="Rentabilité par véhicule">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={vehicleData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: any) => euro(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" fill="#22C55E" radius={[4, 4, 0, 0]} name="Recettes" />
              <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} name="Dépenses" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
