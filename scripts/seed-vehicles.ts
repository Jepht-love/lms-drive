import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { INITIAL_VEHICLES } from '../lib/seed/vehicles'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variables NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function seedVehicles() {
  console.log('🚗 Démarrage du seed flotte LMS Drive...\n')

  for (const vehicle of INITIAL_VEHICLES) {
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id')
      .eq('plate', vehicle.plate)
      .maybeSingle()

    if (existing) {
      console.log(`⏭️  ${vehicle.plate} existe déjà — ignoré`)
      continue
    }

    const { error } = await supabase.from('vehicles').insert(vehicle)

    if (error) {
      console.error(`❌ Erreur pour ${vehicle.plate} :`, error.message)
    } else {
      console.log(`✅ ${vehicle.plate} — ${vehicle.brand} ${vehicle.model} ajouté`)
    }
  }

  console.log('\n--- Seed terminé ---')

  const { data, error } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, category, status')
    .order('brand')

  if (error) {
    console.error('❌ Erreur vérification :', error.message)
  } else {
    console.log(`\n📊 Flotte actuelle : ${data.length} véhicule(s)`)
    data.forEach(v => console.log(`   ${v.plate}  ${v.brand} ${v.model}  [${v.category}]  ${v.status}`))
  }
}

seedVehicles()
