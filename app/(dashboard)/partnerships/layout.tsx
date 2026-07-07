import { requireManagerPage } from '@/lib/auth/roles'

// Les partenariats (locations inter-agences, montants) sont réservés au
// gérant/associé. Garde au niveau layout → couvre /partnerships et ses sous-routes.
export default async function PartnershipsLayout({ children }: { children: React.ReactNode }) {
  await requireManagerPage()
  return <>{children}</>
}
