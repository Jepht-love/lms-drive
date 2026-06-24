'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatDate } from '@/lib/utils'
import { FileDown, Check, Minus } from 'lucide-react'
import AnimatedTabs from '@/components/AnimatedTabs'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'

type VehicleSource = 'all' | 'propre' | 'inter_agence'

type ReservationRow = {
  id: string
  reservation_number: string
  start_datetime: string
  end_datetime: string
  total_price: number
  client_name: string
  vehicle_plate: string
  vehicle_brand: string
  vehicle_model: string
  source: 'propre' | 'inter_agence'
}

const PERIODS = [
  { id: 'month', label: 'Ce mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
  { id: 'custom', label: 'Personnalisé' },
]

function periodRange(period: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (period === 'month') {
    return { from: new Date(y, m, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3)
    return { from: new Date(y, q * 3, 1).toISOString().slice(0, 10), to: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10) }
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

export default function AccountingReportPage() {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [source, setSource] = useState<VehicleSource>('all')
  const [rows, setRows] = useState<ReservationRow[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [, startTransition] = useTransition()
  const supabase = createClient()

  const isCustom = period === 'custom'
  const customReady = isCustom && !!customFrom && !!customTo

  useEffect(() => {
    if (isCustom && !customReady) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setExcluded(new Set())
    const { from, to } = isCustom ? { from: customFrom, to: customTo } : periodRange(period)

    Promise.all([
      supabase
        .from('reservations')
        .select('id, reservation_number, start_datetime, end_datetime, total_price, clients(first_name, last_name), vehicles(plate, brand, model)')
        .eq('status', 'terminee')
        .gte('start_datetime', from)
        .lte('start_datetime', to + 'T23:59:59'),
      // Les deux sens comptent dans le CA inter-agences : sortante = montant reçu
      // (rental_cost), entrante = prix facturé au client (client_price). Pas de
      // filtre de statut — une opération compte dès qu'elle existe (créée en
      // 'en_cours', clôturée bien plus tard) ; sinon le CA resterait à 0 jusqu'à
      // la clôture manuelle, ce qui n'a aucun sens pour un rapport de période.
      supabase
        .from('inter_agency_rentals')
        .select('id, direction, start_date, end_date_expected, rental_cost, client_price, external_vehicle_description, partner_agencies(name), vehicles(plate, brand, model)')
        .gte('start_date', from)
        .lte('start_date', to),
    ]).then(([{ data: res }, { data: iar }]) => {
      const ownRows: ReservationRow[] = (res ?? []).map((r: any) => {
        const c = Array.isArray(r.clients) ? r.clients[0] : r.clients
        const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
        return {
          id: r.id,
          reservation_number: r.reservation_number,
          start_datetime: r.start_datetime,
          end_datetime: r.end_datetime,
          total_price: r.total_price ?? 0,
          client_name: c ? `${c.first_name} ${c.last_name}` : '—',
          vehicle_plate: v?.plate ?? '—',
          vehicle_brand: v?.brand ?? '',
          vehicle_model: v?.model ?? '',
          source: 'propre',
        }
      })
      const interRows: ReservationRow[] = (iar ?? []).map((r: any) => {
        const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
        const p = Array.isArray(r.partner_agencies) ? r.partner_agencies[0] : r.partner_agencies
        // Revenu selon le sens : sortante = reçu du partenaire, entrante = facturé au client.
        const revenue = r.direction === 'out' ? (r.rental_cost ?? 0) : (r.client_price ?? 0)
        return {
          id: r.id,
          reservation_number: `IA-${r.id.slice(0, 8).toUpperCase()}`,
          start_datetime: r.start_date,
          end_datetime: r.end_date_expected ?? r.start_date,
          total_price: revenue,
          client_name: p?.name ?? 'Agence partenaire',
          vehicle_plate: v?.plate ?? (r.external_vehicle_description ? '' : '—'),
          vehicle_brand: v?.brand ?? (r.external_vehicle_description ?? ''),
          vehicle_model: v?.model ?? '',
          source: 'inter_agence' as const,
        }
      }).filter(r => r.total_price > 0)
      setRows([...ownRows, ...interRows].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)))
      setLoading(false)
    })
  }, [period, customFrom, customTo])

  const visibleRows = useMemo(() => {
    if (source === 'all') return rows
    return rows.filter(r => r.source === source)
  }, [rows, source])

  const includedRows = useMemo(() => visibleRows.filter(r => !excluded.has(r.id)), [visibleRows, excluded])
  const totalCA = useMemo(() => includedRows.reduce((s, r) => s + r.total_price, 0), [includedRows])
  const totalPropre = useMemo(() => includedRows.filter(r => r.source === 'propre').reduce((s, r) => s + r.total_price, 0), [includedRows])
  const totalInter = useMemo(() => includedRows.filter(r => r.source === 'inter_agence').reduce((s, r) => s + r.total_price, 0), [includedRows])

  function toggleAll() {
    if (excluded.size === visibleRows.length) {
      setExcluded(new Set())
    } else {
      setExcluded(new Set(visibleRows.map(r => r.id)))
    }
  }

  function toggle(id: string) {
    startTransition(() => {
      setExcluded(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    })
  }

  function handleExport() {
    const lines = [
      ['N° Réservation', 'Date début', 'Date fin', 'Véhicule', 'Client/Agence', 'Montant TTC'],
      ...includedRows.map(r => [
        r.reservation_number,
        formatDate(r.start_datetime),
        formatDate(r.end_datetime),
        `${r.vehicle_brand} ${r.vehicle_model} (${r.vehicle_plate})`,
        r.client_name,
        r.total_price.toFixed(2) + ' €',
      ]),
      [],
      ['', '', '', '', 'TOTAL', totalCA.toFixed(2) + ' €'],
    ]
    const csv = lines.map(l => l.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-ca-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sourceTabs = [
    { id: 'all', label: 'Tous', count: rows.length },
    { id: 'propre', label: 'Véhicules propres', count: rows.filter(r => r.source === 'propre').length },
    { id: 'inter_agence', label: 'Inter-agences', count: rows.filter(r => r.source === 'inter_agence').length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Rapport CA</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sélectionnez les réservations à inclure</p>
        </div>
        <button
          onClick={handleExport}
          disabled={includedRows.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-40 min-h-[auto] active:scale-[.97]"
        >
          <FileDown className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      {/* Période */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors min-h-[auto] ${
              period === p.id ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <input
            type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900"
          />
          <span className="text-gray-400 text-xs">→</span>
          <input
            type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900"
          />
        </div>
      )}

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">CA Total</p>
          <p className="text-[18px] font-black text-gray-900 leading-tight">{formatPrice(totalCA)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-green-500 mb-1">Propres</p>
          <p className="text-[18px] font-black text-green-600 leading-tight">{formatPrice(totalPropre)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-1">Inter-agences</p>
          <p className="text-[18px] font-black text-blue-600 leading-tight">{formatPrice(totalInter)}</p>
        </div>
      </div>

      {/* Filtre source */}
      <AnimatedTabs
        tabs={sourceTabs}
        active={source}
        onChange={v => setSource(v as VehicleSource)}
        layoutId="report-source"
      />

      {/* Barre tout sélectionner */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 min-h-[auto]"
        >
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
            excluded.size === 0 ? 'bg-[#111111] border-[#111111]' :
            excluded.size < visibleRows.length ? 'bg-gray-200 border-gray-400' :
            'bg-white border-gray-300'
          }`}>
            {excluded.size === 0 && <Check className="w-3 h-3 text-white" />}
            {excluded.size > 0 && excluded.size < visibleRows.length && <Minus className="w-3 h-3 text-gray-600" />}
          </div>
          {excluded.size === 0 ? 'Tout décocher' : excluded.size === visibleRows.length ? 'Tout cocher' : `${includedRows.length} sélectionnés`}
        </button>
        <span className="text-sm text-gray-400">{includedRows.length}/{visibleRows.length} inclus</span>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">Aucune réservation terminée sur cette période</p>
        </div>
      ) : (
        <AnimatedList className="space-y-2">
          {visibleRows.map(row => {
            const isIncluded = !excluded.has(row.id)
            return (
              <AnimatedListItem key={row.id}>
                <button
                  onClick={() => toggle(row.id)}
                  className="w-full text-left min-h-[auto]"
                >
                  <div className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                    isIncluded ? 'border-gray-100 opacity-100' : 'border-gray-100 opacity-40'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isIncluded ? 'bg-[#111111] border-[#111111]' : 'bg-white border-gray-300'
                      }`}>
                        {isIncluded && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">{row.vehicle_brand} {row.vehicle_model}</span>
                          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{row.vehicle_plate}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            row.source === 'propre' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {row.source === 'propre' ? 'Propre' : 'Inter-agence'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{row.client_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(row.start_datetime)} → {formatDate(row.end_datetime)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-black text-gray-900">{formatPrice(row.total_price)}</p>
                        <p className="text-[10px] text-gray-400">{row.reservation_number}</p>
                      </div>
                    </div>
                  </div>
                </button>
              </AnimatedListItem>
            )
          })}
        </AnimatedList>
      )}
    </div>
  )
}
