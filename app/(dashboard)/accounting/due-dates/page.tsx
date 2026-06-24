import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import DueDatesClient from './DueDatesClient'

export default async function DueDatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const [{ data: dueDates }, { data: vehicles }] = await Promise.all([
    supabase
      .from('financial_due_dates')
      .select('*, vehicles(plate)')
      .order('due_date', { ascending: true }),
    supabase.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand'),
  ])

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Échéances à venir</h1>
      <DueDatesClient dueDates={dueDates ?? []} vehicles={vehicles ?? []} />
    </div>
  )
}
