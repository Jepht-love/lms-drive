'use client'
import { useEffect } from 'react'

// Enregistre le token APNs injecté par le wrapper iOS natif.
// window.__apnsToken est positionné par ContentView.swift après chaque chargement de page.
export default function ApnsTokenRegistrar() {
  useEffect(() => {
    const register = async (token: string) => {
      try {
        await fetch('/api/push/apns/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      } catch {
        // non bloquant
      }
    }

    const existingToken = (window as any).__apnsToken as string | undefined
    if (existingToken) {
      register(existingToken)
      return
    }

    const handler = () => {
      const token = (window as any).__apnsToken as string | undefined
      if (token) register(token)
    }
    window.addEventListener('apnsTokenReady', handler)
    return () => window.removeEventListener('apnsTokenReady', handler)
  }, [])

  return null
}
