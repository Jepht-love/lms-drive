# Rendre les frais de restitution modifiables

Plan à valider avant écriture. Cadré avec Jeff le 03/08/2026.

## Ce qui est tranché

| Sujet | Décision |
|---|---|
| Rattachement | La **catégorie du véhicule**. Deux listes : `sportif` et tout le reste |
| Catégories | « sportif » entre dans le formulaire du véhicule (il déclenchait les tarifs sportifs sans y figurer) |
| Postes | Ajouter, retirer, renommer, réordonner |
| Saisie | **Montant** (€, optionnel) + **Précision** (texte, optionnel). Au moins l'un des deux |
| Suppression d'un poste lié à un constat de dommage | Possible, avec avertissement écrit |
| Corbeille | Bloc « Postes retirés » repliable en bas de chaque liste, bouton pour remettre. Pas de suppression définitive |
| Facture de restitution | Reprend le montant du poste quand il y en a un ; ligne vide sinon |
| Articles juridiques du contrat | **Restent dans le code**, jamais modifiables depuis l'application |
| Livraison | En une fois |

## Ce qui était déjà tranché et ne se rediscute pas

- **Un contrat signé ne change jamais.** C'est l'archivage du PDF à la signature qui fige les
  montants. Changer un frais aujourd'hui n'a aucun effet sur un contrat de juillet.
- **Les franchises et le tarif de retard viennent de la grille tarifaire du véhicule**, décidé
  le 03/08/2026 au matin. Ils ne se saisissent donc **pas** dans cette liste : les cinq postes
  concernés (franchise responsabilité civile, dommage, vol, incendie, retard de restitution)
  s'affichent en lecture avec la mention « vient de la grille tarifaire ». Sans cette règle, le
  gérant écrirait 15 000 € ici pendant que la grille de la Smart Fortwo dit 6 000 €, et le
  contrat imprimerait deux chiffres contradictoires.

## La structure

Une table `restitution_fees` :

| Colonne | Rôle |
|---|---|
| `scope` | `sportif` ou `standard` |
| `position` | l'ordre d'impression au contrat |
| `label` | le nom du poste |
| `amount` | le montant, vide quand c'est « sur devis » |
| `note` | la précision imprimée après le montant |
| `damage_key` | la clé qui relie au constat de dommage (`rayure_legere`, `vitrage_casse`…) |
| `source` | `franchise` ou `retard` pour les postes pilotés par la grille |
| `deleted_at` | la corbeille |

**La migration crée la table vide.** Les 27 postes actuels restent écrits dans
`lib/contracts/legal-articles.ts` et servent de modèle de départ : tant qu'une catégorie n'a
rien en base, le contrat imprime exactement ce qu'il imprime aujourd'hui. Un bouton
« Reprendre le contrat type » remplit la liste quand le gérant veut commencer à la modifier.

C'est ce qui respecte la règle du socle : **aucune valeur d'un client ne part dans une
migration**, et un nouveau client hérite du même modèle sans qu'on touche à une ligne de code.

## Les fichiers

| Fichier | Ce qui change |
|---|---|
| `supabase/migrations/077_frais_restitution.sql` | la table et ses règles d'accès |
| `lib/contracts/frais-restitution.ts` | **nouveau** : lit la base, retombe sur le contrat type |
| `lib/actions/restitution-fees.ts` | **nouveau** : créer, modifier, retirer, remettre, réordonner |
| `lib/contracts/legal-articles.ts` | `getFeesTable` accepte les lignes venues de la base |
| `app/(dashboard)/settings/tarifs/FraisRestitution.tsx` | passe de la lecture à l'édition |
| `app/(dashboard)/vehicles/VehicleForm.tsx` | « sportif » entre dans la liste des catégories |
| `components/vehicle-schema/inspection-types.ts` | `tarifDommage` prend les montants en paramètre |
| `components/inspection/InspectionFlow.tsx` | reçoit les tarifs depuis le serveur |
| Les trois écrans qui impriment le contrat | reçoivent les lignes résolues |

## Ce qu'il ne faut pas casser

- **Aucun montant ne change le jour de la livraison.** Base vide = contrat identique.
- `tarifDommage` tourne dans le navigateur (état des lieux) : les tarifs doivent lui arriver
  en paramètre depuis la page serveur, jamais par une lecture en base côté client.
- Les trois affichages du contrat (PDF, aperçu écran, récapitulatif de signature) doivent
  recevoir les **mêmes** lignes. Un client ne doit jamais signer un chiffre et s'en voir
  facturer un autre.

## Ordre de travail

1. La table et sa lecture, sans rien changer à l'écran (le contrat reste identique).
2. L'écran d'édition, la corbeille, le bouton « Reprendre le contrat type ».
3. La catégorie « sportif » dans le formulaire du véhicule.
4. Le branchement de l'état des lieux et de la facture.
5. Vérification à l'écran : contrat avant/après, état des lieux, facture.
