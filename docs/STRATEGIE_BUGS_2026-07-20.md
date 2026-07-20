# Stratégie correctifs LMS Drive — 2026-07-20

> Rédigée avec Fable (analyse), exécution prévue avec Opus.
> Ordre d'attaque validé : **BUG 1 → BUG 2 → BUG 3 → BUG 4 → BUG 5**, puis refonte shadcn/ui page par page (agents dédiés, cf. `ARCHITECTURE_PLAN.md`).

---

## BUG 1 — Résa confirmée (acompte) affichée « en location » avant le départ

**Symptôme.** Résa 208, départ 15h : à midi le véhicule est « loué » et la résa
n'apparaît pas dans « Tâches du jour → départ à préparer ».

**État du code (vérifié).**
- `lib/vehicles/vehicleStatus.ts:25-27` est correct : `en_cours`/`en_retard` → `loue`,
  `confirmee`/`option` → `reserve`. Donc si le véhicule est « loué », c'est que la
  **résa elle-même est passée `en_cours` trop tôt** — pas un bug d'affichage.
- `lib/actions/reservations.ts:455` `markReservationDeparted()` = le seul passage
  « métier » vers `en_cours`… mais **aucun appelant dans le code**.
- `lib/actions/reservations.ts:474` `updateReservationStatus(id, status)` accepte
  n'importe quel statut sans garde-fou → chemin probable de la corruption
  (sélecteur de statut manuel, ou reliquat du bug EDL corrigé hier — commit
  `dfc7657` « ne plus passer en cours à l'ouverture de l'EDL départ »).
- Dashboard `app/(dashboard)/page.tsx:175-302` : la liste « En location » filtrée
  hier (commit `5066265`) est cohérente. Une résa `en_cours` sort des tâches du
  jour et entre dans « En location » — comportement attendu si le statut est bon.

**Plan de correction.**
1. **Diagnostic données** : requête Supabase sur la résa 208 (statut actuel,
   `updated_at`) + lister toutes les résas `en_cours` dont l'heure de départ est
   future ou sans EDL départ validé → mesure de l'ampleur.
2. **Garde-fou serveur** dans `updateReservationStatus()` : interdire
   `confirmee/option → en_cours` si aucun EDL départ validé pour cette résa
   (l'unique porte d'entrée devient la validation de l'EDL départ). Auditer tous
   les appelants de `updateReservationStatus` et brancher le flux EDL départ sur
   `markReservationDeparted()` (aujourd'hui orphelin).
3. **Script de réparation** : repasser en `confirmee` les résas `en_cours` sans
   EDL départ validé + `recomputeVehicleStatus()` sur chaque véhicule touché.
4. **Test de non-régression** : résa confirmée départ J 15h → à 12h : véhicule
   `reserve`, présente dans « Tâches du jour », absente d'« En location » ;
   après validation EDL départ → `en_cours`, véhicule `loue`, bascule dans
   « En location ».

**Fichiers** : `lib/actions/reservations.ts`, `lib/vehicles/vehicleStatus.ts`
(lecture seule), `app/(dashboard)/page.tsx` (vérif), flux EDL
(`components/inspection/InspectionFlow.tsx`, `app/(dashboard)/inspections/…`).

---

## BUG 2 — Notifications « 2h avant » chaque tâche du jour

**Demande.** Dès qu'une tâche/résa est dans « Tâches du jour » (départ, retour,
EDL, RDV…), recevoir une push **2h avant l'heure prévue** sur l'appareil, motif
personnalisé, pour distinguer « vraiment parti » de « va partir ».

**Contrainte structurante (vérifiée).** `vercel.json` : les crons tournent
**1×/jour à 6h**. Le « rappel 1h avant » commité (`cb81ed5`) ne peut donc
physiquement pas partir à l'heure. Un rappel T-2h exige une exécution toutes les
10-15 min.

**Décision TRANCHÉE par le gérant (2026-07-20)** : plan **Vercel Hobby** (« vercel
normal ») — le système de notifications passe déjà **par cron connecté à une
API**. → Retenir l'approche **cron externe → endpoint API** : un scheduler
(Supabase pg_cron ou service type cron-job.org, au choix à l'implémentation)
appelle `/api/cron/reminders` toutes les 10 min avec un secret (`CRON_SECRET`),
en réutilisant le branchement API existant. Pas d'upgrade Vercel Pro.

**IMPLÉMENTÉ (2026-07-20) — approche simplifiée.** Découverte à l'exécution : il
existe DÉJÀ un cron `/api/notifications` (GET, `Authorization: Bearer CRON_SECRET`)
appelé **toutes les heures par le crontab externe** du gérant — c'est exactement
« le cron connecté à une API ». Il gérait déjà départs (T-1h), tâches/RDV (T-1h),
retours, retards, digest, avec **déduplication via la table `notifications`**.
→ Inutile de créer un nouvel endpoint, une nouvelle table `notification_log` ni un
scheduler `*/10`. Il a suffi d'**élargir le préavis à 2 h**.

Changements faits dans `app/api/notifications/route.ts` :
1. Constante `REMINDER_LEAD_HOURS = 2` (préavis unique et ajustable).
2. Départs confirmés : fenêtre `[now, now+2h]` (au lieu de 1 h), une push unique
   par résa (dédup permanente `departure_soon`). Libellé « Départ à préparer ».
3. Tâches `tasks` + événements calendrier (RDV, livraison, récupération…) :
   fenêtre `[now, now+2h]` (au lieu de 1 h), dédup permanente `task_soon`.
4. Push immédiate à la création d'une résa : déjà en place dans
   `createReservation` (`broadcastPushToManagers` « Nouvelle réservation »).

**Action gérant** : s'assurer que le crontab externe frappe `/api/notifications`
**au moins toutes les heures** (idéalement toutes les 30 min pour un préavis 2 h
plus précis — l'endpoint est idempotent grâce à la dédup).

**Fichiers touchés** : `app/api/notifications/route.ts` (uniquement).

---

## BUG 3 — Barre du bas invisible sur « Disponibilités » (mobile/tablette)

**Symptôme.** Sur `/calendrier/disponibilites`, la BottomNav devient
blanche/transparente — on ne voit plus Accueil/Véhicules/…/Menu.

**État du code (vérifié).** `components/layout/BottomNav.tsx:26` a un fond opaque
`bg-[#111111]` mais **aucun z-index**, et `ContentWrapper.tsx` retire tout padding
sur `/calendrier/*`. Cause probable : `AvailabilityClient.tsx` pose un conteneur
plein écran (fond blanc / `fixed` / `overflow`) qui recouvre la nav, ou un
stacking context la fait passer dessous.

**Plan.** Reproduire sur viewport mobile → inspecter `AvailabilityClient.tsx` ;
corriger le conteneur fautif + blinder la nav (`relative z-20` sur le `<nav>`)
pour que le problème ne revienne sur aucune page. Vérifier les autres routes
`/calendrier/*`.

**Fichiers** : `app/(dashboard)/calendrier/disponibilites/AvailabilityClient.tsx`,
`components/layout/BottomNav.tsx`, `app/(dashboard)/layout.tsx`.

---

## BUG 4 — Header « LMS Drive + date » doit rester fixe au scroll

**Symptôme.** Sur certaines pages (ex. Menu), le header noir défile avec le
contenu, alors que le sous-header de la page (ex. « Tout l'assistant ») reste fixe.

**État du code (vérifié).** `PageHeader.tsx` est `shrink-0` + `z-10` : il est fixe
**si** le layout fait défiler uniquement le contenu (`flex flex-col h-dvh` +
`main overflow-y-auto`). S'il défile, c'est que le scroll est porté par le body
sur ces pages.

**Plan.** Auditer `app/(dashboard)/layout.tsx` : verrouiller le pattern
« header fixe / `<main>` seul scrollable » globalement (`h-dvh flex flex-col` +
`overflow-y-auto` sur le main, `overscroll-contain`), retirer les scrolls
parasites page par page (Menu en premier). Tester sur iOS (safe-area, rebond).

**Fichiers** : `app/(dashboard)/layout.tsx`, `components/layout/PageHeader.tsx`,
`app/(dashboard)/menu/*`.

---

## BUG 5 — EDL : nouveaux plans (6 vues) avec découpage par pièce plus précis

**Cadrage validé par le gérant.** PAS de granularité type maillage 3D
(schéma à points rejeté). On garde **l'interaction actuelle** — cliquer une pièce
pour la sélectionner et déclarer un dommage — mais sur les **6 plans du nouveau
blueprint** (dessus, avant, arrière, profil G, profil D + éclaté par panneau),
avec un détourage **plus précis** de chaque pièce.

**État du code (vérifié).** Système actuel : 1 image `public/edl/vehicle-blueprint-v3.png`
(1254×1254) + ~40 zones polygonales tracées à la main dans
`components/vehicle-schema/edl-zones.ts`, rendues par `VehicleOrthographicSVG.tsx`,
flux dans `InspectionFlow.tsx` (1009 lignes). Les dommages sont stockés par `id`
de zone → **les ids doivent rester stables** pour ne pas casser l'historique EDL
ni la comparaison départ/retour (`DamageComparison.tsx`) ni le PDF contrat.

**Plan.**
1. **Asset** : préparer le nouveau blueprint (fourni par le gérant, images du
   2026-07-20) en fond propre — soit 1 planche unique comme aujourd'hui, soit
   1 fichier par vue ; viser du **SVG vectorisé par pièce** (chaque pièce = un
   `<path>` avec `id`) plutôt que des polygones approximés sur PNG → précision
   maximale au clic et au rendu, zoom sans perte.
2. **Table de correspondance** ancien id → nouvel id (mêmes ids conservés
   partout où la pièce existe déjà : `capot`, `porte-avant-gauche`, …), nouveaux
   ids uniquement pour les pièces plus fines ajoutées (poignées, montants,
   seuils, antibrouillards… selon le blueprint).
3. **Rendu** : adapter `VehicleOrthographicSVG.tsx` (ou nouveau composant) —
   même API (`onSelect(zoneId)`, surbrillance, pastilles de dommages) pour que
   `InspectionFlow`, `DamageDrawer`, `DamageComparison` et le PDF contrat
   fonctionnent sans réécriture.
4. **Mode debug** : overlay affichant toutes les zones + ids pour valider le
   détourage avec le gérant avant mise en prod.
5. **Migration/compat** : les EDL existants doivent continuer à s'afficher
   (fallback ancien fond pour les inspections antérieures à la bascule, ou
   mapping complet des ids).

**Fichiers** : `components/vehicle-schema/edl-zones.ts` (v2),
`VehicleOrthographicSVG.tsx`, `public/edl/` (nouveaux assets),
`inspection-types.ts`, vérifs sur `InspectionFlow.tsx`, `DamageComparison.tsx`,
`lib/pdf/build-contract-data.ts`.

---

## BUG 6 — Zone de saisie non fixée en bas quand le clavier s'ouvre (mobile)

**Symptôme (signalé 2026-07-20).** « Le texte remonte, le clavier pour écrire
n'est pas fixé en bas d'écran » : sur mobile, quand le clavier virtuel s'ouvre,
le champ de saisie ne reste pas ancré au-dessus du clavier — le contenu remonte
et la zone d'écriture se retrouve mal positionnée.

**⚠️ À préciser avant correction : quel(s) écran(s) exactement ?** (formulaire
réservation, commentaire EDL, recherche, chat/assistant…). Le correctif dépend
de l'écran.

**Pistes techniques (app Capacitor iOS + PWA).**
- iOS/Capacitor : configurer le plugin `@capacitor/keyboard`
  (`resize: 'native'|'body'`, `scrollAssist`) dans `capacitor.config.ts`.
- Web/PWA : utiliser `interactive-widget=resizes-content` (meta viewport) et/ou
  `env(keyboard-inset-height)` / VisualViewport API pour épingler le champ ;
  vérifier les conteneurs `position: fixed` qui cassent avec le clavier iOS.
- Lié au BUG 4 (pattern de scroll global) : traiter après lui.

**Fichiers probables** : `capacitor.config.ts`, `app/(dashboard)/layout.tsx`,
`app/layout.tsx` (meta viewport), écrans concernés à identifier.

---

## Orchestration de l'exécution (Opus)

1. **Séquentiel bugs 1 → 2** (même domaine métier : statuts + notifs, risque de
   conflit si parallélisés). Commit par bug, message conventionnel, bump SW si
   assets/PWA touchés (v85 → v86…).
2. **Bugs 3 & 4 parallélisables** (UI layout, fichiers disjoints des bugs 1-2).
3. **Bug 5 en dernier** : dépend d'une validation visuelle du gérant sur le
   détourage (mode debug), plus long.
4. Après chaque correctif : `graphify update .` + test manuel ciblé.
5. **Ensuite seulement** : refonte shadcn/ui page par page selon
   `ARCHITECTURE_PLAN.md`, un agent par page avec contexte dédié (plan des
   tokens + inventaire composants déjà rédigés).

## Points ouverts (à trancher avant/pendant exécution)
- ~~**BUG 2** : plan Vercel actuel ?~~ **Tranché** : Vercel Hobby, cron externe
  → API (voir BUG 2).
- **BUG 5** : les 2 images fournies sont des références visuelles — confirmer
  quelle planche sert de fond définitif (celle à 6 vues + éclaté).
- **BUG 6** : identifier le ou les écrans où la saisie décroche du clavier.
- Délai de rappel : 2h fixe ou réglable par type de tâche ?
