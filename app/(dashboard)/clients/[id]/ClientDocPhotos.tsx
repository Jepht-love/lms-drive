'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ZoomIn, FileX } from 'lucide-react'

interface Props {
  idFrontUrl: string | null
  idBackUrl: string | null
  licFrontUrl: string | null
  licBackUrl: string | null
  addressUrl?: string | null
}

const DOCS = [
  { key: 'idFront',  label: "CNI / Passeport — Recto" },
  { key: 'idBack',   label: "CNI / Passeport — Verso" },
  { key: 'licFront', label: "Permis de conduire — Recto" },
  { key: 'licBack',  label: "Permis de conduire — Verso" },
  { key: 'address',  label: "Justificatif de domicile" },
] as const

export default function ClientDocPhotos({ idFrontUrl, idBackUrl, licFrontUrl, licBackUrl, addressUrl }: Props) {
  const urls: Record<string, string | null> = {
    idFront: idFrontUrl,
    idBack: idBackUrl,
    licFront: licFrontUrl,
    licBack: licBackUrl,
    address: addressUrl ?? null,
  }

  const available = DOCS.filter(d => urls[d.key])
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)

  if (available.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-gray-400">
        <FileX className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">Aucune photo de document enregistrée</span>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {DOCS.map(doc => {
          const url = urls[doc.key]
          if (!url) return (
            <div key={doc.key} className="rounded-xl border-2 border-dashed border-gray-200 aspect-[3/2] flex flex-col items-center justify-center gap-1">
              <FileX className="w-5 h-5 text-gray-300" />
              <span className="text-xs text-gray-300 text-center px-2">{doc.label}</span>
            </div>
          )
          return (
            <button
              key={doc.key}
              onClick={() => setLightbox({ url, label: doc.label })}
              className="group relative rounded-xl overflow-hidden border border-gray-200 aspect-[3/2] bg-gray-50 hover:border-blue-400 transition-colors"
            >
              <Image
                src={url}
                alt={doc.label}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <span className="text-xs text-white font-medium">{doc.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{lightbox.label}</span>
              <button
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="relative w-full" style={{ maxHeight: '75vh' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.url}
                alt={lightbox.label}
                className="w-full h-auto object-contain"
                style={{ maxHeight: '75vh' }}
              />
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 flex justify-end">
              <a
                href={lightbox.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
                onClick={e => e.stopPropagation()}
              >
                Télécharger →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
