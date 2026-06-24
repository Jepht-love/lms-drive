import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import EditMemberForm from './EditMemberForm'

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Seul le gérant peut modifier une fiche membre.
  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'gerant') redirect('/equipe')

  const { data: member } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, color, hire_date, is_active')
    .eq('id', id)
    .single()

  if (!member) redirect('/equipe')

  return (
    <div className="space-y-4">

      {/* Retour */}
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={`/equipe/${id}`} className="w-9 h-9 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </BackButton>
        <h1 className="text-lg font-black text-gray-900">Modifier le profil</h1>
      </div>

      <EditMemberForm member={member} />

    </div>
  )
}
