'use client'

import { useState, useEffect } from 'react'
import { getTranslation, type Lang } from '@/lib/i18n'
import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import StatsSection from '@/components/StatsSection'
import FeaturesSection from '@/components/FeaturesSection'
import TargetSection from '@/components/TargetSection'
import PricingSection from '@/components/PricingSection'
import ComplianceSection from '@/components/ComplianceSection'
import ContactSection from '@/components/ContactSection'
import Footer from '@/components/Footer'

export default function FleetAxisPage() {
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    const stored = localStorage.getItem('fleetaxis_lang')
    if (stored === 'fr' || stored === 'en') setLang(stored)
  }, [])

  const handleLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem('fleetaxis_lang', l)
  }

  const t = getTranslation(lang)

  return (
    <main>
      <Navbar t={t} lang={lang} setLang={handleLang} />
      <HeroSection t={t} />
      <StatsSection t={t} />
      <FeaturesSection t={t} />
      <TargetSection t={t} />
      <PricingSection t={t} />
      <ComplianceSection t={t} />
      <ContactSection t={t} />
      <Footer t={t} />
    </main>
  )
}
