# Le plan d'exécution

Séquencement validé par Jeff le 02/08/2026. **Le quoi est dans `PLAN-REMARQUES.md`**, avec la
cause vérifiée de chaque point et le geste. **Ce document dit dans quel ordre on l'exécute et
comment on clôt une étape.** Les deux se lisent ensemble.

## Le rituel, identique à chaque étape

1. Traiter **tout** ce que porte l'onglet, jamais une remarque isolée (règle du 30/07).
2. `npm run build`.
3. Rejouer le parcours à l'écran, largeur téléphone **et** ordinateur, captures jointes à la
   réponse. C'est un contrôle de livraison, pas la recette : **la recette est faite par Jeff.**
4. Marquer `✅ FAIT (<commit>)` dans son outil d'annotation (clé `lms_remarques`) et cocher la
   ligne ici.
5. Remonter ce qui a été découvert en chemin. Ça rentre au plan **à son onglet**, jamais dans
   l'étape en cours.

Un onglet clos ne se rouvre que si Jeff le rouvre.

## L'ordre

| # | Étape | Source | Charge | État |
|---|---|---|---|---|
| **A0** | Le véhicule en déplacement affiché disponible | J · 40.1 | 3 h | ✅ fait et poussé le 02/08 (`2337228`) |
| **A1** | Tableau de bord et Alertes | G + J · 45 | 1 j | à faire |
| **A2** | Suivi véhicule, le suivi complet d'une intervention | G + J · 38, 43 | 3 à 4 j | à faire |
| **A3** | Paramètres, les grilles tarifaires | G | 2 à 3 j | à faire |
| **A4** | Réservations, le kilométrage illimité et le paiement | G + J · 42 | 1,5 j | à faire |
| **A5** | Les notifications entre collaborateurs | G | 0,5 j | à faire |
| **A6** | Le module de campagnes e-mail | G | 4 à 6 j | à faire |
| **B1** | Déplacements, les quatre points restants | J · 40.2 à 40.5 | 1 j | à faire |
| **B2** | Immobilisation créée depuis son onglet | J · 39 | 0,5 j | à faire |
| **B3** | L'écran des disponibilités | J · 44 | 0,5 j | à faire |
| **B4** | Les 35 notifications revérifiées une par une | J · 41 | 1 j | à faire |
| **B5** | Les infractions, en un seul bloc | J · 9, 10, 11 | 1,5 j | à faire |
| **B6** | L'acompte qui bloque la voiture | J · 8 | 1 j | à faire |

**Environ 20 jours ouvrés**, pour un créneau qui court jusqu'au 30/08/2026. A2, A3 et A6 pèsent
plus de la moitié.

## Les décisions de séquencement du 02/08

1. **Le bloc A passe entièrement devant le bloc B.** Les demandes du gérant en usage réel
   priment (§7 du CLAUDE.md général).
2. **A0 passe devant le bloc A lui-même.** C'est le seul point de toute la liste qui fait
   mentir un chiffre montré au gérant, et il coûte trois heures.
3. **A2 avant A3**, alors que les deux sont du même poids : Suivi véhicule est l'onglet que le
   gérant valide en séance, et l'ordre de validation du §6 met le parc et l'entretien en tête.
4. **A4 ne peut pas passer avant A3.** Le kilométrage illimité prend ses quatre prix dans la
   grille tarifaire ; sans elle il n'a pas de source.
5. **A6, le module e-mail, reste dans les priorités du gérant** et ne part pas en fin de plan :
   décision de Jeff, il ne veut plus le voir repoussé.
6. **Aucune cible imposée au point du mardi.** La séance se joue sur ce qui est déjà en ligne,
   on ne découpe pas une étape pour tenir une date.
7. **La recette est faite par Jeff, manuellement.** Le chantier des tests automatiques n'est pas
   lancé et ne rentre pas dans ce plan.

## Les dépendances à ne pas inverser

- **A3 avant A4** : la grille porte les quatre prix de l'illimité.
- **A2 avant le ménage** : `resolveVehicleIssue` et `setDamageQuote` ne se suppriment qu'une
  fois la 38 finie.
- **A6 après rien, mais avec son préalable** : l'expéditeur en dur dans `lib/email/config.ts` et
  le consentement commercial se règlent dans l'étape, pas après.

## Ce que le balayage de A0 a trouvé, et qui reste ouvert

- **Les autres heures de l'écran Réservations sont calculées sur le serveur.** La carte du
  véhicule choisi annonce « Revient le 4 août à 10:00 » avec l'heure de la machine : juste en
  local, faux de deux heures sur Vercel l'été. Seule la ligne du déplacement a été corrigée
  (elle venait d'être écrite). **À reprendre en A4**, avec le reste de l'onglet.
- **La règle « ce véhicule est-il en déplacement ? » existe maintenant en un seul endroit**
  (`estEnDeplacement`), mais la liste des véhicules et le tableau de bord gardent leur copie
  écrite sur place. Comportement identique, aucun défaut : ce sont deux écrans validés par le
  gérant, ils n'ont pas été touchés pour rien. À rebrancher le jour où l'un des deux se rouvre.

## Ce qui ne rentre pas dans ce plan

Chantiers connus, volontairement hors séquencement : l'onglet « Mises à jour » (après la
livraison de Smart Loc), le paiement en ligne, l'application instantanée, le balayage des
fenêtres de l'application, et la fiche d'installation d'un nouveau client.
