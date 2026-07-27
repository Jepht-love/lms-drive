'use client'

import { usePathname } from 'next/navigation'

const NO_PADDING_ROUTES = ['/calendrier']

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const noPadding = NO_PADDING_ROUTES.some(r => path === r || path.startsWith(r + '/'))

  if (noPadding) return <>{children}</>

  // Marge basse : le bouton d'aide flotte à 84 px du bas de la fenêtre et mesure
  // 36 px de haut, donc il recouvre les ~60 derniers pixels de la zone qui défile.
  // Les 24 px d'avant ne suffisaient pas : arrivé en bas d'une liste, la dernière
  // ligne restait coincée SOUS le bouton et devenait illisible sans pouvoir défiler
  // plus (mesuré le 27/07 sur le tableau de bord : « Retour : 27 juil. à 15:08 »
  // amputé de son heure). Toucher à la taille ou à la position du bouton d'aide
  // (components/sav/SavButton.tsx) demande de revoir cette valeur.
  return (
    <div className="px-4 py-5 pb-[68px]">
      {children}
    </div>
  )
}
