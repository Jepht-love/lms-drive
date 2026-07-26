// ─── Génère .env.test à partir de la stack Supabase LOCALE ────────────────────
// Lit `supabase status -o env` et écrit .env.test à la racine. Aucune clé n'est
// écrite en dur ici : tout vient de la stack locale, dont les clés sont
// déterministes et publiques (elles ne donnent accès qu'à localhost).
//
//   node scripts/test-env/make-env-test.mjs
//
// Garde-fou : si l'URL obtenue n'est pas locale, le script refuse d'écrire.
// C'est la barrière qui rend matériellement impossible qu'une suite de tests
// pointe sur la production (base partagée localhost/prod, cf. CARTOGRAPHIE.md).

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const OUT = ROOT + '.env.test'

let raw
try {
  raw = execFileSync('npx', ['--yes', 'supabase@latest', 'status', '-o', 'env'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (e) {
  console.error('✗ `supabase status` a échoué. La stack locale tourne-t-elle ?')
  console.error('  Démarre-la avec :  npx supabase start')
  console.error(String(e.stderr || e.message).trim().split('\n').slice(0, 5).join('\n'))
  process.exit(1)
}

const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) env[m[1]] = m[2]
}

const API_URL = env.API_URL
const ANON = env.ANON_KEY
const SERVICE = env.SERVICE_ROLE_KEY
const DB_URL = env.DB_URL

if (!API_URL || !ANON || !SERVICE) {
  console.error('✗ Sortie de `supabase status` inattendue. Clés manquantes :',
    [!API_URL && 'API_URL', !ANON && 'ANON_KEY', !SERVICE && 'SERVICE_ROLE_KEY'].filter(Boolean).join(', '))
  process.exit(1)
}

// ─── Garde-fou anti-production ───────────────────────────────────────────────
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?/.test(API_URL)) {
  console.error(`✗ REFUS D'ÉCRIRE : l'URL obtenue n'est pas locale (${API_URL}).`)
  console.error('  Les tests ne doivent jamais viser une base distante.')
  process.exit(1)
}

const body = `# ─── Environnement de TEST — stack Supabase locale ───────────────────────────
# GÉNÉRÉ par scripts/test-env/make-env-test.mjs — ne pas éditer à la main.
# Régénérer :  node scripts/test-env/make-env-test.mjs
#
# Ces clés n'ouvrent que la base locale (${API_URL}). Elles sont
# déterministes et identiques pour toute installation du CLI Supabase : ce ne
# sont pas des secrets. Le fichier reste néanmoins ignoré par git (.env*).

NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE}
SUPABASE_DB_URL=${DB_URL ?? ''}

NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
BUSINESS_TZ=Europe/Paris

# Secret du cron — valeur de test, sans rapport avec la production.
CRON_SECRET=test-cron-secret-local-only

# Intégrations externes : volontairement VIDES en test.
# Le code doit se dégrader proprement sans elles ; si un test échoue parce
# qu'une de ces variables manque, c'est un défaut à corriger, pas une clé à
# ajouter ici.
RESEND_API_KEY=
RESEND_DEMO_TO=
SAV_ADMIN_EMAIL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
APNS_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=
APNS_PRODUCTION=false
`

writeFileSync(OUT, body)
console.log('✓ .env.test écrit')
console.log('  API      :', API_URL)
console.log('  base     :', DB_URL ?? '(non exposée)')
console.log('  ignoré par git : oui (.gitignore ligne « .env* »)')
