'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

interface SwipeAction {
  label: string
  color: string
  onClick: () => void
}

interface SwipeableRowProps {
  children: React.ReactNode
  actions: SwipeAction[]
}

export default function SwipeableRow({ children, actions }: SwipeableRowProps) {
  const [open, setOpen] = useState(false)
  const actionWidth = 72 * actions.length

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute right-0 top-0 h-full flex">
        {actions.map(action => (
          <button
            key={action.label}
            onClick={() => { action.onClick(); setOpen(false) }}
            style={{ width: 72, backgroundColor: action.color }}
            className="flex items-center justify-center text-white text-[11px] font-medium"
          >
            {action.label}
          </button>
        ))}
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={0.05}
        onDragEnd={(_e, info) => setOpen(info.offset.x < -actionWidth / 2)}
        animate={{ x: open ? -actionWidth : 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white relative z-10"
      >
        {children}
      </motion.div>
    </div>
  )
}
