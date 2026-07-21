'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, CheckCircle2, FileDown, AlertCircle, Mail } from 'lucide-react'
import Link from 'next/link'
import SignatureCanvas from '@/components/signature/SignatureCanvas'
import VehicleInspectionMap from '@/components/vehicle-schema/VehicleInspectionMap'
import { graviteLabel, type DamageEntry, type DamageSeverity } from '@/components/vehicle-schema/inspection-types'
import { getLegalArticles, getFeesTable, VIDEO_CLAUSE } from '@/lib/contracts/legal-articles'

// État des lieux de départ assemblé côté serveur (page.tsx) pour être relu dans
// la prévisualisation du contrat, juste avant la signature.
export interface DepartInspection {
  kmReading: number
  fuelRangeKm: number
  exteriorCleanliness: number
  interiorCleanliness: number
  damagedZones: any[]
  clientSignature: string | null
  signedAt: string | null
  photos: { url: string; label: string }[]
}

interface Props {
  contract: any
  reservation: any
  vehicle: any
  client: any
  agency: any
  // Contexte d'enchaînement : 'depart' = on arrive directement de la validation
  // de l'EDL départ (bannière + « Terminer » revient à la réservation).
  chain?: string | null
  departInspection?: DepartInspection | null
}

const CLEANLINESS_LABELS: Record<number, string> = {
  1: 'Sale', 2: 'Moyen', 3: 'Normal', 4: 'Propre', 5: 'Très propre',
}

function formatDateTime(dt?: string) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dt }
}

function formatPrice(n?: number) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function ContractPreviewClient({ contract, reservation, vehicle, client, agency, chain, departInspection }: Props) {
  const router = useRouter()
  const [clientSig, setClientSig] = useState<string | null>(contract.client_signature_svg ?? null)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Après signature : on conserve le PDF généré pour proposer le choix
  // « télécharger » / « envoyer par email » (au lieu d'un téléchargement forcé).
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMsg, setEmailMsg] = useState<string | null>(null)

  const isSigned = contract.status === 'signe' || contract.status === 'cloture'

  // Schéma readonly de l'EDL départ : reconstruit le Record<zoneId, DamageEntry[]>
  // à partir des zones stockées (les postes intérieurs n'ont pas de zone carrosserie).
  const departDamages = useMemo<Record<string, DamageEntry[]>>(() => {
    const map: Record<string, DamageEntry[]> = {}
    for (const z of departInspection?.damagedZones ?? []) {
      if (z?.kind === 'interieur' || z?.type === 'interieur' || !z?.id) continue
      ;(map[z.id] ??= []).push({
        severity: (z.severity ?? 'dommage') as DamageSeverity,
        type: z.type ?? undefined,
        comment: z.description ?? '',
        photos: Array.isArray(z.photos) ? z.photos : [],
      })
    }
    return map
  }, [departInspection])
  const departDamageCount = Object.keys(departDamages).length

  const isSport = vehicle?.category === 'sportif'
  const isSmartFortwo =
    vehicle?.model?.toLowerCase().includes('smart') ||
    vehicle?.brand?.toLowerCase().includes('smart') ||
    false
  const fees = getFeesTable(vehicle?.category ?? 'citadine', isSmartFortwo)
  const articles = getLegalArticles({
    franchise: fees.franchise,
    retardHeure: fees.retard,
    caution: reservation?.deposit_amount ?? 0,
  })

  async function sign() {
    if (!clientSig) { setError('Veuillez apposer votre signature avant de valider.'); return }
    setSigning(true)
    setError(null)

    // 1. Enregistrer la signature
    const signRes = await fetch('/api/contracts/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: contract.id, clientSignature: clientSig }),
    })
    const signData = await signRes.json()
    if (signData.error) { setError(signData.error); setSigning(false); return }

    // 2. Générer le PDF définitif
    const pdfRes = await fetch('/api/contracts/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: contract.id }),
    })
    if (!pdfRes.ok) {
      const d = await pdfRes.json()
      setError(d.error ?? 'Erreur génération PDF')
      setSigning(false)
      return
    }

    // Le PDF est conservé pour un choix explicite (télécharger / envoyer),
    // et déjà archivé dans les Documents par la route generate-pdf.
    const blob = await pdfRes.blob().catch(() => null)
    setPdfBlob(blob)
    setDone(true)
    setSigning(false)
  }

  function downloadPdf() {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contract.contract_number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function sendEmail() {
    setEmailState('sending')
    setEmailMsg(null)
    try {
      const res = await fetch('/api/contracts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Échec de l'envoi")
      setEmailState('sent')
    } catch (e: any) {
      setEmailState('error')
      setEmailMsg(e?.message ?? "Erreur lors de l'envoi")
    }
  }

  function finish() {
    router.replace(reservation?.id ? `/reservations/${reservation.id}` : '/reservations')
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center max-w-md w-full space-y-5">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Contrat signé</h2>
            <p className="text-gray-500 text-sm mt-1">
              Le contrat{departInspection ? " (avec l'état des lieux de départ)" : ''} a été généré et{' '}
              <strong>enregistré dans les Documents</strong>. Vous pouvez le télécharger ou l&apos;envoyer au client.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={downloadPdf}
              disabled={!pdfBlob}
              className="w-full py-3.5 bg-[#111111] hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <FileDown className="w-4 h-4" /> Télécharger le contrat (PDF)
            </button>

            {client?.email ? (
              emailState === 'sent' ? (
                <div className="w-full py-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Envoyé à {client.email}
                </div>
              ) : (
                <button
                  onClick={sendEmail}
                  disabled={emailState === 'sending'}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {emailState === 'sending' ? 'Envoi…' : 'Envoyer par email au client'}
                </button>
              )
            ) : (
              <p className="text-xs text-gray-400">Aucun email client renseigné — envoi par email indisponible.</p>
            )}
            {emailState === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{emailMsg}</p>
            )}
          </div>

          <button onClick={finish} className="w-full py-3 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors">
            Terminer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href={`/contracts/${contract.id}`} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{contract.contract_number}</h1>
          <p className="text-xs text-gray-500">Prévisualisation contrat</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          isSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isSigned ? 'Signé' : 'À signer'}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Bannière d'enchaînement depuis l'EDL départ */}
        {chain === 'depart' && !isSigned && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-800">
              <strong>État des lieux de départ enregistré.</strong> Dernière étape : faites relire et signer le contrat au locataire ci-dessous.
            </p>
          </div>
        )}

        {/* ── En-tête contrat ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <Image src="/logo.png" alt="Logo agence" width={140} height={48} className="object-contain mb-2" />
              {agency?.siret && <p className="text-xs text-gray-400">SIRET : {agency.siret}</p>}
              {agency?.address && <p className="text-xs text-gray-400">{agency.address}</p>}
              {agency?.phone && <p className="text-xs text-gray-400">{agency.phone}</p>}
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-gray-800">{contract.contract_number}</p>
              <p className="text-xs text-gray-400">Réf. {reservation?.reservation_number}</p>
              <p className="text-xs text-gray-400">Contrat de location de véhicule</p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Loueur</p>
              <p className="font-semibold text-gray-900">{agency?.company_name ?? 'LMS Drive'}</p>
              {agency?.address && <p className="text-xs text-gray-500 mt-0.5">{agency.address}</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Locataire</p>
              <p className="font-semibold text-gray-900">{client?.first_name} {client?.last_name}</p>
              <p className="text-xs text-gray-500">{client?.phone}</p>
              {client?.email && <p className="text-xs text-gray-400">{client?.email}</p>}
              {client?.license_number && <p className="text-xs text-gray-400">Permis : {client?.license_number}</p>}
            </div>
          </div>

          {/* Véhicule */}
          <div className="bg-[#111111] rounded-xl p-4 mb-4 text-white">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Véhicule loué</p>
            <p className="font-bold text-lg">{vehicle?.brand} {vehicle?.model} {vehicle?.version}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="bg-gray-700 text-gray-300 font-mono text-xs font-normal px-2 py-0.5 rounded">{vehicle?.plate}</span>
              {vehicle?.color && <span className="text-gray-300 text-sm">{vehicle?.color}</span>}
              {vehicle?.category && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isSport ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'
                }`}>
                  {isSport ? 'Sportif' : isSmartFortwo ? 'Smart Fortwo' : 'Citadine'}
                </span>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Départ</p>
              <p className="font-semibold text-gray-900">{formatDateTime(reservation?.start_datetime)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-600 font-medium mb-1">Retour prévu</p>
              <p className="font-semibold text-gray-900">{formatDateTime(reservation?.end_datetime)}</p>
            </div>
          </div>

          {/* Tarification */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-xs text-gray-500">Prix / jour</p>
              <p className="font-bold text-gray-900">{formatPrice(reservation?.daily_price)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-xs text-gray-500">KM inclus</p>
              <p className="font-bold text-gray-900">{reservation?.km_included ?? '∞'}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-xs text-green-700">Total TTC</p>
              <p className="font-bold text-green-800">{formatPrice(reservation?.total_price)}</p>
            </div>
          </div>

          {reservation?.deposit_amount && (
            <div className="p-3 bg-amber-50 rounded-xl flex items-center justify-between">
              <span className="text-sm text-amber-800 font-medium">Dépôt de garantie</span>
              <span className="font-bold text-amber-900">{formatPrice(reservation.deposit_amount)}</span>
            </div>
          )}
        </div>

        {/* ── Tableau des frais ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">
            Tableau récapitulatif des frais
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Catégorie : {isSport ? 'Véhicule Sportif' : isSmartFortwo ? 'Smart Fortwo' : 'Citadine'}
          </p>
          <div className="divide-y divide-gray-100">
            {fees.rows.map((row, i) => (
              <div key={i} className={`flex items-center justify-between py-2.5 ${
                i < 2 ? (isSport ? 'bg-red-50 -mx-2 px-2 rounded-lg' : 'bg-blue-50 -mx-2 px-2 rounded-lg') : ''
              }`}>
                <span className="text-sm text-gray-700">{row.label}</span>
                <span className={`text-sm font-semibold ${
                  i < 2 ? (isSport ? 'text-red-700' : 'text-blue-700') : 'text-gray-900'
                }`}>{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            Montants TTC. La franchise est applicable par sinistre et par véhicule.
          </p>
        </div>

        {/* ── Conditions générales — 14 articles ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-5">
            Conditions générales de location
          </h2>
          <div className="space-y-5">
            {articles.map((art, i) => (
              <div key={i}>
                <h3 className="text-xs font-bold text-gray-800 mb-1.5">Art. {art.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{art.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Clause photo horodatée ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h2 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
            Clause photo horodatée — État des lieux
          </h2>
          <p className="text-xs text-blue-700 leading-relaxed">{VIDEO_CLAUSE}</p>
        </div>

        {/* ── État des lieux de départ (relu avant signature) ── */}
        {departInspection && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                État des lieux de départ
              </h2>
              {departInspection.signedAt && (
                <span className="text-xs text-gray-400">le {formatDateTime(departInspection.signedAt)}</span>
              )}
            </div>

            {/* Relevés */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-xs text-gray-500">Kilométrage</p>
                <p className="font-bold text-gray-900">{departInspection.kmReading.toLocaleString('fr-FR')} km</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-xs text-gray-500">Autonomie</p>
                <p className="font-bold text-gray-900">{departInspection.fuelRangeKm.toLocaleString('fr-FR')} km</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-xs text-gray-500">Propreté ext.</p>
                <p className="font-bold text-gray-900">{CLEANLINESS_LABELS[departInspection.exteriorCleanliness] ?? '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-xs text-gray-500">Propreté int.</p>
                <p className="font-bold text-gray-900">{CLEANLINESS_LABELS[departInspection.interiorCleanliness] ?? '—'}</p>
              </div>
            </div>

            {/* Schéma des dommages constatés au départ (lecture seule) */}
            {departDamageCount > 0 ? (
              <>
                <VehicleInspectionMap
                  damages={departDamages}
                  onDamageAdd={() => {}}
                  onDamageRemove={() => {}}
                  readonly
                  phase="departure"
                  previousZones={[]}
                />
                <div className="space-y-1.5">
                  {departInspection.damagedZones.map((z: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold flex-shrink-0">
                        {graviteLabel((z.severity ?? 'dommage') as DamageSeverity)}
                      </span>
                      <span className="text-gray-800 truncate">{z.label ?? z.id}</span>
                      {z.description && <span className="text-gray-400 text-xs truncate">— {z.description}</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                Aucun dommage constaté au départ.
              </div>
            )}

            {/* Photos de l'état des lieux */}
            {departInspection.photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {departInspection.photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={p.url}
                    alt={p.label}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                  />
                ))}
              </div>
            )}

            {/* Signature apposée à l'état des lieux */}
            {departInspection.clientSignature && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Signature à l&apos;état des lieux</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={departInspection.clientSignature}
                  alt="Signature EDL départ"
                  className="h-14 border border-gray-200 rounded-lg object-contain bg-white px-3"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Signature client ── */}
        {!isSigned ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Signature du locataire</h2>
            <p className="text-xs text-gray-500 mb-4">
              En signant, vous reconnaissez avoir lu et accepté l'intégralité des conditions générales ci-dessus.
            </p>

            <SignatureCanvas
              label="Votre signature *"
              onSign={setClientSig}
              onClear={() => setClientSig(null)}
              existingSig={clientSig}
              height={160}
            />

            {/* Cachet agence en regard */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Signature du locataire</p>
                  {clientSig ? (
                    <img src={clientSig} alt="Signature" className="h-16 w-full object-contain border border-gray-200 rounded-lg bg-white" />
                  ) : (
                    <div className="h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-300">En attente</span>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Cachet & Visa agence</p>
                  <div className="h-16 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
                    <Image src="/logo.png" alt="Cachet agence" width={120} height={48} className="object-contain max-h-full" />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={sign}
              disabled={signing || !clientSig}
              className="mt-5 w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signature en cours…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Signer et valider le contrat
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              La signature génère automatiquement le contrat PDF définitif.
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800">Contrat déjà signé</p>
            <p className="text-sm text-green-700 mt-1">
              Signé le {contract.signed_at ? new Date(contract.signed_at).toLocaleString('fr-FR') : '—'}
            </p>
            {contract.client_signature_svg && (
              <img src={contract.client_signature_svg} alt="Signature client" className="h-16 mx-auto mt-3 border border-green-200 rounded-lg object-contain bg-white px-4" />
            )}
            <Link href={`/contracts/${contract.id}`} className="mt-4 inline-flex items-center gap-2 text-sm text-green-700 font-medium hover:underline">
              <FileDown className="w-4 h-4" />
              Retour au contrat
            </Link>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
