# CARTOGRAPHIE — LMS Drive

> Inventaire vérifiable de la surface fonctionnelle, établi le **25 juillet 2026** en
> **lecture seule** (aucun fichier applicatif modifié, aucune connexion à une base de
> production). Les politiques RLS sont dérivées des **62 migrations du dépôt**
> (`supabase/migrations/`), pas d'une introspection serveur : si une modification a été
> appliquée à la main hors migration, elle n'apparaît pas ici. Voir §7-R6.
>
> Base de référence pour le planning de tests de la campagne de stabilisation.

**Version du socle** — Next.js `16.2.7`, React `19.2.4`, Supabase JS, 46 dépendances de
production. **Aucun framework de test installé** (ni Playwright, ni Jest, ni Vitest, ni
Testing Library) : P1 part d'une page blanche. **Aucune bibliothèque de validation de
schéma** (ni zod, ni yup, ni valibot) : toute la validation d'entrée est manuelle.

**Volumétrie** — 379 fichiers `.ts`/`.tsx` applicatifs (`app/`, `components/`, `lib/`,
`hooks/`, `types/`), **49 800 lignes**. 80 pages, 30 route handlers, **103 server actions**
réparties sur 19 fichiers, 35 tables, 62 migrations.

---

## 0. Quatre corrections au brief de campagne

Le plan des 9 jours repose sur quatre prémisses que le code ne confirme pas. Elles sont
signalées ici en premier parce qu'elles changent le contenu de P1, P2 et P4.

### 0.1 — L'application n'est PAS multi-tenant

**Constat.** Aucune colonne `tenant_id`, `organization_id` ni `company_id` n'existe dans
les 35 tables. `partner_agency_id` (migrations 009 et 035) désigne une **agence
partenaire** au sens métier — la location inter-agences — et non un locataire logique.
La table `agency_settings` (migration 007) est explicitement un **singleton** :

```sql
-- 007_agency_settings.sql, ligne 4
-- Réglages agence (singleton) — en-tête contrats + tarifs par défaut
INSERT INTO agency_settings (company_name, siret)
SELECT 'LMS Agency', '99160973600012'
WHERE NOT EXISTS (SELECT 1 FROM agency_settings);
```

Aucune politique RLS ne filtre sur un identifiant de locataire ; toutes filtrent sur
`auth.uid()` ou sur `get_user_role()`.

**Conséquence.** L'isolation entre les deux clients est assurée par **deux instances
séparées** (deux projets Supabase, deux déploiements), pas par des lignes cloisonnées.
`/fleetaxis` est un **site vitrine public** (13 fichiers, 759 lignes, i18n fr/en), pas un
sélecteur de locataire.

**Impact sur le plan.**
- **P1 étape 2** — « 2 tenants, UUID fixes en dur » : à remplacer. Un seul jeu de données
  dans une base de test dédiée.
- **P2 étape 5** — « test d'isolation tenant » : sans objet en l'état. À remplacer par un
  **test d'isolation par rôle** : un `employe` ou un `prestataire` ne doit accéder ni à la
  comptabilité, ni aux fiches d'équipe, ni aux actions réservées. C'est le vrai risque
  d'habilitation ici, et il est documenté en §7.
- **P6 étape 3** — idem.

### 0.2 — Le module EDL a 40 zones dans un repère unique, pas 5 repères de 32 zones

**Constat.** `components/vehicle-schema/edl-zones.ts` définit **40 zones** dans **un seul
espace de coordonnées 1254 × 1254** (`EDL_IMG = 1254`), correspondant à une image de fond
unique `public/edl/vehicle-blueprint-v3.png`. Les « 5 vues » sont cinq **régions** de cette
même image, matérialisées par de simples commentaires de section (`── DESSUS ──`,
`── FACE AVANT ──`, `── FACE ARRIÈRE ──`, `── PROFIL GAUCHE ──`, `── PROFIL DROIT ──`).

Répartition : **32 polygones** (`points: [[x,y], …]`), 8 formes simples (ellipses jantes et
rectangles). Les « 32 zones » du brief correspondent aux 32 polygones.

`VehicleMap2D.tsx` n'a **pas de notion de vue** : il anime un `viewBox` SVG unique qui zoome
sur la boîte englobante de la zone cliquée (`zoneBox()`).

**Conséquence.** Un décalage « selon les vues » ne peut pas venir d'un repère par vue : il
n'y en a qu'un. Deux causes restent possibles et sont discriminables par le test de grille
de P4 : (a) polygones mal tracés dans certaines régions de l'image, (b) recouvrements entre
polygones voisins. Le commentaire d'en-tête du fichier (lignes 7-8) annonce des ids
présents deux fois — **c'est faux** : vérification faite, **aucun id n'est dupliqué**, et
les commentaires en ligne 37-41 et 49 documentent la suppression de ces doublons. Le
commentaire d'en-tête est périmé.

**Impact sur le plan.** Le test de grille de P4 devient simple et rapide : un balayage de
1254 × 1254 au pas de 10 px = ~15 700 points × 40 zones = ~630 000 tests point-dans-polygone.
Très largement sous les 30 secondes exigées.

### 0.3 — L'éditeur de polygones de P4 existe déjà à 80 %

**Constat.** `scripts/edl-editor/` (generate.mjs 72 l. + template.html 295 l. + README) et
la commande `npm run edl:editor` produisent `edl-editor.local.html`, un fichier HTML
autonome et git-ignoré qui embarque le line-art en data URI et les polygones courants.

Déjà couvert par rapport au cahier des charges de P4 :

| Exigence P4 | État |
|---|---|
| Inaccessible en production | ✅ **mieux que demandé** — ce n'est pas une route de l'app, donc rien à protéger ni à tester |
| Chargement de la vue + polygones en surimpression | ✅ |
| Sélection de vue (Dessus / Avant / Arrière / Profil G / Profil D) | ✅ presets de vue |
| Points déplaçables à la souris | ✅ glisser une pastille |
| Ajout / suppression de points | ✅ clic d'arête / touche Suppr |
| Export au format exact du code de production | ✅ « Exporter edl-zones.ts » |
| Ne peut rien écrire en base | ✅ fichier local, aucun serveur, aucune clé |
| Zoom, déplacement de la vue, annulation | ✅ molette / glisser / Ctrl+Z |
| **Détection en direct des recouvrements, signalés en rouge** | ❌ **absent** — 0 occurrence de `overlap`/`recouvr`/`conflit`/`intersect` dans `template.html` |
| Coordonnées du point survolé affichées en direct | ❔ à vérifier à l'ouverture |

**Impact sur le plan.** P4 Livrable 1 se réduit à **ajouter la détection de recouvrement**
au gabarit existant. Le reste de la journée J5 passe sur le Livrable 2 (test de grille), qui
lui n'existe pas.

### 0.4 — L'intégration Google Agenda est déjà entièrement retirée

**Constat.** Recherche sur `google.?calendar`, `googleapis`, `gcal`, `google_calendar`,
`calendar.google`, `google.?agenda`, `GOOGLE_CLIENT` dans `app/`, `components/`, `lib/`,
`types/`, `hooks/`, `scripts/`, `supabase/`, `package.json`, `docs/` et `*.md` :
**zéro occurrence**. Aucune variable d'environnement Google dans `.env.local`.

**Impact sur le plan.** Ce point de P0 étape 5 est clos, sans travail résiduel.

---

## 1. Routes

**Lecture du tableau.** La colonne « Rôle minimum » indique le contrôle **le plus fort
effectivement présent sur le chemin** ; `↳` signale un contrôle hérité d'un layout parent
et non redoublé dans le fichier. « SR » (⚠️) marque les fichiers qui instancient la clé
**service-role**, laquelle **contourne intégralement RLS** : sur ces routes, le contrôle
d'accès applicatif est la seule barrière.

**Contrôles transverses, appliqués avant toute route :**

| Couche | Fichier | Effet |
|---|---|---|
| Proxy (middleware) | `proxy.ts` | Sans session : `401 JSON` sur `/api/*`, redirection `/login` ailleurs. Puis filtre par onglet autorisé (`profiles.allowed_tabs`) pour `employe`/`prestataire`. **Fail-open assumé** : toute erreur de lecture du profil laisse passer (commentaire ligne 76). |
| Layout dashboard | `app/(dashboard)/layout.tsx` | Sans user → `/login` ; sans profil → `/auth/bienvenue`. |
| Layout compta | `app/(dashboard)/accounting/layout.tsx` | `requireManagerPage()` — gérant ou associé. |
| Layout partenariats | `app/(dashboard)/partnerships/layout.tsx` | `requireManagerPage()` — gérant ou associé. |

**Exclusions du proxy** (`proxy.ts`, `config.matcher`) : `api/health`, `api/notifications`,
`api/cron`, `sw.js`, `offline`, assets statiques. Ces chemins ne bénéficient **d'aucun
contrôle de session** et doivent porter leur propre garde — `api/notifications` et
`api/cron/*` valident bien `CRON_SECRET`, `api/health` est volontairement ouvert.

### 1.1 — Pages et route handlers

| Route | Type | Rôle minimum | Écritures directes | Actions importées | SR | Fichier |
|---|---|---|---|---|:-:|---|
| `/` | page | authentifié | — | — |  | `app/(dashboard)/page.tsx` |
| `/accounting` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/page.tsx` |
| `/accounting/analysis` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/analysis/page.tsx` |
| `/accounting/analysis/evolution` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/analysis/evolution/page.tsx` |
| `/accounting/analysis/postes` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/analysis/postes/page.tsx` |
| `/accounting/analysis/top` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/analysis/top/page.tsx` |
| `/accounting/charts` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/charts/page.tsx` |
| `/accounting/close/annual` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/close/annual/page.tsx` |
| `/accounting/close/daily` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/close/daily/page.tsx` |
| `/accounting/close/monthly` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/close/monthly/page.tsx` |
| `/accounting/creances` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/creances/page.tsx` |
| `/accounting/due-dates` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/due-dates/page.tsx` |
| `/accounting/export/excel` | handler GET | gérant · associé | — | — |  | `app/(dashboard)/accounting/export/excel/route.ts` |
| `/accounting/export/pdf` | handler GET | gérant · associé | — | — |  | `app/(dashboard)/accounting/export/pdf/route.ts` |
| `/accounting/kpi` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/kpi/page.tsx` |
| `/accounting/new` | page | ↳ gérant · associé (layout) | — | accounting |  | `app/(dashboard)/accounting/new/page.tsx` |
| `/accounting/remises` | page | gérant · associé | — | — |  | `app/(dashboard)/accounting/remises/page.tsx` |
| `/accounting/report` | page | ↳ gérant · associé (layout) | — | — |  | `app/(dashboard)/accounting/report/page.tsx` |
| `/alerts` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — | ⚠️ | `app/(dashboard)/alerts/page.tsx` |
| `/api/alerts/count` | handler GET | authentifié | — | — |  | `app/api/alerts/count/route.ts` |
| `/api/calendar/alerts` | handler GET | authentifié | — | — |  | `app/api/calendar/alerts/route.ts` |
| `/api/calendar/alerts/[id]/dismiss` | handler PATCH | authentifié | calendar_alerts·upd | — |  | `app/api/calendar/alerts/[id]/dismiss/route.ts` |
| `/api/calendar/events` | handler GET/POST | authentifié | calendar_events·ins, calendar_events·upd, internal_trips·ins, vehicles·ins | — |  | `app/api/calendar/events/route.ts` |
| `/api/calendar/events/[id]` | handler GET/PATCH/DELETE | gérant · associé | calendar_events·del, calendar_events·upd | — |  | `app/api/calendar/events/[id]/route.ts` |
| `/api/calendar/events/[id]/status` | handler PATCH | authentifié | calendar_events·upd | — |  | `app/api/calendar/events/[id]/status/route.ts` |
| `/api/calendar/resources` | handler GET | authentifié | — | — | ⚠️ | `app/api/calendar/resources/route.ts` |
| `/api/calendar/teams` | handler GET/POST/PATCH/DELETE | authentifié | calendar_teams·ins, calendar_teams·upd | — |  | `app/api/calendar/teams/route.ts` |
| `/api/contracts/convention-pdf` | handler POST | authentifié | contracts·upd, documents·del, documents·ins | — |  | `app/api/contracts/convention-pdf/route.ts` |
| `/api/contracts/generate-pdf` | handler POST | authentifié | contracts·upd, documents·del, documents·ins | — |  | `app/api/contracts/generate-pdf/route.ts` |
| `/api/contracts/send-email` | handler POST | authentifié | audit_logs·ins, contracts·upd | invoices |  | `app/api/contracts/send-email/route.ts` |
| `/api/contracts/sign` | handler POST | authentifié | audit_logs·ins, contracts·upd | — |  | `app/api/contracts/sign/route.ts` |
| `/api/cron/backfill-calendar` | handler GET | cron (CRON_SECRET) | — | — | ⚠️ | `app/api/cron/backfill-calendar/route.ts` |
| `/api/cron/due-dates` | handler GET | cron (CRON_SECRET) | notifications·ins, push_subscriptions·del | — | ⚠️ | `app/api/cron/due-dates/route.ts` |
| `/api/health` | handler GET | **aucun contrôle** | — | — |  | `app/api/health/route.ts` |
| `/api/invoices/[invoiceId]/preview` | handler GET | authentifié | — | — |  | `app/api/invoices/[invoiceId]/preview/route.ts` |
| `/api/notifications` | handler POST/GET | cron (CRON_SECRET) | notifications·ins, reservations·upd | — | ⚠️ | `app/api/notifications/route.ts` |
| `/api/push/apns/register` | handler POST | authentifié | apns_tokens·ups | — | ⚠️ | `app/api/push/apns/register/route.ts` |
| `/api/push/subscribe` | handler POST/DELETE | authentifié | push_subscriptions·del, push_subscriptions·ups | — | ⚠️ | `app/api/push/subscribe/route.ts` |
| `/api/push/vapid-public-key` | handler GET | **aucun contrôle** | — | — |  | `app/api/push/vapid-public-key/route.ts` |
| `/api/sav` | handler POST | authentifié | sav_tickets·ins | — | ⚠️ | `app/api/sav/route.ts` |
| `/api/search` | handler GET | **aucun contrôle** | — | — | ⚠️ | `app/api/search/route.ts` |
| `/api/settings/notifications` | handler GET/PATCH | authentifié | notification_settings·ups | — |  | `app/api/settings/notifications/route.ts` |
| `/api/sinistres/[id]/pdf` | handler GET | gérant · associé | documents·ins | — |  | `app/api/sinistres/[id]/pdf/route.ts` |
| `/api/team/[id]` | handler PATCH/DELETE | gérant | profiles·upd | — | ⚠️ | `app/api/team/[id]/route.ts` |
| `/api/team/invite` | handler POST | gérant · associé | profiles·upd, profiles·ups | — | ⚠️ | `app/api/team/invite/route.ts` |
| `/api/team/resend-invite` | handler POST | authentifié | — | — | ⚠️ | `app/api/team/resend-invite/route.ts` |
| `/auth/bienvenue` | page | authentifié | — | — |  | `app/auth/bienvenue/page.tsx` |
| `/auth/confirm` | handler GET/POST | **aucun contrôle** | — | — |  | `app/auth/confirm/route.ts` |
| `/calendar` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/calendar/page.tsx` |
| `/calendar/tasks` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | tasks |  | `app/(dashboard)/calendar/tasks/page.tsx` |
| `/calendar/tasks/[id]` | page | gérant · associé | tasks·del, tasks·upd | — |  | `app/(dashboard)/calendar/tasks/[id]/page.tsx` |
| `/calendar/tasks/new` | page | authentifié | tasks·ins | — |  | `app/(dashboard)/calendar/tasks/new/page.tsx` |
| `/calendrier` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/calendrier/page.tsx` |
| `/calendrier/disponibilites` | page | authentifié | — | — |  | `app/(dashboard)/calendrier/disponibilites/page.tsx` |
| `/clients` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/clients/page.tsx` |
| `/clients/[id]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | delete |  | `app/(dashboard)/clients/[id]/page.tsx` |
| `/clients/[id]/edit` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | clients |  | `app/(dashboard)/clients/[id]/edit/page.tsx` |
| `/clients/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | clients |  | `app/(dashboard)/clients/new/page.tsx` |
| `/contracts` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/contracts/page.tsx` |
| `/contracts/[id]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | delete |  | `app/(dashboard)/contracts/[id]/page.tsx` |
| `/contracts/[id]/preview` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/contracts/[id]/preview/page.tsx` |
| `/documents` | page | authentifié | — | — |  | `app/(dashboard)/documents/page.tsx` |
| `/documents/import` | page | authentifié | — | — |  | `app/(dashboard)/documents/import/page.tsx` |
| `/emails` | page | gérant · associé | — | — |  | `app/(dashboard)/emails/page.tsx` |
| `/equipe` | page | gérant · associé | — | — |  | `app/(dashboard)/equipe/page.tsx` |
| `/equipe/[id]` | page | gérant · associé | — | — |  | `app/(dashboard)/equipe/[id]/page.tsx` |
| `/equipe/[id]/edit` | page | gérant | — | — |  | `app/(dashboard)/equipe/[id]/edit/page.tsx` |
| `/equipe/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/equipe/new/page.tsx` |
| `/fleetaxis` | page | **aucun contrôle** | — | — |  | `app/fleetaxis/page.tsx` |
| `/incidents` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/incidents/page.tsx` |
| `/incidents/infractions` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/incidents/infractions/page.tsx` |
| `/incidents/infractions/[id]` | page | gérant · associé | — | — |  | `app/(dashboard)/incidents/infractions/[id]/page.tsx` |
| `/incidents/infractions/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | incidents |  | `app/(dashboard)/incidents/infractions/new/page.tsx` |
| `/incidents/sinistres` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/incidents/sinistres/page.tsx` |
| `/incidents/sinistres/[id]` | page | gérant · associé | — | — |  | `app/(dashboard)/incidents/sinistres/[id]/page.tsx` |
| `/incidents/sinistres/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | incidents |  | `app/(dashboard)/incidents/sinistres/new/page.tsx` |
| `/inspections/arrival/[contractId]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/inspections/arrival/[contractId]/page.tsx` |
| `/inspections/departure/[reservationId]` | page | authentifié | contracts·ins | — |  | `app/(dashboard)/inspections/departure/[reservationId]/page.tsx` |
| `/inspections/ia-arrival/[contractId]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/inspections/ia-arrival/[contractId]/page.tsx` |
| `/inspections/ia-departure/[operationId]` | page | authentifié | contracts·ins | — |  | `app/(dashboard)/inspections/ia-departure/[operationId]/page.tsx` |
| `/internal-trips` | page | authentifié | — | — |  | `app/(dashboard)/internal-trips/page.tsx` |
| `/login` | page | **aucun contrôle** | — | — |  | `app/(auth)/login/page.tsx` |
| `/maintenance` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/maintenance/page.tsx` |
| `/maintenance/[vehicleId]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/maintenance/[vehicleId]/page.tsx` |
| `/maintenance/[vehicleId]/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | maintenance |  | `app/(dashboard)/maintenance/[vehicleId]/new/page.tsx` |
| `/marketing` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/marketing/page.tsx` |
| `/marketing/[id]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/marketing/[id]/page.tsx` |
| `/marketing/analytics` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/marketing/analytics/page.tsx` |
| `/marketing/dashboard` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/marketing/dashboard/page.tsx` |
| `/marketing/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | campaigns |  | `app/(dashboard)/marketing/new/page.tsx` |
| `/menu` | page | authentifié | — | auth |  | `app/(dashboard)/menu/page.tsx` |
| `/offline` | page | **aucun contrôle** | — | — |  | `app/offline/page.tsx` |
| `/partnerships` | page | ↳ gérant · associé (layout) | — | — |  | `app/(dashboard)/partnerships/page.tsx` |
| `/partnerships/[id]` | page | ↳ gérant · associé (layout) | — | — |  | `app/(dashboard)/partnerships/[id]/page.tsx` |
| `/partnerships/[id]/convention` | page | authentifié | contracts·ins | — |  | `app/(dashboard)/partnerships/[id]/convention/page.tsx` |
| `/partnerships/agencies` | page | ↳ gérant · associé (layout) | — | — |  | `app/(dashboard)/partnerships/agencies/page.tsx` |
| `/partnerships/agencies/new` | page | ↳ gérant · associé (layout) | — | partnerships |  | `app/(dashboard)/partnerships/agencies/new/page.tsx` |
| `/partnerships/new` | page | ↳ gérant · associé (layout) | — | partnerships |  | `app/(dashboard)/partnerships/new/page.tsx` |
| `/profile` | page | authentifié | — | — |  | `app/(dashboard)/profile/page.tsx` |
| `/reservations` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | reservations·upd | — |  | `app/(dashboard)/reservations/page.tsx` |
| `/reservations/[id]` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | reservations·upd | delete |  | `app/(dashboard)/reservations/[id]/page.tsx` |
| `/reservations/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | reservations |  | `app/(dashboard)/reservations/new/page.tsx` |
| `/sav` | page | authentifié | — | — | ⚠️ | `app/(dashboard)/sav/page.tsx` |
| `/settings` | page | gérant | — | — |  | `app/(dashboard)/settings/page.tsx` |
| `/suivi` | page | gérant · associé | — | — |  | `app/(dashboard)/suivi/page.tsx` |
| `/vehicles` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | vehicles·upd | — |  | `app/(dashboard)/vehicles/page.tsx` |
| `/vehicles/[id]` | page | authentifié | — | delete |  | `app/(dashboard)/vehicles/[id]/page.tsx` |
| `/vehicles/[id]/edit` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | vehicles |  | `app/(dashboard)/vehicles/[id]/edit/page.tsx` |
| `/vehicles/immobilises` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | — |  | `app/(dashboard)/vehicles/immobilises/page.tsx` |
| `/vehicles/new` | page | ↳ authentifié (layout) + onglets autorisés (proxy) | — | vehicles |  | `app/(dashboard)/vehicles/new/page.tsx` |

> **Lecture de « aucun contrôle ».** La mention décrit le **fichier lui-même**, pas la
> requête complète. Sept routes la portent, et il faut les distinguer :
> `/login`, `/offline`, `/auth/confirm` et `/fleetaxis` sont **volontairement publiques** ;
> `/api/health` et `/api/push/vapid-public-key` n'exposent aucune donnée ;
> **`/api/search` est le seul cas problématique** — le proxy l'authentifie bien, mais elle
> n'a aucun contrôle de rôle et utilise la clé service-role. Voir §7-R3.

### 1.2 — Server actions

103 server actions réparties sur 19 fichiers (`lib/actions/*.ts`, 5 016 lignes). Toutes
sont marquées `'use server'` : elles sont donc **invocables directement par requête HTTP**,
indépendamment de l'interface. Le garde de page ne les protège pas.

**Synthèse.** 15 actions portent un contrôle de rôle explicite ; **88 se contentent de
vérifier qu'un utilisateur est connecté** et délèguent l'autorisation à RLS. C'est
défendable tant que la requête passe par la clé anon — mais **22 de ces 88 utilisent la
clé service-role**, qui contourne RLS. Sur celles-là, il n'existe aucun contrôle
d'autorisation, à aucun niveau. Détail en §7-R2.

| Fichier | Action | Garde de rôle | Clé SR |
|---|---|---|:-:|
| `accounting.ts` | `createTransaction` | gérant · associé | ⚠️ |
| `accounting.ts` | `deleteTransaction` | gérant · associé | ⚠️ |
| `accounting.ts` | `closeDailyAccounting` | gérant · associé |  |
| `accounting.ts` | `closeMonthlyAccounting` | gérant · associé |  |
| `accounting.ts` | `closeAnnualAccounting` | gérant · associé |  |
| `accounting.ts` | `updateTransactionNotes` | gérant · associé |  |
| `accounting.ts` | `toggleTransparence` | gérant · associé |  |
| `accounting.ts` | `reopenDailyClosing` | **authentifié seulement** |  |
| `accounting.ts` | `reopenMonthlyClosing` | **authentifié seulement** |  |
| `accounting.ts` | `reopenAnnualClosing` | **authentifié seulement** |  |
| `agency.ts` | `updateAgencySettings` | gérant · associé |  |
| `auth.ts` | `login` | **authentifié seulement** |  |
| `auth.ts` | `logout` | **authentifié seulement** |  |
| `auth.ts` | `completeOnboarding` | **authentifié seulement** | ⚠️ |
| `auth.ts` | `getProfile` | **authentifié seulement** |  |
| `availability.ts` | `setWeeklyAvailability` | **authentifié seulement** |  |
| `campaigns.ts` | `createCampaign` | **authentifié seulement** |  |
| `campaigns.ts` | `deleteCampaign` | **authentifié seulement** |  |
| `campaigns.ts` | `updateCampaignStatus` | **authentifié seulement** |  |
| `campaigns.ts` | `closeCampaign` | **authentifié seulement** |  |
| `clients.ts` | `createClientAction` | **authentifié seulement** |  |
| `clients.ts` | `createClientQuick` | **authentifié seulement** |  |
| `clients.ts` | `updateClientAction` | **authentifié seulement** |  |
| `clients.ts` | `updateClientNotes` | **authentifié seulement** |  |
| `clients.ts` | `updateClientStatus` | **authentifié seulement** |  |
| `delete.ts` | `deleteVehicle` | **authentifié seulement** |  |
| `delete.ts` | `deleteClient` | gérant · associé | ⚠️ |
| `delete.ts` | `deleteReservation` | gérant · associé | ⚠️ |
| `delete.ts` | `deleteContract` | gérant · associé | ⚠️ |
| `delete.ts` | `resetInspection` | **authentifié seulement** |  |
| `delete.ts` | `updateDepositStatus` | **authentifié seulement** |  |
| `delete.ts` | `updateDepositDeducted` | gérant · associé | ⚠️ |
| `delete.ts` | `updateDepositInfo` | **authentifié seulement** |  |
| `documents.ts` | `uploadDocument` | **authentifié seulement** |  |
| `documents.ts` | `bulkCreateClientDocuments` | **authentifié seulement** |  |
| `documents.ts` | `stageClientDocuments` | **authentifié seulement** |  |
| `documents.ts` | `assignClientDocuments` | **authentifié seulement** |  |
| `documents.ts` | `deleteClientDocument` | **authentifié seulement** |  |
| `documents.ts` | `replaceDocument` | **authentifié seulement** |  |
| `documents.ts` | `deleteDocument` | **authentifié seulement** |  |
| `documents.ts` | `sendDocumentByEmail` | **authentifié seulement** |  |
| `documents.ts` | `archiveContractDocument` | **authentifié seulement** |  |
| `documents.ts` | `archiveInfractionDocument` | **authentifié seulement** |  |
| `dueDates.ts` | `createDueDate` | **authentifié seulement** |  |
| `dueDates.ts` | `createReceivable` | **authentifié seulement** |  |
| `dueDates.ts` | `createRecurringDueDates` | **authentifié seulement** |  |
| `dueDates.ts` | `markDuePaid` | **authentifié seulement** |  |
| `dueDates.ts` | `deleteDueDate` | **authentifié seulement** |  |
| `dueDates.ts` | `restoreDueDate` | **authentifié seulement** |  |
| `incidents.ts` | `lookupDriver` | **authentifié seulement** |  |
| `incidents.ts` | `createInfraction` | **authentifié seulement** |  |
| `incidents.ts` | `transmitInfractionToClient` | **authentifié seulement** |  |
| `incidents.ts` | `markInfractionPaid` | **authentifié seulement** | ⚠️ |
| `incidents.ts` | `setInfractionRebilled` | **authentifié seulement** |  |
| `incidents.ts` | `recordInfractionRecovery` | **authentifié seulement** | ⚠️ |
| `incidents.ts` | `closeInfraction` | **authentifié seulement** |  |
| `incidents.ts` | `deleteInfraction` | **authentifié seulement** | ⚠️ |
| `incidents.ts` | `createAccident` | **authentifié seulement** | ⚠️ |
| `incidents.ts` | `updateAccidentStatus` | **authentifié seulement** | ⚠️ |
| `incidents.ts` | `deleteAccident` | **authentifié seulement** | ⚠️ |
| `incidents.ts` | `addAccidentToVehicle` | **authentifié seulement** |  |
| `internal-trips.ts` | `startTrip` | gérant · associé |  |
| `internal-trips.ts` | `endTrip` | **authentifié seulement** | ⚠️ |
| `internal-trips.ts` | `planTrip` | gérant · associé |  |
| `internal-trips.ts` | `assignTrip` | gérant · associé |  |
| `internal-trips.ts` | `startPlannedTrip` | **authentifié seulement** |  |
| `internal-trips.ts` | `cancelTrip` | **authentifié seulement** |  |
| `internal-trips.ts` | `deleteTrip` | **authentifié seulement** | ⚠️ |
| `invoices.ts` | `generateInvoiceDraft` | **authentifié seulement** |  |
| `invoices.ts` | `updateInvoiceLines` | **authentifié seulement** |  |
| `invoices.ts` | `sendInvoice` | **authentifié seulement** | ⚠️ |
| `invoices.ts` | `renderContractInvoiceAttachment` | **authentifié seulement** | ⚠️ |
| `invoices.ts` | `markRestitutionInvoiceSent` | **authentifié seulement** | ⚠️ |
| `invoices.ts` | `cancelInvoice` | **authentifié seulement** | ⚠️ |
| `maintenance.ts` | `createMaintenanceRecord` | **authentifié seulement** | ⚠️ |
| `maintenance.ts` | `deleteMaintenanceRecord` | **authentifié seulement** | ⚠️ |
| `maintenance.ts` | `markMaintenancePaid` | **authentifié seulement** | ⚠️ |
| `partnerships.ts` | `createAgency` | **authentifié seulement** |  |
| `partnerships.ts` | `deleteAgency` | **authentifié seulement** |  |
| `partnerships.ts` | `deleteOperation` | **authentifié seulement** |  |
| `partnerships.ts` | `createOperation` | **authentifié seulement** |  |
| `partnerships.ts` | `recordReturn` | **authentifié seulement** |  |
| `partnerships.ts` | `updateOperationStatus` | **authentifié seulement** |  |
| `partnerships.ts` | `startEntrantRental` | **authentifié seulement** |  |
| `partnerships.ts` | `validateConvention` | **authentifié seulement** |  |
| `reservations.ts` | `sendPaymentInfoEmail` | **authentifié seulement** |  |
| `reservations.ts` | `cancelReservationOnPaymentTimeout` | **authentifié seulement** |  |
| `reservations.ts` | `updatePaymentInfo` | **authentifié seulement** | ⚠️ |
| `reservations.ts` | `createReservation` | **authentifié seulement** | ⚠️ |
| `reservations.ts` | `markReservationDeparted` | **authentifié seulement** |  |
| `reservations.ts` | `updateLateFee` | **authentifié seulement** | ⚠️ |
| `reservations.ts` | `updateReservationStatus` | **authentifié seulement** |  |
| `reservations.ts` | `updateReservationDates` | **authentifié seulement** |  |
| `reservations.ts` | `prolongReservation` | **authentifié seulement** |  |
| `reservations.ts` | `validateContract` | **authentifié seulement** | ⚠️ |
| `sav.ts` | `updateSavStatus` | **authentifié seulement** | ⚠️ |
| `tasks.ts` | `updateTaskStatus` | **authentifié seulement** |  |
| `vehicle-issues.ts` | `reportVehicleIssues` | **authentifié seulement** |  |
| `vehicle-issues.ts` | `resolveVehicleIssue` | **authentifié seulement** | ⚠️ |
| `vehicle-issues.ts` | `setVehicleRepairStatus` | **authentifié seulement** |  |
| `vehicles.ts` | `createVehicle` | **authentifié seulement** |  |
| `vehicles.ts` | `updateVehicle` | **authentifié seulement** |  |
| `vehicles.ts` | `updateVehicleStatus` | **authentifié seulement** |  |

---

## 2. Écritures en base par point d'entrée

Extraction automatique : pour chaque `.from('table')`, recherche du premier verbe
d'écriture (`insert` / `update` / `upsert` / `delete`) dans la chaîne d'appel.
**Aucun appel `.rpc()` dans tout le code applicatif** — il n'existe donc aucune écriture
encapsulée côté base, et par conséquent **aucune transaction** (§7-R4).

### 2.1 — Server actions (le gros des écritures)

| Fichier | Tables écrites |
|---|---|
| `lib/actions/partnerships.ts` | `clients`·ins · `contracts`·upd/del · `documents`·del · `financial_transactions`·ins/del · `inspections`·upd/del · `inter_agency_rentals`·ins/upd/del · `partner_agencies`·ins/upd/del · `reservations`·ins · `vehicles`·ins/upd/del · `audit_logs`·ins |
| `lib/actions/delete.ts` | `accidents`·upd · `calendar_events`·del · `clients`·del · `contracts`·del · `financial_transactions`·ins/upd/del · `infractions`·upd · `inspection_photos`·del · `inspections`·del · `inter_agency_rentals`·upd · `reservations`·upd/del · `tasks`·upd · `vehicles`·upd · `audit_logs`·ins |
| `lib/actions/incidents.ts` | `accidents`·ins/upd/del · `documents`·ins · `financial_transactions`·ins/upd/del · `infractions`·ins/upd/del · `maintenance_records`·ins · `vehicles`·ins/upd · `audit_logs`·ins |
| `lib/actions/reservations.ts` | `clients`·ins · `contracts`·upd · `financial_transactions`·ins/upd/del · `inspections`·upd · `inter_agency_rentals`·upd · `reservations`·ins/upd · `vehicles`·upd · `audit_logs`·ins |
| `lib/actions/maintenance.ts` | `calendar_events`·ins/del · `documents`·ins · `financial_transactions`·ins/del · `maintenance_records`·ins/upd/del · `vehicles`·ins/upd · `audit_logs`·ins |
| `lib/actions/accounting.ts` | `annual_closings`·ups · `daily_closings`·ups · `monthly_closings`·ups · `financial_transactions`·ins/upd/del/ups · `profiles`·upd · `audit_logs`·ins |
| `lib/actions/internal-trips.ts` | `internal_trips`·ins/upd/del · `calendar_events`·del · `financial_transactions`·ins/del · `vehicles`·upd · `audit_logs`·ins |
| `lib/actions/invoices.ts` | `invoices`·ins/upd · `documents`·ins · `financial_due_dates`·ins/del · `audit_logs`·ins |
| `lib/actions/dueDates.ts` | `financial_due_dates`·ins/upd/del · `financial_transactions`·ins |
| `lib/actions/documents.ts` | `documents`·ins/upd/del |
| `lib/actions/clients.ts` | `clients`·ins/upd · `reservations`·upd · `audit_logs`·ins |
| `lib/actions/campaigns.ts` | `campaigns`·ins/upd/del · `audit_logs`·ins |
| `lib/actions/vehicles.ts` | `vehicles`·ins/upd · `audit_logs`·ins |
| `lib/actions/vehicle-issues.ts` | `vehicles`·upd · `financial_transactions`·ins · `audit_logs`·ins |
| `lib/actions/agency.ts` | `agency_settings`·ins/upd · `audit_logs`·ins |
| `lib/actions/availability.ts` | `availability_slots`·ups/del |
| `lib/actions/auth.ts` | `profiles`·ins/upd |
| `lib/actions/sav.ts` | `sav_tickets`·upd |
| `lib/actions/tasks.ts` | `tasks`·upd |

### 2.2 — Route handlers

| Route | Tables écrites |
|---|---|
| `/api/calendar/events` | `calendar_events`·ins/upd · `internal_trips`·ins · `vehicles`·ins |
| `/api/calendar/events/[id]` | `calendar_events`·upd/del |
| `/api/calendar/events/[id]/status` | `calendar_events`·upd |
| `/api/calendar/alerts/[id]/dismiss` | `calendar_alerts`·upd |
| `/api/calendar/teams` | `calendar_teams`·ins/upd |
| `/api/contracts/generate-pdf` | `contracts`·upd · `documents`·ins/del |
| `/api/contracts/convention-pdf` | `contracts`·upd · `documents`·ins/del |
| `/api/contracts/send-email` | `contracts`·upd · `audit_logs`·ins |
| `/api/contracts/sign` | `contracts`·upd · `audit_logs`·ins |
| `/api/sinistres/[id]/pdf` | `documents`·ins |
| `/api/notifications` (cron) | `notifications`·ins · `reservations`·upd |
| `/api/cron/due-dates` | `notifications`·ins · `push_subscriptions`·del |
| `/api/push/subscribe` | `push_subscriptions`·ups/del |
| `/api/push/apns/register` | `apns_tokens`·ups ⚠️ **table absente des migrations** (§7-R6) |
| `/api/settings/notifications` | `notification_settings`·ups |
| `/api/team/invite` | `profiles`·ups/upd |
| `/api/team/[id]` | `profiles`·upd |
| `/api/sav` | `sav_tickets`·ins |

### 2.3 — Écritures depuis un composant client

Deux composants écrivent en base **directement depuis le navigateur**, sans passer par une
server action — donc sans aucune validation côté serveur des valeurs envoyées :

| Fichier | Écriture | Filet de sécurité |
|---|---|---|
| `app/(dashboard)/alerts/NotificationsList.tsx` | `notifications`·upd | RLS `notifs_own` (`user_id = auth.uid()`) |
| `app/(dashboard)/marketing/[id]/KpiEditor.tsx` | `campaigns`·upd | RLS `campaigns_managers` |

Dans les deux cas RLS borne le **périmètre** des lignes, mais **pas le contenu** écrit.

### 2.4 — Modules de synchronisation (appelés par les actions)

| Fichier | Tables écrites |
|---|---|
| `lib/calendar/syncRental.ts` | `calendar_events`·ins/upd/del |
| `lib/calendar/syncAlerts.ts` | `calendar_events`·ins/upd/del |
| `lib/calendar/syncInternalTrip.ts` | `calendar_events`·ins/upd |
| `lib/calendar/generateAlerts.ts` | `calendar_alerts`·ins/del |
| `lib/vehicles/vehicleStatus.ts` | `vehicles`·upd |
| `lib/audit/log.ts` | `audit_logs`·ins |
| `lib/push/broadcastPush.ts` | `push_subscriptions`·del |
| `lib/push/sendApns.ts` | `apns_tokens`·del ⚠️ |

---

## 3. Tables et politiques RLS

35 tables créées par les migrations. **34 ont RLS activée**, 1 ne l'a pas.
Rappel de méthode : politiques dérivées du dépôt, pas d'une introspection serveur.

`get_user_role()` est une fonction SQL `SECURITY DEFINER STABLE` définie en
`001_initial_schema.sql:302` :

```sql
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Elle est appelée par **28 politiques sur 34 tables**. Voir §7-R7 pour son coût.

| Table | RLS | Politiques | Portée effective |
|---|:-:|---|---|
| `accidents` | ✅ | `accidents_managers` (ALL) | gérant · associé |
| `agency_settings` | ✅ | `agency_read_all` (SELECT), `agency_write_gerant` (ALL) | lecture : tout authentifié · écriture : gérant |
| `annual_closings` | ✅ | `annual_managers` (ALL) | gérant · associé |
| `audit_logs` | ✅ | `audit_insert_all` (INSERT), `audit_read_gerant` (SELECT) | écriture : tout authentifié · lecture : gérant |
| `availability_slots` | ✅ | `availability_select` (SELECT), `availability_write` (ALL) | lecture : tout authentifié · écriture : soi-même ou manager |
| `calendar_alerts` | ✅ | `calendar_alerts_select`, `calendar_alerts_update` | via `EXISTS` sur l'événement lié |
| `calendar_events` | ✅ | `_select`, `_insert`, `_update`, `_delete` | lecture/modif : assigné ou manager · création/suppression : manager |
| `calendar_teams` | ✅ | `calendar_teams_select`, `calendar_teams_write` | lecture : tout authentifié · écriture : manager |
| `calendar_user_preferences` | ✅ | `calendar_prefs_own` (ALL) | soi-même |
| `campaigns` | ✅ | `campaigns_managers` (ALL) | gérant · associé |
| `clients` | ✅ | `clients_managers` (ALL) | gérant · associé |
| `contracts` | ✅ | `contracts_managers` (ALL) | gérant · associé |
| `daily_closings` | ✅ | `daily_managers` (ALL) | gérant · associé |
| **`documents`** | ❌ | **AUCUNE** | ⛔ **ouverte — voir §7-R1** |
| `email_logs` | ✅ | `email_logs_managers` (ALL) | gérant · associé |
| `financial_due_dates` | ✅ | `financial_due_dates_all` (ALL) | gérant · associé |
| `financial_transactions` | ✅ | `ft_managers` (ALL) | gérant · associé |
| `incidents` | ✅ | `_read_all`, `_create_all`, `_update_gerant` | lecture/création : tout authentifié · modif : gérant |
| `infractions` | ✅ | `infractions_managers` (ALL) | gérant · associé |
| `inspection_photos` | ✅ | `photos_all_insert`, `photos_managers_read`, `photos_own_read` | création : tout authentifié · lecture : manager ou auteur |
| `inspections` | ✅ | `inspections_all_insert`, `_managers_read`, `_own_read` | idem |
| `inter_agency_rentals` | ✅ | `iar_read` (SELECT), `iar_write` (ALL) | lecture : tout authentifié · écriture : manager |
| `internal_trips` | ✅ | `trips_own` (ALL) — redéfinie en `051` | soi-même ou manager |
| `invoices` | ✅ | `invoices_all` (ALL) | gérant · associé |
| `maintenance_records` | ✅ | `_read_all`, `_create_all`, `_update_managers`, `_delete_managers` | lecture/création : tout authentifié · modif/suppr : manager |
| `monthly_closings` | ✅ | `monthly_managers` (ALL) | gérant · associé |
| `notification_settings` | ✅ | `notif_own` (ALL) | soi-même |
| `notifications` | ✅ | `notifs_own` (ALL) | soi-même |
| `partner_agencies` | ✅ | `partner_agencies_read`, `_write` | lecture : tout authentifié · écriture : manager |
| `profiles` | ✅ | `profiles_own_read` (SELECT), `profiles_own_update` (UPDATE) | lecture : **soi-même ou gérant** · modif : soi-même |
| `push_subscriptions` | ✅ | `push_own` (ALL) | soi-même |
| `reservations` | ✅ | `reservations_read_all`, `_write_managers` | lecture : tout authentifié · écriture : manager |
| `sav_tickets` | ✅ | `sav_insert_any_auth` (INSERT) uniquement | création : tout authentifié · **lecture/modif : service-role seul, volontaire et documenté** |
| `tasks` | ✅ | `_select`, `_insert`, `_update`, `_delete` | assigné ou manager |
| `vehicles` | ✅ | `vehicles_read_all`, `_write_managers` | lecture : tout authentifié · écriture : manager |

**Buckets de stockage** (politiques sur `storage.objects`) : `contracts-pdf`, `documents`,
`vehicle-photos`, `vehicle-reference` → tout authentifié ; `client-documents` → manager
uniquement ; `sav-screenshots` → bucket privé.

**Table écrite mais absente des migrations : `apns_tokens`** — voir §7-R6.

---

## 4. Requêtes lancées en boucle

18 emplacements détectés (une requête, un `fetch` ou un appel storage à l'intérieur d'un
`for` / `forEach` / `map`). Classés par impact.

### 4.1 — Impact utilisateur direct (rendu d'écran)

| Emplacement | Boucle | Requête | Effet |
|---|---|---|---|
| `app/(dashboard)/vehicles/[id]/page.tsx:164` | `photoPaths.map(async p => …)` | `storage.createSignedUrl(p, 3600)` | 1 appel signé **par photo** du véhicule |
| `app/(dashboard)/sav/page.tsx:34` | `tickets.map(async t => …)` | `storage.from('sav-screenshots')` | 1 appel **par ticket** |
| `app/(dashboard)/vehicles/page.tsx:150` | `toPersist.map(id => …)` | `vehicles.update().eq('id', id)` | 1 UPDATE **par véhicule** dont le statut a dérivé, **au chargement de la liste** |
| `app/(dashboard)/equipe/TeamList.tsx:68` | `for (const id of selected)` | `fetch('/api/team/…', DELETE)` | 1 requête HTTP **par membre** sélectionné, en série |

`vehicles/page.tsx:150` mérite une attention particulière : c'est une **écriture déclenchée
par une lecture**. Afficher la flotte peut écrire en base.

### 4.2 — Traitements cron (impact sur la durée du job, pas sur l'UI)

| Emplacement | Boucle | Requête |
|---|---|---|
| `app/api/notifications/route.ts:70` | `for (const r of upcomingDepartures)` | `notifications` |
| `app/api/notifications/route.ts:108` | `for (const t of soonTasks)` | `notifications` (test d'existence) |
| `app/api/notifications/route.ts:133` | `for (const ev of soonEvents)` | `notifications` (test d'existence) |
| `app/api/notifications/route.ts:162` | `for (const r of returnsSoon)` | `notifications` |
| `app/api/notifications/route.ts:192` | `for (const r of newlyLate)` | `reservations.update({status:'en_retard'})` |
| `app/api/notifications/route.ts:204` | `for (const r of lateReturns)` | `notifications` |
| `app/api/notifications/route.ts:324` | `for (const r of lateReturns)` | `notifications` |
| `app/api/notifications/route.ts:386` | `for (const ev of lateEvents)` | `notifications` |
| `app/api/notifications/route.ts:426` | `for (const a of alerts)` | `notifications` |
| `app/api/cron/due-dates/route.ts:93` | `for (const due of dues)` | `notifications` |
| `lib/calendar/syncAlerts.ts:55` | `for (const alert of actionable)` | `calendar_events.update()` |
| `lib/sav/telegram.ts:105` | `for (let start = 0; …; start += 10)` | `fetch` API Telegram — **pagination délibérée**, pas un N+1 |

`app/api/notifications/route.ts` concentre **9 des 18 boucles**. C'est le fichier à traiter
en premier si la durée du cron devient un sujet.

### 4.3 — Suppressions en cascade manuelles

| Emplacement | Boucle | Requête |
|---|---|---|
| `lib/actions/partnerships.ts:112` | `for (const c of convContracts)` | `inspections.delete().eq('contract_id', c.id)` |
| `lib/actions/reservations.ts:133` | `for (const t of prevLoc)` | `financial_transactions.delete().eq('id', t.id)` |

Ces deux-là sont aussi des **suppressions multi-tables non transactionnelles** (§7-R4).

---

## 5. Code mort

### 5.1 — Fichiers jamais importés

Vérifié par recherche d'import par chemin sur les 379 fichiers, puis contre-vérifié au grep.

| Fichier | Lignes | Statut |
|---|---:|---|
| `components/vehicle-schema/VehicleInspection3D.tsx` | 254 | orphelin — ancienne approche 3D de l'EDL |
| `components/layout/Sidebar.tsx` | 182 | orphelin (`CalendarSidebar` est un autre fichier) |
| `components/vehicle-schema/VehicleOrthographicSVG.tsx` | 181 | orphelin — ancienne approche « 5 vues SVG » |
| `components/vehicle-schema/VehicleSchemaInteractive.tsx` | 170 | orphelin |
| `components/ui/select.tsx` | 161 | orphelin (shadcn non utilisé) |
| `app/(dashboard)/clients/AssignStatusButton.tsx` | 154 | orphelin |
| `app/(dashboard)/alerts/NotificationsList.tsx` | 118 | orphelin — **mais écrit en base** (§2.3) |
| `components/vehicle-schema/DamageDrawer.tsx` | 116 | orphelin |
| `app/(dashboard)/incidents/IncidentsClient.tsx` | 107 | orphelin |
| `components/layout/LmsLogo.tsx` | 76 | orphelin |
| `lib/actions/availability.ts` | 48 | orphelin — **1 server action exposée** (`setWeeklyAvailability`) |
| `components/ui/sonner.tsx` | 46 | orphelin (shadcn non utilisé) |
| `app/(dashboard)/DashboardKPIs.tsx` | 42 | orphelin |
| `app/(dashboard)/reservations/PaymentSection.tsx` | 40 | orphelin |
| `components/ui/badge.tsx` | 37 | orphelin (shadcn non utilisé) |
| `lib/contracts/damage-rates.ts` | 34 | orphelin |
| `lib/motion/variants.ts` | 30 | orphelin |
| `components/FuelGauge.tsx` | 29 | orphelin |

**≈ 1 825 lignes mortes.** Deux cas ne sont pas inertes : `lib/actions/availability.ts`
reste une **server action appelable par HTTP** même si aucune UI ne l'appelle, et
`NotificationsList.tsx` contient une écriture. Les trois `components/ui/*` sont des restes
de shadcn/ui — à conserver si la refonte shadcn est toujours au programme.

Trois fichiers de zones EDL coexistent alors qu'un seul est actif :
`edl-zones.ts` (**actif**, monté via `VehicleMap2D`), `inspection-types.ts` (`VEHICLE_ZONES`,
utilisé par les orphelins `VehicleOrthographicSVG` + `DamageComparison`) et `zones.ts`
(`VEHICLE_ZONES`, utilisé par l'orphelin `VehicleSchemaInteractive`). **Deux définitions
concurrentes de `VEHICLE_ZONES`** dans le dépôt : à trancher avant J5.

### 5.2 — Imports et variables non utilisés

**110 signalements** par ESLint sur le code applicatif. Dominante nette : **`Link` importé
et non utilisé dans 17 pages** (héritage d'un refactor de navigation). Autres notables :

- `lib/actions/delete.ts:8` — `removeReservationFromCalendar` importé, jamais appelé.
  **À vérifier** : une suppression de réservation nettoie-t-elle bien son événement
  calendrier ? Le fichier fait bien un `calendar_events.delete()` par ailleurs.
- `components/vehicle-schema/VehicleSchemaInteractive.tsx:5` — `VEHICLE_ZONES` importé,
  non utilisé (le fichier est lui-même orphelin).
- `app/(dashboard)/reservations/[id]/page.tsx` — 6 symboles morts, dont `PAYMENT_LABELS`.
- `lib/pdf/contract-template.tsx:299` — `DamageChips` défini, jamais rendu.

### 5.3 — Reste de la santé ESLint (contexte pour la campagne)

| Règle | Occurrences |
|---|---:|
| `@typescript-eslint/no-explicit-any` | 233 |
| `@typescript-eslint/no-unused-vars` | 110 |
| `@typescript-eslint/no-unused-expressions` | 79 |
| `react/no-unescaped-entities` | 60 |
| `react-hooks/static-components` | 26 |
| `react-hooks/set-state-in-effect` | 22 |
| `react-hooks/refs` | 13 |
| `jsx-a11y/alt-text` | 13 |
| `@next/next/no-img-element` | 10 |
| `react-hooks/exhaustive-deps` | 6 |
| `react-hooks/purity` | 5 |
| autres | 4 |
| **Total** | **581** |

`react-hooks/set-state-in-effect` (22) et `react-hooks/purity` (5) sont les plus
susceptibles de produire des **bugs de rendu observables** — à croiser avec les échecs de
P2. Les 233 `any` expliquent qu'aucune de ces erreurs ne soit rattrapée à la compilation.

---

## 6. Modules fonctionnels

Découpage retenu pour organiser `tests/` en P1 étape 3. Complexité = lignes de `.ts`/`.tsx`.

| # | Module | Routes principales | Tables | Rôles | Fichiers | Lignes |
|---|---|---|---|---|---:|---:|
| 1 | **Comptabilité & factures** | `/accounting` + 12 sous-pages, `/accounting/export/{excel,pdf}`, `/api/invoices/[id]/preview` | `financial_transactions`, `daily_closings`, `monthly_closings`, `annual_closings`, `financial_due_dates`, `invoices` | gérant · associé | 39 | 5 394 |
| 2 | **Calendrier** | `/calendar`, `/calendrier`, `/calendar/tasks*`, `/calendrier/disponibilites`, `/api/calendar/*` (6 handlers) | `calendar_events`, `calendar_alerts`, `calendar_teams`, `calendar_user_preferences`, `tasks`, `availability_slots` | tous (vue filtrée par `assigned_to`) | 40 | 5 173 |
| 3 | **Réservations** | `/reservations`, `/reservations/new`, `/reservations/[id]` | `reservations`, `financial_transactions`, `clients`, `vehicles`, `contracts` | lecture : tous · écriture : manager | 24 | 4 665 |
| 4 | **États des lieux (EDL)** | `/inspections/departure/[reservationId]`, `/inspections/arrival/[contractId]`, `/inspections/ia-*` | `inspections`, `inspection_photos`, `contracts` | authentifié (création) · manager (lecture globale) | 18 | 4 068 |
| 5 | **Contrats & PDF** | `/contracts`, `/contracts/[id]`, `/contracts/[id]/preview`, `/api/contracts/{generate-pdf,convention-pdf,send-email,sign}` | `contracts`, `documents`, `audit_logs` | gérant · associé | 18 | 3 404 |
| 6 | **Clients** | `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` | `clients`, `documents`, `reservations` | gérant · associé | 15 | 2 583 |
| 7 | **Véhicules & flotte** | `/vehicles`, `/vehicles/new`, `/vehicles/[id]`, `/vehicles/[id]/edit`, `/vehicles/immobilises` | `vehicles`, `maintenance_records`, `internal_trips` | lecture : tous · écriture : manager | 14 | 2 100 |
| 8 | **Documents** | `/documents`, `/documents/import` | `documents` ⛔ | authentifié | 7 | 2 095 |
| 9 | **Partenariats inter-agences** | `/partnerships` + 5 sous-pages | `partner_agencies`, `inter_agency_rentals`, `contracts`, `vehicles`, `clients` | gérant · associé (layout) | 17 | 1 886 |
| 10 | **Équipe & permissions** | `/equipe`, `/equipe/new`, `/equipe/[id]`, `/equipe/[id]/edit`, `/api/team/*` | `profiles` | gérant (associé en lecture, **cassé** — §7-R5) | 15 | 1 883 |
| 11 | **Incidents** | `/incidents`, `/incidents/sinistres*`, `/incidents/infractions*`, `/api/sinistres/[id]/pdf` | `accidents`, `infractions`, `incidents`, `financial_transactions` | mixte selon l'action | 14 | 1 614 |
| 12 | **Suivi / dashboard** | `/`, `/suivi` | lecture transverse | authentifié / manager | 4 | 1 283 |
| 13 | **Marketing / campagnes** | `/marketing` + 4 sous-pages | `campaigns` | gérant · associé | 12 | 1 271 |
| 14 | **Notifications & push** | `/alerts`, `/api/notifications`, `/api/cron/due-dates`, `/api/push/*`, `/api/alerts/count`, `/api/settings/notifications` | `notifications`, `push_subscriptions`, `notification_settings`, `apns_tokens` ⚠️ | authentifié · cron | 13 | 1 165 |
| 15 | **Maintenance** | `/maintenance`, `/maintenance/[vehicleId]`, `/maintenance/[vehicleId]/new` | `maintenance_records`, `vehicles`, `financial_transactions` | lecture/création : tous · modif : manager | 9 | 1 092 |
| 16 | **Déplacements internes** | `/internal-trips` | `internal_trips`, `calendar_events`, `vehicles` | soi-même ou manager | 4 | 953 |
| 17 | **Réglages / profil / menu** | `/settings`, `/profile`, `/menu` | `agency_settings`, `profiles` | gérant (réglages) · authentifié (profil) | 11 | 768 |
| 18 | **Site vitrine FleetAxis** | `/fleetaxis` | — | **public** | 13 | 759 |
| 19 | **Emails** | `/emails` | `email_logs` | gérant · associé | 6 | 708 |
| 20 | **Auth & onboarding** | `/login`, `/auth/confirm`, `/auth/bienvenue` | `profiles` | public / authentifié | 9 | 567 |
| 21 | **SAV** | `/sav`, `/api/sav` | `sav_tickets` | création : tous · gestion : admin | 8 | 543 |
| 22 | **Suppressions (transverse)** | — (`lib/actions/delete.ts`) | 13 tables | gérant · associé | 3 | 435 |
| 23 | **Cron** | `/api/cron/backfill-calendar`, `/api/cron/due-dates` | `notifications`, `calendar_events` | `CRON_SECRET` | 2 | 202 |
| — | *Transverse (UI partagée, layout, PWA, hooks)* | — | — | — | 64 | 5 947 |
| | **TOTAL** | | | | **379** | **49 800** |

**Ordre suggéré pour P2** (couverture décroissante du risque d'exploitation) :
Réservations → EDL → Contrats & PDF → Comptabilité → Calendrier → Véhicules → Clients →
le reste. Les modules 18 et 19 sont hors périmètre critique.


---

## 7. Zones à risque

**Grille de gravité.** Le plan de campagne référence une grille « S1 à S4 » que je n'ai pas
dans le dépôt. Faute de source, j'applique la lecture suivante — **à confirmer** ou à
remplacer par la vôtre :

- **S1** — fuite ou corruption de données, ou arrêt de l'exploitation de l'agence.
- **S2** — fonction métier cassée, contournement d'habilitation sans fuite directe.
- **S3** — comportement incorrect avec contournement possible par l'utilisateur.
- **S4** — gêne, dette, ou risque latent sans manifestation actuelle.

---

### R1 — `documents` : aucune RLS, aucune politique — **S1**

**Constat.** `documents` est la **seule** table sans `ENABLE ROW LEVEL SECURITY` et sans
aucune `CREATE POLICY` dans les 62 migrations. Vérifié trois fois : absente de
`013_documents.sql`, de `050_documents_status_versions.sql` et de `036_documents_bucket.sql`
(cette dernière ne pose des politiques que sur `storage.objects`, pas sur la table).

**Ce que ça expose.** La table porte les documents clients — permis, CNI, justificatifs de
domicile, factures, conventions. Sans RLS, les droits reposent sur les seuls `GRANT` de
schéma : par défaut, sur Supabase, les rôles `anon` et `authenticated` disposent des droits
sur les tables de `public`. Concrètement, **tout utilisateur connecté — y compris un
`prestataire` — peut lire, modifier et supprimer toutes les lignes**, et les métadonnées
incluent les chemins de stockage.

**À vérifier avant de conclure.** Les `GRANT` réels sur la table en base ; ils peuvent avoir
été restreints à la main hors migration. C'est la première chose à contrôler.

**Correctif.** Migration dédiée, sur le modèle de `clients_managers`. Ne pas appliquer sans
mesurer l'impact : 7 fichiers et 2 095 lignes lisent cette table, et `/documents` est
accessible à tout utilisateur authentifié — une politique « manager seulement » peut vider
l'écran pour un employé.

---

### R2 — 22 server actions en clé service-role sans contrôle de rôle — **S1**

**Constat.** Sur 103 server actions, 88 vérifient seulement qu'un utilisateur est connecté.
Pour 66 d'entre elles c'est acceptable : la requête passe par la clé anon, donc RLS tranche.
Pour les **22 suivantes, la clé service-role est utilisée — RLS est contournée** et il ne
reste aucun contrôle d'autorisation, à aucun niveau :

| Fichier | Actions concernées |
|---|---|
| `lib/actions/incidents.ts` | `markInfractionPaid`, `recordInfractionRecovery`, `deleteInfraction`, `createAccident`, `updateAccidentStatus`, `deleteAccident` |
| `lib/actions/invoices.ts` | `sendInvoice`, `renderContractInvoiceAttachment`, `markRestitutionInvoiceSent`, `cancelInvoice` |
| `lib/actions/reservations.ts` | `updatePaymentInfo`, `createReservation`, `updateLateFee`, `validateContract` |
| `lib/actions/maintenance.ts` | `createMaintenanceRecord`, `deleteMaintenanceRecord`, `markMaintenancePaid` |
| `lib/actions/internal-trips.ts` | `endTrip`, `deleteTrip` |
| `lib/actions/vehicle-issues.ts` | `resolveVehicleIssue` |
| `lib/actions/sav.ts` | `updateSavStatus` |
| `lib/actions/auth.ts` | `completeOnboarding` |

**Ce que ça expose.** Une server action `'use server'` est un **endpoint HTTP**. Un compte
`employe` ou `prestataire` — donc toute personne à qui l'agence a ouvert un accès — peut les
appeler directement et : encaisser une facture, annuler une facture, créer une réservation,
solder une infraction, écrire dans `financial_transactions`, supprimer un enregistrement de
maintenance. Sans passer par l'interface, et sans que RLS s'y oppose.

**Nuance.** `endTrip` et `deleteTrip` sont partiellement légitimes : RLS `trips_own` autorise
déjà le propriétaire du déplacement. Le problème est que l'admin client retire aussi la borne
« son propre déplacement ».

**Correctif.** `assertManager()` (`lib/auth/roles.ts`) existe déjà et est utilisé dans 4
fichiers. Le poser en tête des 22 actions est un correctif mécanique et à faible risque —
mais il change le comportement pour les employés : à arbitrer action par action.

---

### R3 — `/api/search` : clé service-role, aucun filtrage, interpolation directe — **S1**

**Constat.** `app/api/search/route.ts` utilise `createAdminClient()` et interpole le
paramètre `q` directement dans un filtre PostgREST :

```ts
.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
```

**Deux problèmes distincts.**

1. **Périmètre.** La route est authentifiée par le proxy, mais **aucun contrôle de rôle** :
   un `prestataire` peut énumérer l'intégralité des clients (nom, téléphone, e-mail), des
   véhicules et des réservations. La clé service-role neutralise la politique
   `clients_managers` qui réserve normalement ces données aux managers.
2. **Injection de filtre.** `q` n'est ni échappé ni validé. La syntaxe `.or()` de PostgREST
   se découpe sur la virgule et la parenthèse : une valeur de `q` contenant `,` ou `)` sort
   du motif `ilike` et injecte des conditions arbitraires dans le filtre. Ce n'est pas de
   l'injection SQL classique, mais l'effet — lire des lignes non prévues — est du même
   ordre. **À démontrer par un test** avant de conclure sur la gravité réelle.

**Correctif.** Passer à la clé anon (RLS s'applique alors naturellement) ou ajouter
`assertManager`. Et échapper `q` — a minima retirer `,` `)` `(` `%` `*` `\` et borner la
longueur.

---

### R4 — Aucune transaction dans toute l'application — **S2**

**Constat.** Zéro `.rpc()` dans le code applicatif, donc aucune fonction SQL encapsulant une
écriture multi-tables ; le client Supabase JS n'offre pas de transaction côté client. Toutes
les écritures multi-tables sont donc des **séquences d'appels indépendants**, sans atomicité
ni rollback.

**Séquences les plus exposées :**

| Séquence | Fichier | Ce qui casse en cas d'échec intermédiaire |
|---|---|---|
| Créer une réservation | `lib/actions/reservations.ts` | `reservations` créée, `financial_transactions` manquante → chiffre d'affaires faux |
| Clôturer une location | `lib/actions/reservations.ts` | statut véhicule mis à jour, transactions non écrites |
| Supprimer un partenariat | `lib/actions/partnerships.ts:112` | contrats supprimés, `inspections` orphelines (boucle §4.3) |
| Supprimer un client | `lib/actions/delete.ts` | suppressions en cascade partielles sur 13 tables |
| Générer une facture | `lib/actions/invoices.ts` | `invoices` créée, `financial_due_dates` absentes |
| Terminer un déplacement | `lib/actions/internal-trips.ts` | déplacement clos, charges non enregistrées |

**Précédent documenté.** La migration `028_fix_vehicle_status_drift.sql` existe précisément
pour rattraper des statuts véhicule désynchronisés — la conséquence exacte de ce défaut.

**Correctif.** Lourd (fonctions SQL `SECURITY DEFINER` par séquence critique) et hors
périmètre d'une campagne de 9 jours. **Mesure réaliste** : écrire les tests P2 de façon à
**détecter** les états incohérents (une réservation sans sa transaction, un contrat sans son
EDL), et traiter les cas qui se manifestent réellement en production.

---

### R5 — Un associé ne voit pas l'équipe — **S2**

**Constat.** `app/(dashboard)/equipe/page.tsx` autorise gérant **et** associé (ligne 13),
puis lit la liste des membres avec le **client anon** (ligne 18). Or la politique
`profiles_own_read` est :

```sql
USING (id = auth.uid() OR get_user_role() = 'gerant')
```

Un associé ne peut donc lire **que son propre profil**. La page s'ouvre et affiche une liste
d'un seul membre — lui-même.

**Reproduction.** Se connecter en associé, ouvrir `/equipe`.

**Correctif.** Soit étendre la politique à `IN ('gerant','associe')`, soit lire via la clé
service-role après contrôle de rôle. **Décision produit** : un associé doit-il voir
l'équipe ? Le garde de page dit oui, RLS dit non — les deux se contredisent, il faut
trancher avant de coder.

Même schéma à vérifier partout où une page autorise l'associé et lit `profiles` en anon.

---

### R6 — Dérive de schéma : `apns_tokens` n'existe dans aucune migration — **S2**

**Constat.** `app/api/push/apns/register/route.ts` fait un `upsert` sur `apns_tokens` et
`lib/push/sendApns.ts` un `delete`. Recherche sur tout `supabase/` : **zéro occurrence**.

**Deux possibilités, à trancher avant P1 :**
- la table a été créée à la main dans la console → le **seed de test ne la créera pas** et
  toute base reconstruite depuis les migrations sera incomplète ;
- la table n'existe pas → les notifications push iOS sont **silencieusement cassées** en
  production, chaque appel renvoyant une erreur ignorée.

**À faire.** Vérifier la présence de la table dans la console Supabase, puis soit écrire la
migration de rattrapage, soit retirer le code. C'est un **prérequis de P1 étape 2**.

---

### R7 — `get_user_role()` évaluée par ligne dans 28 politiques — **S3**

**Constat.** La fonction est `STABLE`, mais **appelée directement** dans les politiques :

```sql
USING (get_user_role() IN ('gerant','associe'))
```

Écrite ainsi, PostgreSQL peut la réévaluer **pour chaque ligne examinée** — un `SELECT` sur
`financial_transactions` déclenche potentiellement autant de lectures de `profiles` qu'il y
a de lignes.

**Correctif standard Supabase** : envelopper dans un sous-`SELECT` pour forcer la mise en
cache en `InitPlan` :

```sql
USING ((SELECT get_user_role()) IN ('gerant','associe'))
```

Gain typique : d'un facteur 2 à un facteur 100 sur les grandes tables. **À mesurer, pas à
présumer** — c'est exactement le travail de P5 étape 2, et les tables les plus concernées
sont `financial_transactions`, `calendar_events` et `reservations`.

Point connexe : aucune politique ne dispose d'index de support explicite sur les colonnes
qu'elle filtre (`assigned_to`, `user_id`, `performed_by`, `taken_by`). L'audit d'index de
**P1 étape 6** doit les couvrir.

---

### R8 — Aucune validation d'entrée structurée — **S3**

**Constat.** Aucune bibliothèque de validation (zod, yup, valibot) dans les 46 dépendances.
Les server actions lisent `formData.get('x') as string` et se contentent au mieux d'un
`if (!x) return { error: … }`.

**Conséquences observables, à couvrir en P2 étape 3 :**
- montants et kilométrages : pas de borne, pas de contrôle de signe → un kilométrage de
  retour inférieur au départ, ou un montant négatif, passent ;
- dates : pas de contrôle d'ordre systématique (`planTrip` le fait depuis le 25/07, les
  autres non) ;
- chaînes : aucune limite de longueur avant insertion ;
- types : `as string` est un mensonge au compilateur, `null` traverse et arrive en base.

Les 233 `any` d'ESLint (§5.3) sont la même cause vue depuis la compilation.

---

### R9 — Le proxy est fail-open sur les permissions d'onglet — **S3**

**Constat.** `proxy.ts`, ligne 76 environ, commentaire d'origine : toute erreur de lecture du
profil laisse passer la requête. C'est un choix assumé (éviter de verrouiller l'app si la
colonne `allowed_tabs` manque), mais cela signifie qu'une **indisponibilité momentanée de la
base ouvre tous les onglets à tous les rôles**.

Atténuation réelle : les pages sensibles portent leur propre garde (layouts compta et
partenariats). Le risque est donc surtout sur les pages **sans garde propre**.

**À tester en P2** : simuler l'échec de la lecture de profil et vérifier qu'aucune page
sensible ne s'ouvre.

---

### R10 — Écriture en base déclenchée par un affichage — **S3**

**Constat.** `app/(dashboard)/vehicles/page.tsx:150` : le rendu de la liste des véhicules
persiste les statuts recalculés, une requête `UPDATE` par véhicule concerné.

**Conséquences.** Un simple rafraîchissement peut écrire ; deux onglets ouverts peuvent
écrire en concurrence ; et une page en lecture devient non idempotente. En test, cela rend
le seed **non reproductible** dès qu'on ouvre `/vehicles` — point d'attention direct pour
P1 étape 2 et P2.

---

### R11 — Deux écritures directes depuis le navigateur — **S4**

`NotificationsList.tsx` (`notifications`·update) et `KpiEditor.tsx` (`campaigns`·update).
RLS borne les lignes atteignables mais pas les valeurs écrites. `NotificationsList.tsx` est
par ailleurs **orphelin** (§5.1) : la première question est de savoir s'il doit exister.

---

### R12 — 1 825 lignes de code mort, dont une server action exposée — **S4**

Détail en §5.1. Le point saillant : `lib/actions/availability.ts` n'est monté par aucune UI
mais reste **appelable par HTTP** (`setWeeklyAvailability`), et écrit dans
`availability_slots`. Surface d'attaque sans contrepartie fonctionnelle.

Second point : **deux définitions concurrentes de `VEHICLE_ZONES`** (`inspection-types.ts` et
`zones.ts`) coexistent avec le fichier réellement actif `edl-zones.ts`. À nettoyer **avant**
J5, faute de quoi la recalibration risque de porter sur le mauvais fichier.

---

### Synthèse

| Réf | Sujet | Gravité | Effort | À traiter |
|---|---|:-:|:-:|---|
| R1 | `documents` sans RLS | **S1** | faible | avant tout le reste |
| R2 | 22 actions service-role sans garde | **S1** | moyen | J1-J2 |
| R3 | `/api/search` ouverte + injection de filtre | **S1** | faible | J1 |
| R4 | Aucune transaction | S2 | élevé | détecter en P2, corriger au cas par cas |
| R5 | Associé ne voit pas l'équipe | S2 | faible | décision produit d'abord |
| R6 | `apns_tokens` hors migrations | S2 | faible | **prérequis P1** |
| R7 | `get_user_role()` par ligne | S3 | faible | P5, après mesure |
| R8 | Aucune validation d'entrée | S3 | élevé | couvrir en P2 étape 3 |
| R9 | Proxy fail-open | S3 | faible | test dédié |
| R10 | Écriture au rendu de `/vehicles` | S3 | moyen | **prérequis P1** (seed non reproductible) |
| R11 | Écritures navigateur directes | S4 | faible | avec la refonte |
| R12 | Code mort + `VEHICLE_ZONES` en double | S4 | faible | avant J5 |

**Trois S1, tous dans le même angle mort : le contrôle d'autorisation quand la clé
service-role est en jeu.** R1, R2 et R3 se testent avec le même harnais — un compte
`prestataire` qui tente ce qu'il ne devrait pas pouvoir faire. C'est le premier scénario à
écrire en P1 étape 3, et il remplace avantageusement le test d'isolation tenant de P2
étape 5, sans objet ici (§0.1).

---

## 8. Ce que ce document change dans le plan des 9 jours

| Étape du plan | Modification |
|---|---|
| **P1 étape 2** (seed) | Retirer les « 2 tenants ». Ajouter : résoudre `apns_tokens` (R6) et neutraliser l'écriture au rendu de `/vehicles` (R10), sans quoi le seed n'est pas reproductible. |
| **P1 étape 3** (Playwright) | Organiser `tests/` selon les 23 modules du §6. Premier scénario par rôle : le harnais d'habilitation `prestataire` de §7. |
| **P1 étape 6** (audit base) | Ajouter les index de support des colonnes filtrées par RLS (`assigned_to`, `user_id`, `performed_by`, `taken_by`) et la réécriture `(SELECT get_user_role())`. |
| **P2 étape 5** | Remplacer « isolation tenant » par « isolation par rôle ». |
| **P4** | Livrable 1 réduit à l'ajout de la détection de recouvrement dans `scripts/edl-editor/template.html`. Livrable 2 : balayage du repère unique 1254 × 1254, 40 zones. Nettoyer d'abord les `VEHICLE_ZONES` concurrents. |
| **P5** | Cibles prioritaires déjà identifiées : `get_user_role()` par ligne (R7), les 4 N+1 d'écran de §4.1, les 9 boucles de `api/notifications`. |
| **P6 étape 3** | Idem P2 étape 5. |

---

## 9. Méthode et limites

**Établi par** : lecture de `supabase/migrations/*.sql` (62 fichiers), inventaire des fichiers
de `app/`, `components/`, `lib/`, `hooks/`, `types/`, exécution d'ESLint, et quatre scripts
d'analyse statique écrits pour l'occasion (routes, écritures, N+1, fichiers orphelins).

**Limites assumées :**

- **Les politiques RLS viennent du dépôt, pas du serveur.** Toute modification appliquée à
  la main dans la console Supabase est invisible ici. À croiser avec un
  `SELECT * FROM pg_policies` lors de P1 étape 6.
- **Les `GRANT` de table ne sont pas audités.** La gravité de R1 dépend d'eux.
- **La détection des N+1 est syntaxique.** Une requête dans une fonction appelée depuis une
  boucle n'est pas détectée. Le chiffre de 18 est un plancher.
- **Les fichiers orphelins sont détectés par import de chemin.** Un chargement dynamique par
  chaîne construite échapperait à la détection ; aucun n'a été observé.
- **La grille S1-S4 est ma lecture**, pas celle du plan de campagne (§7).
- **Aucune base de production n'a été interrogée**, conformément à la consigne.
