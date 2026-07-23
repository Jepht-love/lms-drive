'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Message d'erreur des liens email (ex. invitation expirée) — lu depuis
  // l'URL en effet pour éviter le <Suspense> qu'exige useSearchParams.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'lien_invalide') {
      setError("Lien d'invitation invalide ou expiré. Demandez à votre gérant de renvoyer l'invitation.")
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0A0A0A' }}>
      {/* Panneau gauche — logo seul */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-14" style={{ background: '#0A0A0A', borderRight: '1px solid #1E1E1E' }}>
        <div>
          <Image
            src="/logo.webp"
            alt="LMS Drive"
            width={180}
            height={66}
            className="object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
            priority
          />
        </div>

        {/* Séparateur doré */}
        <div className="flex flex-col items-start gap-3">
          <div className="w-8 h-0.5" style={{ background: '#C4A35A' }} />
          <p className="text-xs uppercase tracking-[0.25em]" style={{ color: '#C4A35A', opacity: 0.6 }}>
            Outil de gestion interne
          </p>
        </div>

        <p className="text-xs" style={{ color: '#6A6A6A' }}>
          LMS Drive © {new Date().getFullYear()}
        </p>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-16" style={{ background: '#0F0F0F' }}>
        {/* Logo mobile uniquement */}
        <div className="lg:hidden mb-12">
          <Image
            src="/logo.webp"
            alt="LMS Drive"
            width={130}
            height={50}
            className="object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
            priority
          />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-1">Connexion</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: '#9A9A98' }}>
                Adresse email
              </label>
              <input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required
                placeholder="votre@email.com"
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
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
