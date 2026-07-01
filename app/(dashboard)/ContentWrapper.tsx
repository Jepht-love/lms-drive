'use client'

import { usePathname } from 'next/navigation'

const NO_PADDING_ROUTES = ['/calendrier']

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const noPadding = NO_PADDING_ROUTES.some(r => path === r || path.startsWith(r + '/'))

  if (noPadding) {
    return (
      <div className="h-full overflow-hidden">
        {children}
      </div>
    )
  }

  return (
    <div
      className="px-4 py-5 pb-6"
      style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
