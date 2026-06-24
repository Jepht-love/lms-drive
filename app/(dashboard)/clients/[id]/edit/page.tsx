import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import ClientForm from '../../ClientForm'
import { updateClientAction } from '@/lib/actions/clients'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const action = updateClientAction.bind(null, id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={`/clients/${id}`} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </BackButton>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modifier le client</h1>
          <p className="text-slate-500 mt-0.5">{client.first_name} {client.last_name}</p>
        </div>
      </div>
      <ClientForm action={action} client={client} />
    </div>
  )
}
