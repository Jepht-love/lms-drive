'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AccountingCustomPeriod({
  from,
  to,
  type,
}: {
  from?: string
  to?: string
  type?: string
}) {
  const router = useRouter()
  const [f, setF] = useState(from ?? '')
  const [t, setT] = useState(to ?? '')

  function apply() {
    if (!f || !t) return
    const q = new URLSearchParams({ period: 'custom', from: f, to: t })
    if (type) q.set('type', type)
    router.push(`/accounting?${q.toString()}`)
  }

  const inp = 'flex-1 border border-gray-200 rounded-xl px-3 py-2 text-[13px] text-gray-800 bg-white'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-end">
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Du</p>
        <input type="date" value={f} onChange={e => setF(e.target.value)} className={inp} />
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Au</p>
        <input type="date" value={t} onChange={e => setT(e.target.value)} className={inp} />
      </div>
      <button
        onClick={apply}
        disabled={!f || !t}
        className="px-4 py-2 bg-[#111111] text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex-shrink-0"
      >
        Appliquer
      </button>
    </div>
  )
}
