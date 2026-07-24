'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { completeOnboarding } from '@/lib/actions/auth'

/**
 * Formulaire d'onboarding : le membre choisit le **nom affiché** dans
 * l'application et son **mot de passe**. Le nom et le prénom arrivent du
 * serveur (pas de flash). Après l'enregistrement du mot de passe, on finalise
 * le profil côté serveur (completeOnboarding) AVANT d'entrer dans l'app : cela
 * garantit qu'une ligne `profiles` existe et évite la boucle « Chargement… ».
 */
export default function BienvenueForm({ prenom, fullName }: { prenom: string | null; fullName: string | null }) {
  const [nom, setNom] = useState(fullName ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (nom.trim().length < 2) {
      setError('Indiquez le nom qui sera affiché dans l’application.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError("Impossible d'enregistrer le mot de passe. Réessayez ou demandez une nouvelle invitation.")
      setLoading(false)
      return
    }
    // Enregistre le nom visible et garantit le profil (sinon l'app boucle sur « Chargement… »).
    const res = await completeOnboarding(nom)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0A0A0A' }}>
      <div className="mb-12">
        <Image
          src="/logo.webp"
          alt="LMS Drive"
          width={150}
          height={55}
          className="object-contain"
          style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
          priority
        />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-white mb-2">
            {prenom ? `Bienvenue, ${prenom}` : 'Bienvenue'}
          </h1>
          <p className="text-sm" style={{ color: '#9A9A98' }}>
            Votre espace est prêt. Vérifiez le nom qui vous représentera et choisissez votre mot de passe.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="nom" className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: '#9A9A98' }}>
              Nom affiché
            </label>
            <input
              id="nom" type="text" value={nom}
              onChange={e => setNom(e.target.value)} required
              autoComplete="name"
              placeholder="Prénom Nom"
              className="w-full px-4 py-3.5 rounded-xl text-white placeholder-white/20 text-sm transition-all outline-none"
              style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#fff' }}
              onFocus={e => e.target.style.borderColor = '#C4A35A'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: '#9A9A98' }}>
              Mot de passe
            </label>
            <input
              id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required
              minLength={8} autoComplete="new-password"
              placeholder="8 caractères minimum"
              className="w-full px-4 py-3.5 rounded-xl text-white placeholder-white/20 text-sm transition-all outline-none"
              style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#fff' }}
              onFocus={e => e.target.style.borderColor = '#C4A35A'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: '#9A9A98' }}>
              Confirmez le mot de passe
            </label>
            <input
              id="confirm" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} required
              minLength={8} autoComplete="new-password"
              placeholder="••••••••"
              className="w-full px-4 py-3.5 rounded-xl text-white placeholder-white/20 text-sm transition-all outline-none"
              style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#fff' }}
              onFocus={e => e.target.style.borderColor = '#C4A35A'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#2A1010', border: '1px solid #4A1A1A', color: '#FF6B6B' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-50 mt-2"
            style={{ background: 'linear-gradient(135deg, #C4A35A, #D4B870)', color: '#0A0A0A' }}
          >
            {loading ? 'Enregistrement…' : 'Accéder à mon espace'}
          </button>
        </form>
      </div>
    </div>
  )
}
