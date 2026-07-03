'use client'

import { useState } from 'react'
import { FileDown, Send, CheckCircle2, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Props {
  contract: any
  reservation: any
  vehicle: any
  client: any
}

export default function ContractSigningPanel({ contract, reservation, vehicle, client }: Props) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isSigned = contract.status === 'signe' || contract.status === 'cloture'

  async function generatePDF() {
    setGenerating(true)
    setError(null)

    const res = await fetch('/api/contracts/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: contract.id }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erreur génération PDF')
      setGenerating(false)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contract.contract_number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('PDF téléchargé !')
    setGenerating(false)
  }

  async function sendEmail() {
    if (!client?.email) { setError("Le client n'a pas d'adresse email"); return }
    setSending(true)
    setError(null)

    const res = await fetch('/api/contracts/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: contract.id }),
    })

    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setSending(false)
    } else {
      // Retour naturel à la liste des réservations. `replace` (et non `push`)
      // pour que le bouton « retour » ne rouvre pas le contrat qu'on vient d'envoyer.
      router.replace(reservation?.id ? `/reservations/${reservation.id}` : '/reservations')
    }
  }

  return (
    <div className="space-y-4">

      {/* Statut signature */}
      {!isSigned ? (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Signature du contrat</h3>
          <p className="text-sm text-gray-500 mb-4">
            Présentez la prévisualisation au client pour qu'il lise les conditions et signe en bas de page.
          </p>

          {/* Cachet agence */}
          <div className="mb-4 rounded-xl border border-gray-200 p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cachet agence</p>
            <div className="flex items-center justify-center h-16">
              <Image
                src="/logo.png"
                alt="Cachet agence"
                width={160}
                height={60}
                className="object-contain max-h-full"
              />
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">Apposé automatiquement sur le contrat PDF</p>
          </div>

          <Link
            href={`/contracts/${contract.id}/preview`}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#111111] hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Eye className="w-4 h-4" />
            Prévisualiser & Faire signer
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Contrat signé</p>
              <p className="text-sm text-green-700 mt-0.5">
                Signé le {contract.signed_at ? new Date(contract.signed_at).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
          </div>
          {/* Affichage signature client */}
          {contract.client_signature_svg && (
            <div className="bg-white rounded-xl p-3 border border-green-200">
              <p className="text-xs text-gray-500 mb-1">Signature du client</p>
              <img
                src={contract.client_signature_svg}
                alt="Signature client"
                className="h-16 w-full object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Actions PDF */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Actions</h3>
        <div className="space-y-3">
          <button
            onClick={generatePDF}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {generating ? 'Génération...' : 'Télécharger le PDF'}
          </button>

          <button
            onClick={sendEmail}
            disabled={sending || !client?.email}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#111111] hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Envoi...' : `Envoyer par email${client?.email ? '' : " (pas d'email)"}`}
          </button>

          {contract.email_sent_at && (
            <p className="text-xs text-center text-green-600">
              ✓ Email envoyé le {new Date(contract.email_sent_at).toLocaleString('fr-FR')}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>
        )}
        {message && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {message}
          </div>
        )}
      </div>
    </div>
  )
}
