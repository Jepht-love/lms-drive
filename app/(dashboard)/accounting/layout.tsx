import { requireManagerPage } from '@/lib/auth/roles'

// Toute la comptabilité (rapports, clôtures, KPI…) est réservée au gérant/associé.
// Garde au niveau layout → couvre /accounting ET toutes ses sous-routes.
export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireManagerPage()
  return <>{children}</>
}
