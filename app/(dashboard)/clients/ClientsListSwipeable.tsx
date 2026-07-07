'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, Mail, Star } from 'lucide-react'
import SwipeableRow from '@/components/SwipeableRow'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'
import type { Client } from '@/types/database'

function StatusBadge({ status }: { status: string }) {
  if (status === 'vip')
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-black text-white">★ VIP</span>
  if (status === 'blackliste')
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">⚠ Blacklisté</span>
  return null
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  )
}

export default function ClientsListSwipeable({ clients }: { clients: Client[] }) {
  const router = useRouter()

  return (
    <AnimatedList className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
      {clients.map(c => {
        const initials = `${c.first_name?.charAt(0) ?? ''}${c.last_name?.charAt(0) ?? ''}`.toUpperCase() || '?'
        return (
          <AnimatedListItem key={c.id}>
            <SwipeableRow
              actions={[
                {
                  label: 'Appeler',
                  color: '#2563EB',
                  onClick: () => { if (c.phone) window.open(`tel:${c.phone}`) },
                },
                {
                  label: 'Détail',
                  color: '#374151',
                  onClick: () => router.push(`/clients/${c.id}`),
                },
              ]}
            >
              <Link
                href={`/clients/${c.id}`}
                className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                  c.status === 'blackliste' ? 'bg-red-100 text-red-700'
                  : c.status === 'vip' ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700'
                }`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{c.first_name} {c.last_name}</span>
                    <StatusBadge status={c.status} />
                    <StarRating rating={c.rating} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </span>
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-[140px]">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {c.city && <p className="text-xs font-medium text-gray-600">{c.city}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </Link>
            </SwipeableRow>
          </AnimatedListItem>
        )
      })}
    </AnimatedList>
  )
}
