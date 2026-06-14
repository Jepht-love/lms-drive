import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatDateTime, formatPrice, formatDate } from '@/lib/utils'
import ContractSigningPanel from './ContractSigningPanel'
import DeleteButton from '@/components/ui/DeleteButton'
import { deleteContract } from '@/lib/actions/delete'

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, reservation:reservations(*, vehicle:vehicles(*), client:clients(*))')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const reservation = contract.reservation as any
  const vehicle = reservation?.vehicle
  const client = reservation?.client

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/contracts" className="p-2 rounded-xl hover:bg-slate-100 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{contract.contract_number}</h1>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              contract.status === 'cloture'  ? 'bg-emerald-100 text-emerald-700' :
              contract.status === 'signe'    ? 'bg-green-100 text-green-700' :
              contract.status === 'a_signer' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {contract.status === 'cloture' ? 'Clôturé' :
               contract.status === 'signe'   ? 'Signé' :
               contract.status === 'a_signer'? 'À signer' : contract.status}
            </span>
          </div>
        </div>
        <DeleteButton
          onConfirm={deleteContract.bind(null, id)}
          label="Supprimer le contrat"
          confirmMessage={`Supprimer ${contract.contract_number} ? Les états des lieux associés seront aussi supprimés. Action irréversible.`}
          variant="text"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Contract preview */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">LMS Drive</h2>
                <p className="text-sm text-slate-500">Contrat de location de véhicule</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-slate-700">{contract.contract_number}</p>
                <p className="text-xs text-slate-400">Réf. {reservation?.reservation_number}</p>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Loueur</p>
                <p className="font-semibold text-slate-900">LMS Drive</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Locataire</p>
                <p className="font-semibold text-slate-900">{client?.first_name} {client?.last_name}</p>
                <p className="text-sm text-slate-500">{client?.phone}</p>
                {client?.email && <p className="text-xs text-slate-400">{client?.email}</p>}
                {client?.address && <p className="text-xs text-slate-400">{client?.address}</p>}
                {client?.license_number && (
                  <p className="text-xs text-slate-400">Permis : {client?.license_number}</p>
                )}
              </div>
            </div>

            {/* Vehicle */}
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Véhicule</p>
              <p className="font-bold text-slate-900">{vehicle?.brand} {vehicle?.model} {vehicle?.version}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="bg-slate-900 text-white text-xs font-mono px-2 py-0.5 rounded">{vehicle?.plate}</span>
                {vehicle?.color && <span className="text-xs text-slate-500">{vehicle?.color}</span>}
                {vehicle?.vin && <span className="text-xs text-slate-400">VIN: {vehicle?.vin}</span>}
              </div>
            </div>

            {/* Dates + Prix */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-medium mb-1">Départ</p>
                <p className="font-semibold text-slate-900 text-sm">{formatDateTime(reservation?.start_datetime)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3">
                <p className="text-xs text-purple-600 font-medium mb-1">Retour prévu</p>
                <p className="font-semibold text-slate-900 text-sm">{formatDateTime(reservation?.end_datetime)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="bg-slate-50 rounded-xl p-2">
                <p className="text-xs text-slate-500">Prix/jour</p>
                <p className="font-bold text-slate-900">{formatPrice(reservation?.daily_price)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2">
                <p className="text-xs text-slate-500">KM inclus</p>
                <p className="font-bold text-slate-900">{reservation?.km_included ?? '∞'}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2">
                <p className="text-xs text-green-700">Total</p>
                <p className="font-bold text-green-800">{formatPrice(reservation?.total_price)}</p>
              </div>
            </div>

            {reservation?.deposit_amount && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-800 font-medium">Caution retenue</span>
                  <span className="font-bold text-amber-900">{formatPrice(reservation?.deposit_amount)}</span>
                </div>
                <p className="text-xs text-amber-600 mt-1 capitalize">
                  Mode : {reservation?.deposit_method ?? '—'} {reservation?.deposit_ref ? `· Réf: ${reservation?.deposit_ref}` : ''}
                </p>
              </div>
            )}

            {/* Signatures display */}
            {contract.client_signature_svg && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Signature client</p>
                    <img src={contract.client_signature_svg} alt="Signature client" className="border border-slate-200 rounded-lg w-full h-20 object-contain bg-white" />
                  </div>
                  {contract.agent_signature_svg && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Signature agent</p>
                      <img src={contract.agent_signature_svg} alt="Signature agent" className="border border-slate-200 rounded-lg w-full h-20 object-contain bg-white" />
                    </div>
                  )}
                </div>
                {contract.signed_at && (
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Signé le {formatDateTime(contract.signed_at)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signing panel */}
        <ContractSigningPanel
          contract={contract}
          reservation={reservation}
          vehicle={vehicle}
          client={client}
        />
      </div>
    </div>
  )
}
