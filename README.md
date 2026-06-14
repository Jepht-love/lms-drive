# LMS Drive — Phase 1 MVP

Application de gestion de location de véhicules courte durée, optimisée tablette iPad (PWA).

## Stack

- **Next.js 16** (App Router, TypeScript strict)
- **Tailwind CSS** + shadcn/ui
- **Supabase** (PostgreSQL + Auth + Storage + Realtime)
- **Resend** (envoi emails avec PDF)
- **@react-pdf/renderer** (génération PDF côté serveur)
- Signature électronique : canvas HTML5 natif

## Configuration

### 1. Variables d'environnement

Renseignez vos clés dans `.env.local` :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Base de données Supabase

Dans le SQL Editor Supabase, exécutez dans l'ordre :

1. `supabase/migrations/001_initial_schema.sql` — tables, index, triggers
2. `supabase/migrations/002_rls_policies.sql` — RLS + buckets Storage

### 3. Premier utilisateur (gérant)

Créez un utilisateur dans Supabase Auth, puis dans le SQL Editor :

```sql
UPDATE profiles SET role = 'gerant' WHERE id = 'UUID_DE_L_UTILISATEUR';
```

### 4. Lancer en développement

```bash
npm run dev
```

## Modules Phase 1

| Module | Route | Statut |
|--------|-------|--------|
| Auth | `/login` | ✅ |
| Dashboard | `/` | ✅ |
| Calendrier flotte | `/calendar` | ✅ |
| Réservations | `/reservations` | ✅ |
| Clients | `/clients` | ✅ |
| Véhicules | `/vehicles` | ✅ |
| Contrats + signature + PDF + email | `/contracts` | ✅ |
| États des lieux | `/inspections` | ✅ |
| Incidents (basique) | `/incidents` | ✅ |
| Déplacements internes | `/internal-trips` | ✅ |
| Notifications | `/notifications` | ✅ |
| Paramètres + audit (gérant) | `/settings` | ✅ |

## Rôles

- **gerant** : accès total + paramètres + audit log
- **associe** : flotte, clients, réservations, contrats, EDL
- **employe** : EDL, déplacements internes, dashboard
