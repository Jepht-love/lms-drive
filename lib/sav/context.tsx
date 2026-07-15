'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Contexte partagé : la sous-vue courante (ex. « État des lieux départ »,
// « Comptabilité › Échéances »). N'importe quelle vue peut la déclarer via le
// hook useSavSection ; le bouton SAV la lit pour pré-remplir le formulaire.

interface SavContextValue {
  section: string | null
  setSection: (value: string | null) => void
}

const SavContext = createContext<SavContextValue>({
  section: null,
  setSection: () => {},
})

export function SavProvider({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<string | null>(null)
  return (
    <SavContext.Provider value={{ section, setSection }}>
      {children}
    </SavContext.Provider>
  )
}

export function useSavContext() {
  return useContext(SavContext)
}

/**
 * Déclare la sous-vue courante pour le SAV. À appeler dans une vue/onglet :
 *   useSavSection(edlMode === 'depart' ? 'État des lieux départ' : 'État des lieux retour')
 * La valeur est automatiquement effacée au démontage du composant.
 */
export function useSavSection(label: string | null) {
  const { setSection } = useContext(SavContext)
  const stable = useCallback(setSection, [setSection])
  useEffect(() => {
    stable(label)
    return () => stable(null)
  }, [label, stable])
}
