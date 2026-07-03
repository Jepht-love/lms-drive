import Image from 'next/image'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PageHeaderProps {
  title?: string
}

export default function PageHeader({ title }: PageHeaderProps) {
  const today = new Date()
  const date  = title ?? format(today, 'EEE d', { locale: fr })

  return (
    // Header noir (encoche/safe-area incluse). Logo BLANC à fond transparent
    // (public/logo-white.png, généré depuis logo.png) → s'affiche net sur le noir,
    // sans filtre ni rectangle blanc.
    <header
      className="shrink-0 bg-[#111111]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', position: 'relative', zIndex: 10 }}
    >
      <div className="flex items-center justify-between px-4 h-[60px]">
        {/* Gauche : date */}
        <p className="text-sm text-white/60 font-semibold w-20 capitalize">{date}</p>

        {/* Centre : logo blanc */}
        <Image
          src="/logo-white.webp"
          alt="LMS Drive"
          width={200}
          height={110}
          className="object-contain"
          style={{ height: 48, width: 'auto', maxWidth: 200 }}
          priority
        />

        {/* Droite : espace symétrique pour centrer le logo (cloche retirée —
            l'onglet Alertes de la barre du bas est l'unique point d'entrée). */}
        <div className="w-20" />
      </div>
    </header>
  )
}
