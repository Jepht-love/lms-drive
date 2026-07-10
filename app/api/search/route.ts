import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const scope = searchParams.get('scope') ?? ''
  const q = searchParams.get('q') ?? ''

  if (!q || q.length < 1) return NextResponse.json([])

  const supabase = await createClient()

  if (scope === 'clients') {
    const { data } = await supabase
      .from('clients')
      .select('id, first_name, last_name, phone')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(6)
    return NextResponse.json(
      (data ?? []).map(r => ({
        id: r.id,
        label: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
        sub: r.phone ?? undefined,
        href: `/clients/${r.id}`,
      }))
    )
  }

  if (scope === 'vehicles') {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`)
      .eq('is_active', true)
      .limit(6)
    return NextResponse.json(
      (data ?? []).map(r => ({
        id: r.id,
        label: `${r.brand ?? ''} ${r.model ?? ''}`.trim(),
        sub: r.plate,
        href: `/vehicles/${r.id}`,
      }))
    )
  }

  if (scope === 'reservations') {
    const [{ data: byNum }, { data: byClient }, { data: byVehicle }] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, reservation_number, vehicles(plate, brand, model), clients(first_name, last_name)')
        .ilike('reservation_number', `%${q}%`)
        .limit(3),
      supabase
        .from('clients')
        .select('first_name, last_name, phone, reservations(id, reservation_number, vehicles(plate, brand, model))')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(3),
      supabase
        .from('vehicles')
        .select('plate, brand, model, reservations(id, reservation_number, clients(first_name, last_name))')
        .or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`)
        .limit(3),
    ])
    const seen = new Set<string>()
    const out: { id: string; label: string; sub: string; href: string }[] = []
    const push = (id: string, num: string, firstName: string, lastName: string, plate: string) => {
      if (seen.has(id)) return
      seen.add(id)
      out.push({ id, label: num, sub: [firstName, lastName, plate].filter(Boolean).join(' · '), href: `/reservations/${id}` })
    }
    for (const r of byNum ?? []) {
      const v = Array.isArray(r.vehicles) ? (r.vehicles as any[])[0] : r.vehicles as any
      const c = Array.isArray(r.clients) ? (r.clients as any[])[0] : r.clients as any
      push(r.id, r.reservation_number ?? '', c?.first_name ?? '', c?.last_name ?? '', v?.plate ?? '')
    }
    for (const client of byClient ?? []) {
      const resas = Array.isArray(client.reservations) ? client.reservations : (client.reservations ? [client.reservations] : [])
      for (const r of resas as any[]) {
        if (!r?.id) continue
        const v = Array.isArray(r.vehicles) ? (r.vehicles as any[])[0] : r.vehicles as any
        push(r.id, r.reservation_number ?? '', client.first_name ?? '', client.last_name ?? '', v?.plate ?? '')
      }
    }
    for (const vehicle of byVehicle ?? []) {
      const resas = Array.isArray(vehicle.reservations) ? vehicle.reservations : (vehicle.reservations ? [vehicle.reservations] : [])
      for (const r of resas as any[]) {
        if (!r?.id) continue
        const c = Array.isArray(r.clients) ? (r.clients as any[])[0] : r.clients as any
        push(r.id, r.reservation_number ?? '', c?.first_name ?? '', c?.last_name ?? '', vehicle.plate ?? '')
      }
    }
    return NextResponse.json(out.slice(0, 6))
  }

  if (scope === 'contracts') {
    const [{ data: byNum }, { data: byClient }] = await Promise.all([
      supabase
        .from('contracts')
        .select('id, contract_number, reservation:reservations(vehicle:vehicles(plate,brand,model), client:clients(first_name,last_name))')
        .ilike('contract_number', `%${q}%`)
        .limit(4),
      supabase
        .from('clients')
        .select('first_name, last_name, reservations(contracts(id, contract_number), vehicle:vehicles(plate,brand,model))')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(3),
    ])
    const seen = new Set<string>()
    const out: { id: string; label: string; sub: string; href: string }[] = []
    for (const c of byNum ?? []) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      const res = c.reservation as any
      const v = Array.isArray(res?.vehicle) ? (res.vehicle as any[])[0] : res?.vehicle
      const cl = Array.isArray(res?.client) ? (res.client as any[])[0] : res?.client
      out.push({ id: c.id, label: c.contract_number ?? '', sub: [cl?.first_name, cl?.last_name, v?.plate].filter(Boolean).join(' · '), href: `/contracts/${c.id}` })
    }
    for (const client of byClient ?? []) {
      const resas = Array.isArray(client.reservations) ? client.reservations : (client.reservations ? [client.reservations] : [])
      for (const resa of resas as any[]) {
        const contracts = Array.isArray(resa?.contracts) ? resa.contracts : (resa?.contracts ? [resa.contracts] : [])
        for (const contract of contracts as any[]) {
          if (!contract?.id || seen.has(contract.id)) continue
          seen.add(contract.id)
          const v = Array.isArray(resa.vehicle) ? (resa.vehicle as any[])[0] : resa.vehicle
          out.push({ id: contract.id, label: contract.contract_number ?? '', sub: [client.first_name, client.last_name, v?.plate].filter(Boolean).join(' · '), href: `/contracts/${contract.id}` })
        }
      }
      if (out.length >= 6) break
    }
    return NextResponse.json(out.slice(0, 6))
  }

  return NextResponse.json([])
}
