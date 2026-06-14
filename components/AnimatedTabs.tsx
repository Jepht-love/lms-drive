'use client'

import { motion } from 'framer-motion'

interface Tab { id: string; label: string; count?: number }
interface AnimatedTabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  layoutId?: string
}

export default function AnimatedTabs({ tabs, active, onChange, layoutId }: AnimatedTabsProps) {
  const id = layoutId ?? tabs.map(t => t.id).join('-')
  return (
    <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="relative flex-1 text-[12px] font-medium py-2 rounded-xl"
        >
          {active === tab.id && (
            <motion.div
              layoutId={`tab-pill-${id}`}
              className="absolute inset-0 bg-white rounded-xl shadow-sm"
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            />
          )}
          <span className={`relative z-10 flex items-center justify-center gap-1 ${active === tab.id ? 'text-[#111111]' : 'text-gray-400'}`}>
            {tab.label}
            {tab.count != null && (
              <span className={`text-[10px] px-1 py-0.5 rounded-full ${active === tab.id ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-400'}`}>
                {tab.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
