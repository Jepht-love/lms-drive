# RÉSUMÉ DE MIGRATION — LMS DRIVE

> Bloc de relance à coller au début d'une nouvelle session (terminal CLI).
> Démarrer avec : `cd /Users/j.akpadji/lms-drive && claude`, puis coller ce contenu
> et ajouter : « Reprise session LMS Drive, contexte ci-dessus, confirme en 2 lignes
> puis attends mes instructions. »
>
> _Dernière mise à jour : 29/06/2026._

---

Projet : LMS Drive, application de location de véhicules. Stack « NOT the Next.js you know »
(lire `node_modules/next/dist/docs/` avant de coder) + Supabase (projet vtxoqybfqdauhblavvza),
en ligne sur https://lms-drive.vercel.app. Éditeur = SAS Financial Services (SASU de Jepht),
pivot revente SaaS en cours. Repo : github.com/Jepht-love/lms-drive. Dossier local :
/Users/j.akpadji/lms-drive. La mémoire projet (MEMORY.md + fichiers liés, dont
gerant-feedback-batch-jun29.md = détail file-par-file) se charge automatiquement.

## 1. OBJECTIF GLOBAL
Exécuter le lot de 18 modifications du gérant du 29/06/2026 (lots A→E), tout vérifier en
preview, puis déployer sur Vercel (déploiement autorisé par le gérant). Validation lot par lot,
le gérant teste l'ensemble après.

## 2. DÉCISIONS PRISES (rappel des cadrages clés)
Carburant → km (pas de %). Emails → consultation seule. Pièces clients → rattachées AU CLIENT.
Demi-calendrier dashboard → fenêtre glissante 6h équipes/salariés. Sinistres comptés NET agence
à la clôture (réparation − assurance − caution). Document entretien/sinistre créé seulement si
justificatif joint. Taxonomie compta 18 familles / 80 postes sans migration (ids legacy conservés).
Suppression équipe = DOUCE (is_active=false). Règle absolue : JAMAIS de mutation Supabase
automatisée — toujours fournir le SQL, exécution manuelle par le gérant.

## 3. TRAVAUX RÉALISÉS — LES 18 DEMANDES SONT TOUTES TRAITÉES
Lots A/B/C/D faits lors des sessions précédentes (#1 retours en retard, #2-7 refonte compta +
analyse + KPI + export Excel, #8 journal d'audit FR, #9-12 EDL/docs/carbur→km, #14 RESAS→
Réservations). Cette session = fin du Lot E :
- **#15** ✅ demi-calendrier : section « Prochaines 6h » dans `app/(dashboard)/page.tsx` (fenêtre
  glissante now→now+6h, pistes par ressource salarié/équipe + piste « À assigner », repères
  horaires, trait rouge « maintenant », chips colorés par event_type, scroll horizontal ;
  helpers CAL_EVENT_COLORS / NEXT6H_HOUR_W=88 / initials ; query weekCalendarTasks enrichie
  event_type, end_at, team.color). Vérifié preview (vide + peuplé via mock retiré).
- **#16** ✅ gérer/supprimer équipes : `app/api/calendar/teams/route.ts` + PATCH (renommer/recolorer)
  + DELETE (douce, ?id=), gardés gérant/associé via helper requireManager. UI icônes Pencil+Trash2
  sur lignes type='team' (gérant only) dans `components/calendar/ResourceList.tsx`, props passées via
  `CalendarPage.tsx` → `CalendarSidebar.tsx`. ⚠️ vit dans la sidebar `hidden md:flex` = tablette/desktop.
- **#17** ✅ emails consultation (sessions précédentes, `emails/EmailsList.tsx`).
- **#18** ✅ `supabase/scripts/delete_ford_fiesta.sql` (cascade par plaque, STEP 1 contrôle + STEP 2
  transaction). EXÉCUTÉ avec succès par le gérant le 29/06 (contrôle final 0 partout, COMMIT).
  Correctif appliqué : `arrival_inspection_id` est sur la table `incidents`, PAS `reservations`.

État technique : typecheck 0, BUILD PROD OK, graphify à jour, mémoire à jour.

## 4. TRAVAUX EN COURS / NON TERMINÉS
Code : RIEN à coder, les 18 sont faites. Reste opérationnel : (a) le gérant teste #15 et #16 en
preview ; (b) déploiement Vercel pas encore lancé (gérant a choisi « tester d'abord ») ;
(c) secrets Vercel pas encore posés.

## 5. FICHIERS ET RÉFÉRENCES
Modifiés cette session : `app/(dashboard)/page.tsx`, `app/api/calendar/teams/route.ts`,
`components/calendar/CalendarPage.tsx`, `components/calendar/CalendarSidebar.tsx`,
`components/calendar/ResourceList.tsx`. Créé : `supabase/scripts/delete_ford_fiesta.sql`.
Preview : `npm run dev -- --port 3100` puis http://localhost:3100.

## 6. CONTRAINTES ET PRÉFÉRENCES
JAMAIS de mutation Supabase automatisée (fournir le SQL, le gérant l'exécute). « NOT the
Next.js you know » : export 'use server' doit être async ; tsc à 0 ne suffit pas → toujours
vérifier le rendu réel en preview ET le build (`npm run build`). Gérant exigeant sur le visuel,
impatient : viser propre et précis du premier coup. Après modif code : `graphify update .`

## 7. PROCHAINES ÉTAPES (ordre de reprise)
1. Attendre le retour de test du gérant sur #15/#16.
2. Au feu vert : commit + push sur une branche pour déclencher Vercel.
3. Rappeler au gérant de poser `SUPABASE_SERVICE_ROLE_KEY` et `RESEND_API_KEY` sur Vercel
   (valeurs dans `.env.local`) AVANT de compter sur la prod.

## 8. POINTS DE VIGILANCE
Déployer NE règle PAS #13 : tant que les 2 secrets Vercel ne sont pas posés,
interventions/réservations/alertes/calendrier/PDF restent cassés en prod (`createAdminClient()`
plante sans SERVICE_ROLE_KEY ; Resend Missing API key). Je ne peux pas saisir les secrets.
Sinistres : ne plus utiliser l'ancien bouton « ajouter au véhicule comme entretien » en
parallèle du booking net-à-clôture (double compte). #16 invisible sur mobile <768px (sidebar
masquée), comme la création d'équipe — normal. KPI immobilisation = estimation.
