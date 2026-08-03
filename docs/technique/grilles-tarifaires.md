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

| Grille | Retard/h | Carburant | Franchise | Voitures |
|---|---|---|---|---|
| Sportive | 150 € | 2,20 €/L | 21 000 € | BMW i8 |
| Citadine | 50 € | 2,20 €/L | 15 000 € | 5 voitures |
| Citadine · franchise réduite | 50 € | 2,20 €/L | 6 000 € | Smart Fortwo |

## Le retard se facture à l'heure, et à rien d'autre — décision du 03/08/2026

Une grille portait un « retard à la journée » de 80 €. Ce n'était le choix de personne : le
`DEFAULT 80` de la migration `007_agency_settings.sql`, recopié de proche en proche. Aucun
calcul ne l'a jamais lu, et il laissait croire à un forfait journalier inexistant — à 50 €/h,
une journée de retard vaut 1 200 €, pas 80 €.

**Le champ a quitté les écrans** (grilles et paramètres). Le retard se calcule par
`calculateLateFee` : tolérance, puis tarif horaire par heure entamée. Le gérant corrige le
montant à la main sur la facture de restitution quand il le juge nécessaire.

La colonne `late_daily_rate` reste en base, dormante, et `valeursCommunes` ne l'écrase plus :
un champ absent du formulaire n'est plus touché. Sans cette précaution, enregistrer une grille
aurait effacé la valeur silencieusement.

**Corrigé au passage :** l'état des lieux de retour annonçait « 150 €/h » ou « 50 €/h » écrits
en dur sous le montant du retard, alors que le calcul prenait déjà le tarif de la grille. À
15 €/h réglés, l'écran affichait 50 €/h.

La troisième existe parce que la Smart Fortwo a toujours eu une franchise différente. Si un
jour la franchise doit pouvoir se poser voiture par voiture, elle descendra au niveau du
véhicule et cette grille disparaîtra.

## Les frais de restitution se règlent depuis l'application — 03/08/2026

Les 27 postes du tableau des frais (rayure, jantes, pare-brise, fourrière…) ne sont plus
écrits en dur : ils vivent dans `restitution_fees`, deux listes (`sportif` et `standard`), et
le gérant les ajoute, renomme, retarife, réordonne ou retire depuis `/settings/tarifs`.

| Fichier | Rôle |
|---|---|
| `lib/contracts/frais-restitution.ts` | le contrat type, la lecture, la mise en forme d'une valeur |
| `lib/actions/restitution-fees.ts` | les écritures, réservées au gérant |
| `app/(dashboard)/settings/tarifs/FraisRestitution.tsx` | l'écran |
| `supabase/migrations/077_frais_restitution.sql` | la table, **créée vide** |

**Trois règles à ne pas casser :**

1. **Une catégorie est tout ou rien.** Rien en base = le contrat type du code s'imprime, donc
   le contrat d'avant le 03/08/2026 à la virgule près. Le bouton « Modifier ces frais »
   recopie les 27 postes d'un coup : modifier une ligne seule ferait disparaître les 26 autres.
2. **Les franchises et le retard ne se saisissent pas dans cette liste** (colonne `source`).
   Ils viennent de la grille tarifaire du véhicule ; les rendre saisissables ferait afficher
   deux chiffres contradictoires sur le même contrat.
3. **`damage_key` relie un poste au constat de l'état des lieux.** C'est lui qui fait qu'une
   rayure profonde constatée propose 500 € dans la facture. Un poste retiré prive le dommage
   de son tarif : la facture arrive sans prix, et l'écran le dit avant de retirer.

Les quatre écrans qui impriment ces montants (PDF, aperçu écran, récapitulatif de signature,
état des lieux) reçoivent **la même liste**, résolue côté serveur par `postesDeLaCategorie`.
`tarifDommage` tourne dans le navigateur : ne jamais lui faire lire la base, les postes doivent
lui arriver en paramètre.

**Restent dans le code, pour toujours :** le texte des 14 articles juridiques. Décision de
Jeff du 03/08/2026, pour ne pas exposer le contrat à une réécriture approximative.

**Piège corrigé au passage :** la catégorie « sportif » n'existait pas dans le formulaire du
véhicule (citadine, berline, SUV, utilitaire) alors qu'elle déclenche tout le barème sportif.
Modifier la BMW i8 lui faisait perdre ses tarifs sans un mot.

## Les tarifs d'agence ne se saisissent plus dans Paramètres — 03/08/2026

Les six champs de `agency_settings` s'affichaient en saisie alors qu'aucune facture ne les
lisait (le gérant réglait 1 €/km pendant qu'on facturait 2 €). Ils y sont désormais **en
lecture**, présentés comme des valeurs de secours, avec un renvoi vers cet écran.

Conséquence à ne pas casser dans `lib/actions/agency.ts` : un champ tarifaire **absent** du
formulaire n'écrase plus rien. Sans cette précaution, enregistrer la raison sociale viderait
la franchise de secours. Les six restent acceptés s'ils sont envoyés.
