/**
 * Transformation des comptes en profils officiels — 23/07/2026 (usage unique).
 * Demandé par Jepht (admin) :
 *  - Toulassi (projobs01@gmail.com)      → Marich Toulassi, email marich.toulassi.pro@gmail.com, gérant
 *  - jefe     (akpadjijepht@gmail.com)   → Jepht Akpadji, ADMIN, réactivé ; ses 3 tâches → non attribué
 *  - LMS AGENCY (lms.drive.pro@gmail.com) → supprimé
 *  - jefe     (akpadjijeff@yahoo.fr)     → supprimé
 * Pré-requis : migration 060 exécutée (colonne profiles.is_admin).
 * Lancer : cd ~/lms-drive && npx tsx scripts/transform-profils-officiels.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)![1].trim()
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)![1].trim()
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const MARICH = '284ec27d-bb6a-465b-8e2b-184ab98cd0ac'   // ex-Toulassi (projobs01)
const JEPHT  = '7d7d4313-b68b-489d-8b05-c5634bf37eb6'   // ex-jefe inactif (akpadjijepht)
const LMS_AG = '7bfd8820-c3a7-4ce4-b03d-50fc122bf8f4'   // LMS AGENCY → suppression
const JEFE2  = '17b67f59-7573-4876-b149-4f13b9055434'   // jefe yahoo → suppression

async function step(label: string, fn: () => Promise<unknown>) {
  try { await fn(); console.log('OK  —', label) }
  catch (e) { console.log('ERR —', label, ':', (e as Error).message); process.exitCode = 1 }
}

async function main() {
  const { error: colErr } = await admin.from('profiles').select('is_admin').limit(1)
  if (colErr) { console.log('STOP : colonne is_admin absente —', colErr.message); process.exit(1) }
  console.log('OK  — migration 060 détectée (is_admin présent)')

  await step('3 tâches de jefe → non attribué', async () => {
    const { error } = await admin.from('tasks').update({ assigned_to: null }).eq('assigned_to', JEPHT)
    if (error) throw new Error(error.message)
  })

  await step('Profil Marich Toulassi (nom)', async () => {
    const { error } = await admin.from('profiles')
      .update({ full_name: 'Marich Toulassi' }).eq('id', MARICH)
    if (error) throw new Error(error.message)
  })
  await step('Email Marich → marich.toulassi.pro@gmail.com', async () => {
    const { error } = await admin.auth.admin.updateUserById(MARICH, {
      email: 'marich.toulassi.pro@gmail.com', email_confirm: true,
      user_metadata: { full_name: 'Marich Toulassi' },
    })
    if (error) throw new Error(error.message)
  })

  await step('Profil Jepht Akpadji (admin, actif)', async () => {
    const { error } = await admin.from('profiles')
      .update({ full_name: 'Jepht Akpadji', role: 'gerant', is_admin: true, is_active: true })
      .eq('id', JEPHT)
    if (error) throw new Error(error.message)
  })
  await step('Metadata auth Jepht', async () => {
    const { error } = await admin.auth.admin.updateUserById(JEPHT, {
      user_metadata: { full_name: 'Jepht Akpadji', role: 'gerant' },
    })
    if (error) throw new Error(error.message)
  })

  await step('Suppression LMS AGENCY', async () => {
    const { error } = await admin.auth.admin.deleteUser(LMS_AG)
    if (error) throw new Error(error.message)
  })
  await step('Suppression jefe (yahoo)', async () => {
    const { error } = await admin.auth.admin.deleteUser(JEFE2)
    if (error) throw new Error(error.message)
  })

  const { data: users } = await admin.auth.admin.listUsers()
  const { data: profiles } = await admin.from('profiles').select('id, full_name, role, is_active, is_admin')
  console.log('\n=== ÉTAT FINAL ===')
  for (const p of profiles ?? []) {
    const u = users?.users.find(x => x.id === p.id)
    console.log(`${p.full_name} | ${p.role}${p.is_admin ? ' + ADMIN' : ''} | ${p.is_active ? 'actif' : 'inactif'} | ${u?.email}`)
  }
}
main()
