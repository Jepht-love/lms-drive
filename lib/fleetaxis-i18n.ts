// ═══════════════════════════════════════════════════════════════════════════
// FleetAxis — contenu bilingue FR / EN
// Fichier isolé (préfixe fleetaxis-) pour ne pas interférer avec LMS Drive.
// ═══════════════════════════════════════════════════════════════════════════

export type Lang = 'fr' | 'en'

export const translations = {
  fr: {
    nav: { features: 'Fonctionnalités', pricing: 'Tarifs', contact: 'Contact', demo: 'Demander une démo' },

    hero: {
      eyebrow: 'GESTION DE FLOTTE INSTITUTIONNELLE',
      h1: ['Pilotez votre flotte,', 'où que vous soyez.'],
      sub: 'Suivi des véhicules, traçabilité des déplacements, états des lieux numérisés — en temps réel, depuis n’importe où dans le monde.',
      cta1: 'Demander une démonstration',
      cta2: 'Voir les tarifs',
      trust: ['Déploiement international', 'Compatible standards ONU', 'Support multilingue'],
    },

    stats: {
      items: [
        { label: 'Véhicules suivis', value: '2 400+' },
        { label: 'Déploiements actifs', value: '12' },
        { label: 'Déplacements tracés/mois', value: '18 000+' },
        { label: 'Disponibilité', value: '99.9%' },
      ],
    },

    features: {
      title: 'Tout ce dont votre flotte a besoin, dans un seul outil.',
      items: [
        { title: 'Historique complet des véhicules', desc: 'Consultez l’historique complet de chaque véhicule : kilométrage, incidents, entretiens, affectations.' },
        { title: 'Suivi des déplacements', desc: 'Tracez chaque déplacement — départ, arrivée, chauffeur, motif. Rapport instantané disponible.' },
        { title: 'États des lieux numérisés', desc: 'États des lieux de départ et de retour numérisés, avec photos et signatures électroniques.' },
        { title: 'Alertes et maintenance', desc: 'Alertes automatiques pour les entretiens, contrôles techniques et retours de véhicules.' },
        { title: 'Rapports et exports', desc: 'Générez des rapports d’utilisation, d’incidents et de coûts. Export PDF et Excel.' },
        { title: 'Accès multi-rôles', desc: 'Attribuez des rôles distincts : administrateur, responsable logistique, chauffeur.' },
      ],
    },

    targets: {
      title: 'Conçu pour les organisations qui opèrent à grande échelle.',
      items: [
        { title: 'Agences internationales & ONU', desc: 'Suivez des flottes de plusieurs centaines de véhicules déployés sur le terrain, avec traçabilité complète et rapports conformes aux standards internationaux.' },
        { title: 'ONG et opérateurs humanitaires', desc: 'Gérez les véhicules de mission, les déplacements de terrain et la maintenance, même en zone à connectivité limitée.' },
        { title: 'Ministères et administrations', desc: 'Numérisez la gestion de votre parc public : affectations, déplacements officiels, entretiens, états des lieux.' },
      ],
    },

    pricing: {
      title: 'Des tarifs adaptés à la taille de votre flotte.',
      sub: 'Deux modes d’accès : licence perpétuelle ou abonnement mensuel. Frais de déploiement facturés séparément.',
      tabMonthly: 'Abonnement mensuel',
      tabOnetime: 'Licence perpétuelle',
      popular: 'Le plus populaire',
      customQuote: 'Sur devis',
      perMonth: '/mois',
      ctaStart: 'Démarrer',
      ctaContact: 'Nous contacter',
      monthly: [
        { name: 'Starter', cap: 'Jusqu’à 10 véhicules', price: '500 €', per: '(50 €/véh.)', unit: '/mois',
          features: ['Tableau de bord', 'Suivi déplacements', 'États des lieux', 'Alertes', 'Support email'], cta: 'start' },
        { name: 'Business', cap: 'Jusqu’à 20 véhicules', price: '900 €', per: '(45 €/véh.)', unit: '/mois',
          features: ['Tout Starter', 'Rapports avancés', 'Export PDF/Excel', '3 rôles utilisateurs'], cta: 'start', featured: true },
        { name: 'Enterprise', cap: '21 à 50 véhicules', price: 'Sur devis', per: '(~40 €/véh.)', unit: '',
          features: ['Tout Business', 'Multi-sites', 'API disponible', 'Support prioritaire'], cta: 'contact' },
        { name: 'Institutional', cap: '50+ véhicules', price: 'Sur devis', per: '', unit: '',
          features: ['Tout Enterprise', 'Déploiement international', 'Formation équipe', 'SLA garanti'], cta: 'contact' },
      ],
      oneTimeHead: ['Formule', 'Flotte', 'Prix HT', 'Inclus'],
      oneTime: [
        { name: 'Starter', fleet: '≤ 10 véhicules', price: '3 000 €', incl: 'Accès à vie · Mises à jour 1 an · Support email' },
        { name: 'Business', fleet: '≤ 20 véhicules', price: '5 000 €', incl: 'Accès à vie · Mises à jour 2 ans · Support prioritaire' },
        { name: 'Enterprise', fleet: '21–50 véhicules', price: 'Sur devis', incl: 'Accès à vie · Mises à jour 3 ans · Formation incluse' },
        { name: 'Institutional', fleet: '50+ véhicules', price: 'Sur devis', incl: 'Contrat cadre · SLA · Déploiement international' },
      ],
      oneTimeNote: 'La licence perpétuelle donne accès au logiciel sans limitation de durée. Les mises à jour majeures au-delà de la période incluse sont disponibles sur contrat de maintenance annuel.',
      deployTitle: 'Frais de déploiement (one-time)',
      deploy: [
        { scope: 'Local ≤ 20 véh.', desc: 'Installation locale', price: '1 500 €' },
        { scope: 'Local 21–50 véh.', desc: 'Installation locale étendue', price: '3 500 €' },
        { scope: 'Local 51–100 véh.', desc: 'Grande flotte', price: '7 500 €' },
        { scope: 'International (50+ véh.)', desc: 'Déploiement sur site', price: 'Sur devis' },
      ],
      deployNote: 'Le déploiement international inclut : déplacement du consultant, formation des équipes, saisie des données véhicules, paramétrage complet et suivi à distance pendant 30 jours.',
    },

    compliance: {
      title: 'Un logiciel conforme aux standards institutionnels.',
      badges: [
        { fr: 'Données hébergées en Europe', en: 'Data hosted in Europe' },
        { fr: 'Compatible procédures ONU/ONG', en: 'UN/NGO procurement compatible' },
        { fr: 'Interface bilingue FR/EN', en: 'Bilingual interface FR/EN' },
        { fr: 'Exports conformes aux audits', en: 'Audit-ready data exports' },
      ],
    },

    contact: {
      title: 'Prêt à numériser votre flotte ?',
      sub: 'Envoyez-nous vos besoins. Nous vous répondons sous 48 heures avec une proposition adaptée.',
      firstName: 'Prénom',
      email: 'Email professionnel',
      fleetSize: 'Taille de flotte',
      fleetOptions: ['< 10', '10–20', '21–50', '50–100', '100+'],
      org: 'Organisation',
      message: 'Message (optionnel)',
      submit: 'Envoyer',
      rgpd: 'Les informations transmises sont utilisées uniquement pour traiter votre demande. Conformément au RGPD, vous disposez d’un droit d’accès, de rectification et de suppression de vos données.',
    },

    footer: {
      brand: 'FleetAxis',
      mail: 'projobs01@gmail.com',
      links: ['Mentions légales', 'Politique de confidentialité', 'CGU'],
      legal: '© 2026 FleetAxis',
    },
  },

  en: {
    nav: { features: 'Features', pricing: 'Pricing', contact: 'Contact', demo: 'Request a demo' },

    hero: {
      eyebrow: 'INSTITUTIONAL FLEET MANAGEMENT',
      h1: ['Command your fleet,', 'wherever you are.'],
      sub: 'Vehicle tracking, trip traceability, digitized inspection reports — in real time, from anywhere in the world.',
      cta1: 'Request a demonstration',
      cta2: 'View pricing',
      trust: ['International deployment', 'UN-compatible standards', 'Multilingual support'],
    },

    stats: {
      items: [
        { label: 'Vehicles tracked', value: '2,400+' },
        { label: 'Active deployments', value: '12' },
        { label: 'Trips tracked/month', value: '18,000+' },
        { label: 'Uptime', value: '99.9%' },
      ],
    },

    features: {
      title: 'Everything your fleet needs, in one platform.',
      items: [
        { title: 'Complete vehicle history', desc: 'Access the complete history of each vehicle: mileage, incidents, maintenance, assignments.' },
        { title: 'Trip tracking', desc: 'Track every trip — departure, arrival, driver, purpose. Instant report available.' },
        { title: 'Digital inspection reports', desc: 'Digital departure and return inspections, with photos and electronic signatures.' },
        { title: 'Alerts & maintenance', desc: 'Automatic alerts for scheduled maintenance, technical checks, and vehicle returns.' },
        { title: 'Reports & exports', desc: 'Generate usage, incident, and cost reports. PDF and Excel export.' },
        { title: 'Multi-role access', desc: 'Assign distinct roles: administrator, logistics manager, driver.' },
      ],
    },

    targets: {
      title: 'Built for organizations that operate at scale.',
      items: [
        { title: 'International agencies & UN bodies', desc: 'Track fleets of hundreds of field vehicles with full traceability and reports compliant with international standards.' },
        { title: 'NGOs & humanitarian operators', desc: 'Manage mission vehicles, field trips, and maintenance — even in low-connectivity environments.' },
        { title: 'Ministries & public administrations', desc: 'Digitize your public fleet management: assignments, official trips, maintenance, inspections.' },
      ],
    },

    pricing: {
      title: 'Pricing that scales with your fleet.',
      sub: 'Two access modes: perpetual license or monthly subscription. Deployment fees billed separately.',
      tabMonthly: 'Monthly',
      tabOnetime: 'One-time',
      popular: 'Most popular',
      customQuote: 'Custom quote',
      perMonth: '/month',
      ctaStart: 'Get started',
      ctaContact: 'Contact us',
      monthly: [
        { name: 'Starter', cap: 'Up to 10 vehicles', price: '€500', per: '(€50/veh.)', unit: '/month',
          features: ['Dashboard', 'Trip tracking', 'Inspection reports', 'Alerts', 'Email support'], cta: 'start' },
        { name: 'Business', cap: 'Up to 20 vehicles', price: '€900', per: '(€45/veh.)', unit: '/month',
          features: ['Everything in Starter', 'Advanced reports', 'PDF/Excel export', '3 user roles'], cta: 'start', featured: true },
        { name: 'Enterprise', cap: '21 to 50 vehicles', price: 'Custom quote', per: '(~€40/veh.)', unit: '',
          features: ['Everything in Business', 'Multi-site', 'API available', 'Priority support'], cta: 'contact' },
        { name: 'Institutional', cap: '50+ vehicles', price: 'Custom quote', per: '', unit: '',
          features: ['Everything in Enterprise', 'International deployment', 'Team training', 'Guaranteed SLA'], cta: 'contact' },
      ],
      oneTimeHead: ['Plan', 'Fleet', 'Price excl. VAT', 'Included'],
      oneTime: [
        { name: 'Starter', fleet: '≤ 10 vehicles', price: '€3,000', incl: 'Lifetime access · 1 year of updates · Email support' },
        { name: 'Business', fleet: '≤ 20 vehicles', price: '€5,000', incl: 'Lifetime access · 2 years of updates · Priority support' },
        { name: 'Enterprise', fleet: '21–50 vehicles', price: 'Custom quote', incl: 'Lifetime access · 3 years of updates · Training included' },
        { name: 'Institutional', fleet: '50+ vehicles', price: 'Custom quote', incl: 'Framework contract · SLA · International deployment' },
      ],
      oneTimeNote: 'The perpetual license grants unlimited-duration access to the software. Major updates beyond the included period are available under an annual maintenance contract.',
      deployTitle: 'Deployment fees (one-time)',
      deploy: [
        { scope: 'Local ≤ 20 veh.', desc: 'Local setup', price: '€1,500' },
        { scope: 'Local 21–50 veh.', desc: 'Extended local setup', price: '€3,500' },
        { scope: 'Local 51–100 veh.', desc: 'Large fleet setup', price: '€7,500' },
        { scope: 'International (50+ veh.)', desc: 'On-site deployment', price: 'Custom quote' },
      ],
      deployNote: 'International deployment includes: consultant travel, team training, vehicle data entry, full configuration, and 30-day remote monitoring.',
    },

    compliance: {
      title: 'Software built to institutional standards.',
      badges: [
        { fr: 'Data hosted in Europe', en: 'Données hébergées en Europe' },
        { fr: 'UN/NGO procurement compatible', en: 'Compatible procédures ONU/ONG' },
        { fr: 'Bilingual interface FR/EN', en: 'Interface bilingue FR/EN' },
        { fr: 'Audit-ready data exports', en: 'Exports conformes aux audits' },
      ],
    },

    contact: {
      title: 'Ready to digitize your fleet?',
      sub: 'Send us your requirements. We’ll reply within 48 hours with a tailored proposal.',
      firstName: 'First name',
      email: 'Professional email',
      fleetSize: 'Fleet size',
      fleetOptions: ['< 10', '10–20', '21–50', '50–100', '100+'],
      org: 'Organization',
      message: 'Message (optional)',
      submit: 'Send',
      rgpd: 'The information provided is used solely to process your request. Under the GDPR, you have the right to access, rectify, and delete your data.',
    },

    footer: {
      brand: 'FleetAxis',
      mail: 'projobs01@gmail.com',
      links: ['Legal notice', 'Privacy policy', 'Terms of use'],
      legal: '© 2026 FleetAxis',
    },
  },
} as const

export type Translation = (typeof translations)['fr']

export function getTranslation(lang: Lang): Translation {
  return translations[lang] as Translation
}
