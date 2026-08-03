'use client'

import Image from 'next/image'
import { ArrowLeft, FileDown, Ban, Check } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { fmtNombre } from '@/lib/pdf/nombres'
import type { InvoiceLineItem } from '@/lib/pdf/invoice-template'

/**
 * Le document lui-même. Toutes les dates arrivent déjà mises en forme par
 * `page.tsx` (heure de l'agence) : ce composant ne calcule aucune date.
 *
 * Il reproduit la mise en page du PDF `lib/pdf/invoice-template.tsx` — même
 * ordre de blocs, mêmes libellés, mêmes montants. Le tableau des lignes se
 * replie en liste sur téléphone : à quatre colonnes il déborderait, et un
 * document qu'on lit de travers ne se relit pas avant envoi.
 */
interface Props {
  retourHref: string
  pdfHref: string
  invoiceId: string
  numero: string
  envoyeeLe: string | null
  annulee: boolean
  dateEmission: string
  client: { nom: string; adresse: string }
  vehicule: { libelle: string; plaque: string }
  retourLe: string
  lignes: InvoiceLineItem[]
  total: number
  mentions: string[]
  agence: { nom: string; siret: string | null; adresse: string | null }
}

export default function InvoicePreviewClient({
  retourHref, pdfHref, numero, envoyeeLe, annulee, dateEmission,
  client, vehicule, retourLe, lignes, total, mentions, agence,
}: Props) {
  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <BackButton fallbackHref={retourHref} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{numero}</h1>
          <p className="text-xs text-gray-500">Aperçu de la facture</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${
          annulee ? 'bg-gray-100 text-gray-600'
            : envoyeeLe ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
        }`}>
          {annulee ? 'Annulée' : envoyeeLe ? 'Envoyée' : 'À envoyer'}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {annulee && (
          <div className="flex items-center gap-2 text-gray-600 bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <Ban className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">Facture annulée, son impact comptable a été retiré.</p>
          </div>
        )}
        {envoyeeLe && !annulee && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
            <Check className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">Envoyée au client le {envoyeeLe}.</p>
          </div>
        )}

        {/* Le document, tel qu'il sera imprimé */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-8">
          <Image src="/logo.png" alt={agence.nom} width={70} height={40} className="object-contain mb-4" />

          <h2 className="text-base sm:text-lg font-bold text-center text-gray-900 mb-6 uppercase">
            Facture – restitution de véhicule
          </h2>

          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-5">
            <div className="text-xs text-gray-700 space-y-0.5">
              <p>Facture N° {numero}</p>
              <p>Date : {dateEmission}</p>
            </div>
            <div className="border border-gray-800 rounded-none px-3 py-2 text-xs text-gray-800 sm:w-[220px]">
              <p>Client : {client.nom}</p>
              <p>Adresse : {client.adresse}</p>
            </div>
          </div>

          <div className="text-xs text-gray-700 space-y-1 mb-3">
            <p>Véhicule : {vehicule.libelle}</p>
            <p className="text-[11px] text-gray-400">Plaque : {vehicule.plaque}</p>
            <p>Retour : {retourLe}</p>
          </div>

          {/* Tableau, à partir de la tablette */}
          <div className="hidden sm:block border border-gray-800">
            <div className="flex bg-gray-100 border-b border-gray-800 text-xs font-bold text-gray-900">
              <span className="flex-[3] px-2 py-1.5">Description</span>
              <span className="w-[76px] flex-shrink-0 px-2 py-1.5 text-center">Quantité</span>
              <span className="w-[110px] flex-shrink-0 px-2 py-1.5 text-center">Prix unitaire (€)</span>
              <span className="w-[92px] flex-shrink-0 px-2 py-1.5 text-center">Total (€)</span>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="flex border-b border-gray-200 text-xs text-gray-800">
                <span className="flex-[3] px-2 py-1.5">{l.description}</span>
                <span className="w-[76px] flex-shrink-0 px-2 py-1.5 text-center">{l.quantity}</span>
                <span className="w-[110px] flex-shrink-0 px-2 py-1.5 text-center">{fmtNombre(l.unit_price)}</span>
                <span className="w-[92px] flex-shrink-0 px-2 py-1.5 text-center">{fmtNombre(l.total)}</span>
              </div>
            ))}
            <div className="flex bg-gray-100 border-t border-gray-800 text-sm font-bold text-gray-900">
              <span className="flex-1 px-2 py-1.5 text-right">Total (€)</span>
              <span className="w-[92px] flex-shrink-0 px-2 py-1.5 text-center">{fmtNombre(total)} €</span>
            </div>
          </div>

          {/* Liste, sur téléphone */}
          <div className="sm:hidden border border-gray-800">
            {lignes.map((l, i) => (
              <div key={i} className="border-b border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-800">{l.description}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {l.quantity} × {fmtNombre(l.unit_price)} € ={' '}
                  <span className="font-bold text-gray-900">{fmtNombre(l.total)} €</span>
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between bg-gray-100 border-t border-gray-800 px-3 py-2">
              <span className="text-sm font-bold text-gray-900">Total (€)</span>
              <span className="text-sm font-bold text-gray-900">{fmtNombre(total)} €</span>
            </div>
          </div>

          <div className="mt-6 space-y-1.5">
            {mentions.map((m, i) => (
              <p key={i} className="text-[10px] leading-snug text-gray-500 text-center">{m}</p>
            ))}
          </div>

          <p className="mt-6 text-[11px] font-bold text-gray-800 whitespace-pre-line">
            {agence.nom}{agence.siret ? ` - N° de SIRET : ${agence.siret}` : ''}
            {agence.adresse ? `\n${agence.adresse}` : ''}
          </p>
        </div>

        {/* Le PDF reste accessible, mais en téléchargement : il ne remplace plus
            l'écran, donc il n'y a plus de visionneuse sans retour possible. */}
        <a
          href={`${pdfHref}?download=1`}
          download
          className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium rounded-xl transition-colors text-sm"
        >
          <FileDown className="w-4 h-4" />
          Télécharger le PDF
        </a>

        <div className="h-6" />
      </div>
    </div>
  )
}
