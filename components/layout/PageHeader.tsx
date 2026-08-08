import Image from 'next/image'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import MenuButton from './MenuButton'

interface PageHeaderProps {
  title?: string
  allowedTabs?: string[] | null
}

export default function PageHeader({ title, allowedTabs }: PageHeaderProps) {
  const today = new Date()
  const date  = title ?? format(today, 'EEE d', { locale: fr })

  return (
    // Header noir (encoche/safe-area incluse). Logo BLANC à fond transparent
    // (public/logo-white.webp) → net sur le noir, sans filtre ni rectangle blanc.
    // Depuis le 08/08/2026 : hamburger à gauche (ouvre le volet de navigation),
    // logo centré, date à droite. La barre d'onglets du bas a été retirée, toute
    // la navigation passe par le hamburger.
    <header
      className="shrink-0 bg-[#111111]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', position: 'relative', zIndex: 10 }}
    >
      <div className="flex items-center justify-between px-4 h-[60px]">
        {/* Gauche : le hamburger (largeur 80px, symétrique de la date à droite
            pour garder le logo centré au pixel). */}
        <MenuButton allowedTabs={allowedTabs} />

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

        {/* Droite : la date (déplacée de la gauche) */}
        <p className="text-sm text-white/60 font-semibold w-20 text-right capitalize">{date}</p>
      </div>
    </header>
  )
}
