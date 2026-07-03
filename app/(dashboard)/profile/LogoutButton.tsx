'use client'

import { useState } from 'react'
import { logout } from '@/lib/actions/auth'

export default function LogoutButton() {
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600">Confirmer la déconnexion ?</span>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors rounded-xl"
        >
          Annuler
        </button>
        <form action={logout}>
          <button
            type="submit"
            className="px-6 py-3 bg-red-600 text-white hover:bg-red-700 rounded-xl font-medium transition-colors text-sm"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="px-6 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-medium transition-colors text-sm"
    >
      Se déconnecter
    </button>
  )
}
