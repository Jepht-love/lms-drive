import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const scope = searchParams.get('scope') ?? ''
  const q = searchParams.get('q') ?? ''

  if (!q || q.length < 1) return NextResponse.json([])

  const supabase = createAdminClient()

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

  if (scope === 'maintenance') {
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
        href: `/maintenance/${r.id}`,
      }))
    )
  }

  if (scope === 'infractions') {
    const [{ data: byVehicle }, { data: byClient }] = await Promise.all([
      supabase
        .from('infractions')
        .select('id, infraction_date, vehicles!inner(plate, brand, model), clients(first_name, last_name)')
        .or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`, { referencedTable: 'vehicles' })
        .order('infraction_date', { ascending: false })
        .limit(6),
      supabase
        .from('infractions')
        .select('id, infraction_date, vehicles(plate, brand, model), clients!inner(first_name, last_name)')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, { referencedTable: 'clients' })
        .order('infraction_date', { ascending: false })
        .limit(6),
    ])
    const seen = new Set<string>()
    const out: { id: string; label: string; sub: string; href: string }[] = []
    for (const r of [...(byVehicle ?? []), ...(byClient ?? [])] as any[]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
      const c = Array.isArray(r.clients) ? r.clients[0] : r.clients
      out.push({
        id: r.id,
        label: v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : 'Infraction',
        sub: [formatDate(r.infraction_date), v?.plate, c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Interne'].filter(Boolean).join(' · '),
        href: `/incidents/infractions/${r.id}`,
      })
    }
    return NextResponse.json(out.slice(0, 6))
  }

  if (scope === 'sinistres') {
    const [{ data: byVehicle }, { data: byClient }] = await Promise.all([
      supabase
        .from('accidents')
        .select('id, accident_date, vehicles!inner(plate, brand, model), clients(first_name, last_name)')
        .or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`, { referencedTable: 'vehicles' })
        .order('accident_date', { ascending: false })
        .limit(6),
      supabase
        .from('accidents')
        .select('id, accident_date, vehicles(plate, brand, model), clients!inner(first_name, last_name)')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, { referencedTable: 'clients' })
        .order('accident_date', { ascending: false })
        .limit(6),
    ])
    const seen = new Set<string>()
    const out: { id: string; label: string; sub: string; href: string }[] = []
    for (const r of [...(byVehicle ?? []), ...(byClient ?? [])] as any[]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
      const c = Array.isArray(r.clients) ? r.clients[0] : r.clients
      out.push({
        id: r.id,
        label: v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : 'Sinistre',
        sub: [formatDate(r.accident_date), v?.plate, c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Interne'].filter(Boolean).join(' · '),
        href: `/incidents/sinistres/${r.id}`,
      })
    }
    return NextResponse.json(out.slice(0, 6))
  }

  if (scope === 'partnerships') {
    const [{ data: byAgency }, { data: byVehicle }] = await Promise.all([
      supabase
        .from('inter_agency_rentals')
        .select('id, start_date, direction, external_vehicle_description, partner_agencies!inner(name), vehicles(plate, brand, model)')
        .or(`name.ilike.%${q}%`, { referencedTable: 'partner_agencies' })
        .order('start_date', { ascending: false })
        .limit(6),
      supabase
        .from('inter_agency_rentals')
        .select('id, start_date, direction, external_vehicle_description, partner_agencies(name), vehicles!inner(plate, brand, model)')
        .or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`, { referencedTable: 'vehicles' })
        .order('start_date', { ascending: false })
        .limit(6),
    ])
    const seen = new Set<string>()
    const out: { id: string; label: string; sub: string; href: string }[] = []
    for (const r of [...(byAgency ?? []), ...(byVehicle ?? [])] as any[]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      const a = Array.isArray(r.partner_agencies) ? r.partner_agencies[0] : r.partner_agencies
      const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
      const vehicleLabel = v ? v.plate : (r.external_vehicle_description || '')
      out.push({
        id: r.id,
        label: a?.name || r.external_vehicle_description || 'Opération',
        sub: [formatDate(r.start_date), r.direction === 'out' ? '→ Sortant' : '← Entrant', vehicleLabel].filter(Boolean).join(' · '),
        href: `/partnerships/${r.id}`,
      })
    }
    return NextResponse.json(out.slice(0, 6))
  }

  return NextResponse.json([])
}
