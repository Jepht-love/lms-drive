import ClientForm from '../ClientForm'
import { createClientAction } from '@/lib/actions/clients'
import BackButton from '@/components/ui/BackButton'

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/clients" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouveau client</h1>
          <p className="text-slate-500 mt-0.5">Créez la fiche d'un nouveau client</p>
        </div>
      </div>
      <ClientForm action={createClientAction} />
    </div>
  )
}
