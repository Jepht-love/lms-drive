# Les grilles tarifaires

Fiche de reprise pour un développeur qui arrive sans Jeff. État au 03/08/2026.

## Le problème que ça règle

Les six tarifs de l'écran des paramètres (`agency_settings`) étaient **enregistrés mais lus
par personne** : le gérant réglait son kilomètre supplémentaire à 1 € pendant que les factures
comptaient 2 €. Pire, le tarif de retard était écrit **en dur dans le code** (50 €/h, ou
150 €/h si la catégorie du véhicule valait `sportif`), tout comme la franchise du contrat
(21 000 / 15 000 / 6 000 € pour la Smart Fortwo, nommée en dur). Impossible d'y toucher sans
développeur, et impossible de livrer le logiciel à un autre client sans le modifier.

## Les deux niveaux

| Niveau | Ce qu'il porte | Où |
|---|---|---|
| **Véhicule** | Les huit prix de location, la caution, le supplément au kilomètre, les kilomètres inclus, le prix du kilométrage illimité | colonnes de `vehicles` |
| **Grille** | Retard à l'heure, retard à la journée, carburant, franchise | table `pricing_grids` |

**Le véhicule gagne toujours.** La grille ne remplace jamais un prix de voiture ; elle ne
fournit que les quatre valeurs communes, celles que personne ne portait. Une voiture sans
grille facture ses propres valeurs et retombe sur `agency_settings` pour les quatre autres,
exactement comme avant : **aucune facture ne change le jour de la livraison.**

## Les fichiers

| Fichier | Rôle |
|---|---|
| `lib/pricing/grid.ts` | **La règle**, et rien d'autre : quelle valeur gagne. Aucune lecture en base, pour qu'elle se relise d'un coup d'œil |
| `lib/pricing/resolve.ts` | Le raccourci serveur : lit la grille et l'agence, rend les tarifs résolus |
| `lib/actions/pricing-grids.ts` | Créer, régler, supprimer une grille ; y attacher une voiture ; corriger ses tarifs |
| `app/(dashboard)/settings/tarifs/` | L'écran, réservé au gérant et à l'administrateur |
| `supabase/migrations/076_grilles_tarifaires.sql` | La table et les deux colonnes de `vehicles` |

## Ce qui lit les tarifs résolus

- **Les frais de retard** : `lib/calculations/fees.ts`, appelé par les deux écrans d'état des
  lieux de retour (`inspections/arrival` et `inspections/ia-arrival`).
- **Le contrat** : `lib/contracts/legal-articles.ts` (`getFeesTable`), utilisé par le PDF
  (`lib/pdf/`), son aperçu à l'écran et le récapitulatif de signature. Les trois doivent
  recevoir les mêmes montants, sinon le client signe un chiffre et s'en voit facturer un autre.

## ⚠️ Un contrat signé ne change jamais

C'est **l'archivage du PDF à la signature** qui fige les montants. `buildContractPdfData` ne
sert qu'à produire un document neuf : ne jamais s'en servir pour réafficher un contrat ancien
sans avoir figé ses montants à côté, sinon un contrat de juillet afficherait les tarifs d'août.

## Pièges

- **Zéro est une valeur valable**, `null` non. Un supplément au kilomètre à 0 € veut dire
  « inclus » ; confondre les deux ferait remonter le tarif de la grille sur une voiture dont le
  gérant a justement voulu qu'elle n'en ait pas.
- **Colonnes doublons de `vehicles`** : la facturation lit `daily_price`, `weekly_price`,
  `price_day_weekend`, `price_weekend_full`, `km_included_daily`, `extra_km_price`,
  `deposit_amount`. Les colonnes `price_day_week`, `price_week`, `km_included_day`,
  `km_included_weekend` et `km_extra_price` sont d'anciennes jumelles dormantes.
- **Dans un PDF, jamais `toLocaleString`** : il écrit « 15/000 € ». Utiliser `fmtEntier`
  (`lib/pdf/nombres.ts`).

## Les grilles de LMS Drive, montées le 03/08/2026

| Grille | Retard/h | Retard/j | Carburant | Franchise | Voitures |
|---|---|---|---|---|---|
| Sportive | 150 € | 80 € | 2,20 €/L | 21 000 € | BMW i8 |
| Citadine | 50 € | 80 € | 2,20 €/L | 15 000 € | 5 voitures |
| Citadine · franchise réduite | 50 € | 80 € | 2,20 €/L | 6 000 € | Smart Fortwo |

La troisième existe parce que la Smart Fortwo a toujours eu une franchise différente. Si un
jour la franchise doit pouvoir se poser voiture par voiture, elle descendra au niveau du
véhicule et cette grille disparaîtra.

## Ce qui reste en dur dans le contrat

Les forfaits de dégâts (rayure 500 €, jantes 800 €, pare-brise 5 000 €…) et le texte des
articles juridiques. Ce sont des valeurs propres à LMS Drive : elles devront descendre en
configuration avant qu'un autre client reprenne ce contrat.
