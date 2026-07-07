import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { roleLabel } from '@/lib/roles'
import LogoutButton from './LogoutButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <User className="w-6 h-6 text-gray-700" />
        <h1 className="text-xl font-black text-gray-900">Mon profil</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
            <span className="text-blue-700 font-bold text-2xl">{(profile.full_name ?? '?').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              profile.role === 'gerant' ? 'bg-purple-100 text-purple-700' :
              profile.role === 'associe' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {roleLabel(profile.role)}
            </span>
          </div>
        </div>

        <dl className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-sm font-medium text-gray-900">{user.email}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Téléphone</dt>
            <dd className="text-sm font-medium text-gray-900">{profile.phone ?? '—'}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Rôle</dt>
            <dd className="text-sm font-medium text-gray-900">{roleLabel(profile.role)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-sm text-gray-500">Membre depuis</dt>
            <dd className="text-sm font-medium text-gray-900">{formatDate(profile.created_at)}</dd>
          </div>
        </dl>
      </div>

      <LogoutButton />
    </div>
  )
}
