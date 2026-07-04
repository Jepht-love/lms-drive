'use client'

import { useEffect, useState } from 'react'
import { getTranslation, type Lang } from '@/lib/fleetaxis-i18n'
import Navbar from '@/components/fleetaxis/Navbar'
import HeroSection from '@/components/fleetaxis/HeroSection'
import StatsSection from '@/components/fleetaxis/StatsSection'
import FeaturesSection from '@/components/fleetaxis/FeaturesSection'
import TargetSection from '@/components/fleetaxis/TargetSection'
import PricingSection from '@/components/fleetaxis/PricingSection'
import ComplianceSection from '@/components/fleetaxis/ComplianceSection'
import ContactSection from '@/components/fleetaxis/ContactSection'
import Footer from '@/components/fleetaxis/Footer'

export default function FleetAxisLanding() {
  // Rendu initial FIXE en 'fr' (identique SSR/CSR pour éviter le mismatch),
  // puis on relit la préférence stockée après montage.
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    const stored = localStorage.getItem('fleetaxis_lang')
    if (stored === 'fr' || stored === 'en') setLang(stored)
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    try { localStorage.setItem('fleetaxis_lang', l) } catch { /* stockage indisponible */ }
  }

  const t = getTranslation(lang)

  return (
    <>
      <Navbar t={t} lang={lang} setLang={changeLang} />
      <main>
        <HeroSection t={t} />
        <StatsSection t={t} />
        <FeaturesSection t={t} />
        <TargetSection t={t} />
        <PricingSection t={t} />
        <ComplianceSection t={t} />
        <ContactSection t={t} />
      </main>
      <Footer t={t} />
    </>
  )
}
