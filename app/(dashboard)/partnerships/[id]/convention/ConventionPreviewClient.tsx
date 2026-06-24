'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import SignatureCanvas from '@/components/signature/SignatureCanvas'

interface Props {
  operationId: string
  contract: any
  operation: any
  vehicle: any
  partner: any
  agency: any
}

function formatDateTime(dt?: string) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dt }
}

function formatPrice(n?: number) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// Clauses de mise à disposition (distinctes des conditions de location client) —
// la responsabilité incombe à l'agence partenaire pendant la durée du prêt.
function conventionClauses(partnerName: string, depositAmount: number) {
  return [
    { title: '1 — Objet', body: `Le propriétaire met le véhicule désigné ci-dessus à la disposition de ${partnerName} (le bénéficiaire) pour la période indiquée, dans le cadre d'une coopération inter-agences.` },
    { title: '2 — Restitution dans l\'état', body: `Le bénéficiaire s'engage à restituer le véhicule dans l'état constaté à l'état des lieux de départ, propre et avec le même niveau de carburant, sauf usure normale.` },
    { title: '3 — Responsabilité & sinistres', body: `Pendant toute la durée de la mise à disposition, le bénéficiaire est responsable du véhicule. Tout dommage, infraction ou sinistre survenu durant cette période est à sa charge et constaté à l'état des lieux de retour.` },
    { title: '4 — Assurance', body: `Le bénéficiaire garantit que le véhicule est couvert par une assurance valide pendant la mise à disposition, et fait son affaire de toute déclaration nécessaire en cas de sinistre.` },
    { title: '5 — Caution', body: `Une caution de ${formatPrice(depositAmount)} peut être retenue en garantie de la bonne restitution du véhicule et de la couverture d'éventuels frais (dommages, carburant, kilométrage).` },
    { title: '6 — États des lieux', body: `Les états des lieux de départ et de retour, photos horodatées à l'appui, font foi entre les parties pour constater l'état du véhicule à la remise et à la reprise.` },
  ]
}

export default function ConventionPreviewClient({ operationId, contract, operation, vehicle, partner, agency }: Props) {
  const router = useRouter()
  const [sig, setSig] = useState<string | null>(contract.client_signature_svg ?? null)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isSigned = contract.status === 'signe' || contract.status === 'cloture'
  const partnerName = partner?.name ?? 'Agence partenaire'
  const clauses = conventionClauses(partnerName, operation?.deposit_amount ?? 0)

  async function sign() {
    if (!sig) { setError('Veuillez apposer la signature du représentant avant de valider.'); return }
    setSigning(true); setError(null)
    const res = await fetch('/api/contracts/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: contract.id, clientSignature: sig }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { setError(data?.error ?? 'Erreur lors de la signature'); setSigning(false); return }
    setDone(true); setSigning(false)
    setTimeout(() => router.push(`/partnerships/${operationId}`), 1500)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-10 text-center max-w-sm">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Convention signée !</h2>
          <p className="text-slate-500 text-sm">Retour à l&apos;opération…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href={`/partnerships/${operationId}`} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 truncate">{contract.contract_number}</h1>
          <p className="text-xs text-slate-500">Convention de mise à disposition</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {isSigned ? 'Signée' : 'À signer'}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <Image src="/logo.png" alt="Logo agence" width={140} height={48} className="object-contain mb-2" />
              {agency?.siret && <p className="text-xs text-slate-400">SIRET : {agency.siret}</p>}
              {agency?.address && <p className="text-xs text-slate-400">{agency.address}</p>}
              {agency?.phone && <p className="text-xs text-slate-400">{agency.phone}</p>}
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-slate-800">{contract.contract_number}</p>
              <p className="text-xs text-slate-400">Convention de mise à disposition</p>
              <p className="text-xs text-slate-400">inter-agences</p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Propriétaire</p>
              <p className="font-semibold text-slate-900">{agency?.company_name ?? 'LMS Drive'}</p>
              {agency?.address && <p className="text-xs text-slate-500 mt-0.5">{agency.address}</p>}
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Bénéficiaire (agence partenaire)</p>
              <p className="font-semibold text-slate-900">{partnerName}</p>
              {partner?.contact_name && <p className="text-xs text-slate-500">{partner.contact_name}</p>}
              {partner?.phone && <p className="text-xs text-slate-500">{partner.phone}</p>}
              {partner?.siret && <p className="text-xs text-slate-400">SIRET : {partner.siret}</p>}
            </div>
          </div>

          {/* Véhicule */}
          <div className="bg-slate-900 rounded-xl p-4 mb-4 text-white">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Véhicule mis à disposition</p>
            <p className="font-bold text-lg">{vehicle?.brand} {vehicle?.model} {vehicle?.version}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="bg-slate-700 text-slate-300 font-mono text-xs px-2 py-0.5 rounded">{vehicle?.plate}</span>
              {vehicle?.color && <span className="text-slate-300 text-sm">{vehicle?.color}</span>}
            </div>
          </div>

          {/* Période + valeur */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Départ</p>
              <p className="font-semibold text-slate-900">{formatDateTime(operation?.start_date)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-600 font-medium mb-1">Retour prévu</p>
              <p className="font-semibold text-slate-900">{formatDateTime(operation?.end_date_expected)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-1 text-center">
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="text-xs text-slate-500">Montant convenu</p>
              <p className="font-bold text-slate-900">{formatPrice(operation?.rental_cost)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2">
              <p className="text-xs text-amber-700">Caution</p>
              <p className="font-bold text-amber-900">{formatPrice(operation?.deposit_amount)}</p>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">Conditions de la mise à disposition</h2>
          <div className="space-y-5">
            {clauses.map((art, i) => (
              <div key={i}>
                <h3 className="text-xs font-bold text-slate-800 mb-1.5">Art. {art.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{art.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Signature */}
        {!isSigned ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-1">Signature du représentant de {partnerName}</h2>
            <p className="text-xs text-slate-500 mb-4">
              En signant, le représentant de l&apos;agence partenaire reconnaît avoir lu et accepté les conditions de la mise à disposition.
            </p>
            <SignatureCanvas label="Signature du représentant *" onSign={setSig} onClear={() => setSig(null)} existingSig={sig} height={160} />

            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Représentant partenaire</p>
                {sig ? (
                  <img src={sig} alt="Signature" className="h-16 w-full object-contain border border-slate-200 rounded-lg bg-white" />
                ) : (
                  <div className="h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-slate-300">En attente</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Cachet & Visa propriétaire</p>
                <div className="h-16 flex items-center justify-center border border-slate-200 rounded-lg bg-slate-50">
                  <Image src="/logo.png" alt="Cachet agence" width={120} height={48} className="object-contain max-h-full" />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
              </div>
            )}

            <button
              onClick={sign}
              disabled={signing || !sig}
              className="mt-5 w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {signing ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signature en cours…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Signer la convention</>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800">Convention déjà signée</p>
            <p className="text-sm text-green-700 mt-1">
              Signée le {contract.signed_at ? new Date(contract.signed_at).toLocaleString('fr-FR') : '—'}
            </p>
            {contract.client_signature_svg && (
              <img src={contract.client_signature_svg} alt="Signature" className="h-16 mx-auto mt-3 border border-green-200 rounded-lg object-contain bg-white px-4" />
            )}
            <Link href={`/partnerships/${operationId}`} className="mt-4 inline-flex items-center gap-2 text-sm text-green-700 font-medium hover:underline">
              Retour à l&apos;opération
            </Link>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
