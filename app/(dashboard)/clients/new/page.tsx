import ClientForm from '../ClientForm'
import { createClientAction } from '@/lib/actions/clients'

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nouveau client</h1>
        <p className="text-slate-500 mt-0.5">Créez la fiche d'un nouveau client</p>
      </div>
      <ClientForm action={createClientAction} />
    </div>
  )
}
