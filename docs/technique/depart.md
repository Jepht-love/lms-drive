# Onglet Départ

Livré le 08/08/2026.

## Ce que fait l'onglet

Raccourci pour démarrer une location immédiate : choisir un véhicule et un client, avec la date de début préremplie à maintenant. Après création de la réservation, le flux enchaîne directement sur l'état des lieux de départ, sans passer par la fiche réservation.

L'onglet Réservations (/reservations) reste pour les locations futures.

## Fichiers

| Fichier | Rôle |
|---|---|
| `app/(dashboard)/depart/page.tsx` | Page serveur, charge les données, préremplie à maintenant |
| `lib/navigation/tabs.ts` | Clé `depart` ajoutée (href `/depart`) |
| `components/layout/MenuButton.tsx` | Entrée Départ, icône Timer, entre Réservations et Calendrier |
| `app/(dashboard)/menu/page.tsx` | Entrée Départ dans la liste des modules |
| `lib/actions/reservations.ts` | Lecture de `depart_flow=1` pour rediriger vers l'EDL (ligne ~577) |

## Ce qu'il réutilise

- `ReservationForm` : le formulaire de réservation, sans aucune modification. La date de début lui est passée via `defaultStartDatetime`.
- `createReservation` : l'action de création, avec tous ses contrôles (blacklist, conflits, garage, déplacement interne).

## Comment fonctionne le flux

La page `/depart` définit une action wrapper `createDepartureReservation` (Server Action locale) qui pose `depart_flow=1` dans le FormData avant d'appeler `createReservation`. Dans `createReservation`, si ce champ vaut `1`, le redirect final part vers `/inspections/departure/[id]` au lieu de `/reservations/[id]`.

Le parcours normal (créer depuis /reservations/new) n'est pas touché : il ne pose jamais `depart_flow`.

## Ce qui n'a pas changé

- Tous les contrôles de disponibilité restent actifs : un départ immédiat sur un véhicule occupé est refusé.
- Le garde-fou serveur tient : le statut "en cours" n'est posé qu'à la validation de l'état des lieux (pas à l'ouverture de l'écran EDL, et pas à la création de la réservation).
- L'onglet Réservations est intact.

## Pièges

- `depart_flow` est lu dans `createReservation` ligne ~577. Si la logique de redirection de cette fonction évolue, vérifier que le cas `depart_flow=1` reste cohérent.
- La date de début est calculée côté serveur (SSR) à chaque chargement de la page. Si la page reste ouverte longtemps avant soumission, l'heure affichée peut être décalée de l'heure réelle. Ce n'est pas un bug : l'agent corrige l'heure avant de valider, comme pour n'importe quel formulaire de réservation.
