/**
 * Écran « Import & tri » — chargement serveur des quatre piles à trier.
 *
 * À quoi il sert : réservé aux managers, il rassemble toutes les pièces déposées
 * en masse et pas encore classées (client, véhicule, société, partenaire) ainsi
 * que les cibles auxquelles on peut les rattacher, puis laisse
 * `ImportTriageClient` faire le tri à l'écran.
 *
 * Ce qu'il produit :
 *  - `staged` : une pièce = une ligne `documents` reconnue par `isPendingDoc`,
 *    avec sa famille (sa `category`) et une URL de miniature signée 1 h ;
 *  - `clients` / `vehicles` / `partners` : les cibles de rattachement. La société
 *    ne se rattache à rien, elle n'a donc pas de liste.
 *
 * Ce qu'il ne faut pas casser : le filtre passe par `isPendingDoc` et non par une
 * condition écrite ici. C'est lui qui reconnaît AUSSI les pièces client déposées
 * avant le tag `a-trier` (29/07/2026). Une condition recopiée ici finirait par
 * diverger, et des pièces classées réapparaîtraient dans les piles.
 * Les documents société déjà classés ont eux aussi `entity_id` vide : sans
 * `isPendingDoc`, ils tomberaient dans la pile à trier.
 *
 * Écrit le 30/07/2026 (extension aux quatre familles ; c'était la seule pile
 * client avant).
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTriageFamily, isPendingDoc, type TriageFamily } from '@/lib/documents/triage'
import ImportTriageClient, {
  type StagedDoc, type ClientLite, type TargetLite,
} from './ImportTriageClient'

/** Chemin dans le bucket `documents`, que la ligne porte une URL complète (ancien format) ou un chemin brut. */
function storagePath(fileUrl: string | null): string {
  if (!fileUrl) return ''
  return fileUrl.startsWith('http')
    ? (fileUrl.split('/storage/v1/object/public/documents/')[1] ?? '')
    : fileUrl
}

export default async function DocumentsImportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()
  const isManager = profile?.role === 'gerant' || profile?.role === 'associe' || !!profile?.is_admin
  if (!isManager) redirect('/documents')

  // Toutes les pièces sans cible : le tri fin est fait par `isPendingDoc`.
  const [{ data: docRows }, { data: clientRows }, { data: vehicleRows }, { data: partnerRows }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, name, file_url, file_type, category, entity_type, entity_id, is_auto_generated, tags, created_at')
      .is('entity_id', null)
      .eq('is_auto_generated', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('clients')
      .select('id, first_name, last_name, phone')
      .order('last_name'),
    supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .eq('is_active', true)
      .order('plate'),
    supabase
      .from('partner_agencies')
      .select('id, name, contact_name')
      .eq('is_active', true)
      .order('name'),
  ])

  const pending = (docRows ?? []).filter(isPendingDoc)

  // Miniatures : une seule signature pour tout le lot.
  const paths = pending.map(d => storagePath(d.file_url)).filter(p => p !== '')
  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
  }

  const staged: StagedDoc[] = pending.map(d => ({
    id: d.id,
    name: d.name,
    url: signedByPath.get(storagePath(d.file_url)) ?? null,
    fileType: d.file_type ?? null,
    // Une pièce déposée avant le tag n'a que sa catégorie « client » ; une
    // catégorie inconnue retombe sur la pile client plutôt que de disparaître.
    family: (getTriageFamily(d.category)?.id ?? 'client') as TriageFamily,
  }))

  const clients: ClientLite[] = (clientRows ?? []).map(c => ({
    id: c.id,
    name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client',
    phone: c.phone ?? null,
  }))

  // La plaque est le nom principal : c'est elle qui sert au nom de la pièce
  // (« Carte grise AB-123-CD »), la marque et le modèle aident à reconnaître.
  const vehicles: TargetLite[] = (vehicleRows ?? []).map(v => ({
    id: v.id,
    name: v.plate ?? 'Sans plaque',
    hint: `${v.brand ?? ''} ${v.model ?? ''}`.trim() || null,
  }))

  const partners: TargetLite[] = (partnerRows ?? []).map(p => ({
    id: p.id,
    name: p.name ?? 'Partenaire',
    hint: p.contact_name ?? null,
  }))

  return (
    <ImportTriageClient
      staged={staged}
      clients={clients}
      vehicles={vehicles}
      partners={partners}
    />
  )
}
