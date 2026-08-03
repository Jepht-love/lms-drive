# Suivi véhicule · les interventions

Fiche de reprise pour un développeur qui arrive sans Jeff. État au 02/08/2026, après le
lot 1 du chantier A2 (`docs/PLAN-A2-INTERVENTIONS.md`).

## Ce que fait la rubrique

Une **intervention** est un passage au garage sur un véhicule. Elle porte deux suivis
strictement séparés, et c'est le point le plus important à comprendre :

| Le suivi de… | Ce qui le porte | Ce qui le fait avancer |
|---|---|---|
| **l'argent** | `amount`, `quote_amount`, `paid_at`, `paid_method` | `settleIntervention` et `markMaintenancePaid` |
| **le travail** | `urgency`, `due_date`, `assigned_to`, `taken_by`, `work_status` | `prendreEnChargeIntervention` et `changerStatutIntervention` |

Une intervention peut être **terminée sans être payée** (le garage a rendu la voiture, sa
facture arrive plus tard) et **payée sans être terminée** (acompte). Ne jamais déduire l'un de
l'autre. Une seule passerelle existe, dans ce sens uniquement : **régler clôt le travail** s'il
ne l'était pas déjà.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `lib/maintenance.ts` | Les types, les dix types d'intervention, les trois urgences, les six statuts |
| `lib/actions/maintenance.ts` | Tout ce qui écrit : création, prise en charge, changement d'état, règlement, suppression |
| `app/(dashboard)/maintenance/[vehicleId]/page.tsx` | La fiche entretien d'un véhicule |
| `app/(dashboard)/maintenance/[vehicleId]/MaintenanceHistory.tsx` | La liste des interventions et toutes ses actions |
| `app/(dashboard)/maintenance/[vehicleId]/new/` | Le formulaire de création |
| `components/suivi/EntretienSection.tsx` | Le volet Entretien de `/suivi`, vue par véhicule |
| `lib/utils/alerts.ts` | La section « 3 bis », qui fait entrer une intervention dans les alertes |

## La table

`maintenance_records`. Colonnes du suivi du travail ajoutées par la migration
`074_interventions_suivi_travail.sql` : `urgency`, `due_date`, `assigned_to`, `taken_by`,
`taken_at`, `work_status`, `closed_at`. Deux contraintes de contrôle interdisent toute autre
valeur que celles de `lib/maintenance.ts` : **ajouter un statut ou une urgence demande de
toucher aux deux endroits**, sinon l'écriture est refusée par la base.

## Les règles de gestion

- **Trois urgences** : `normale`, `haute`, `critique`. C'est l'urgence qui décide de l'entrée
  dans les alertes : critique en urgent, haute en important, normale n'alerte pas.
- **Une échéance dépassée passe en urgent**, quelle que soit l'urgence d'origine.
- **Six statuts** : à traiter, prise en charge, rendez-vous programmé, en cours, terminée,
  annulée. Les deux derniers ferment le dossier (`WORK_STATUSES_CLOS`) : plus d'alerte, plus de
  compteur sur la fiche du véhicule.
- **On se met soi-même sur une intervention.** `assigned_to` est la personne désignée à la
  création, `taken_by` celle qui s'en est saisie. Les deux peuvent différer. Une intervention
  déjà prise par quelqu'un d'autre ne se reprend pas sans le dire.
- **Seuls un gérant, un associé ou un administrateur terminent ou annulent** : la clôture
  engage un montant. Faire avancer une intervention reste ouvert à tout le monde.

## Ce qui la relie au reste

- **Le calendrier** : créer une intervention d'un type « garage » pose un créneau `rdv_garage`
  et immobilise le véhicule. Ce créneau appartient encore à l'intervention ; le lot 3 doit en
  faire un passage au garage partagé.
- **Les alertes** : `lib/utils/alerts.ts`, section « 3 bis ». Le type d'alerte est
  `intervention`, et il est **volontairement exclu de la recopie au calendrier**
  (`ALREADY_ON_CALENDAR_TYPES` dans `lib/calendar/syncAlerts.ts`) : le créneau garage existe
  déjà, la recopier afficherait deux fois la même réparation.
- **La comptabilité** : le règlement écrit une dépense **par dégât**, référence
  `maintenance:<intervention>:<dégât>`. C'est le garde anti-doublon, ne jamais le retirer.
- **Les dégâts du véhicule** vivent dans `vehicles.maintenance_flags`, pas dans une table.

## Pièges connus

- **`work_status` n'est pas `status`.** La colonne `status` du véhicule dit s'il est
  disponible ou immobilisé, c'est autre chose.
- **Rien ne remet aujourd'hui le véhicule en disponible** quand une intervention se termine
  sans être réglée. Défaut connu, repéré le 01/08/2026, corrigé côté règlement seulement
  (point 38.E du plan des remarques).
- **Une intervention normale sans date limite n'apparaît nulle part dans les alertes.** C'est
  voulu : sinon l'écran se noierait sous les vidanges. Elle reste visible sur `/suivi` et sur
  la fiche du véhicule.
- **Les prestataires ne sont pas proposés** dans « Confiée à » : ils n'ouvrent pas
  l'application, une intervention qui leur serait confiée resterait bloquée.

## Les trois moments d'une intervention

Séparation demandée par le gérant le 02/08/2026, et c'est la clé de lecture de toute la
rubrique :

| Moment | Écran | Ce qu'on y saisit |
|---|---|---|
| **Avant** | `/maintenance/<véhicule>/new` | Ce qu'il y a à faire : véhicule, type, urgence, date limite, à qui c'est confié |
| **À la clôture** | `…/<intervention>/cloture` | Ce qui a été fait : nature exacte, pièces, garage, date, prix des pièces, main d'œuvre, coût total, kilométrage, observations, facture |
| **Après** | `…/<intervention>/edit` | Les corrections, avec motif écrit et contrôle des montants |

**« Terminée » n'est pas un simple changement d'état** : le bouton mène au compte rendu. On ne
clôt plus une intervention sans dire ce qui a été fait. Et tant qu'elle est ouverte, l'écran de
modification **n'affiche pas** les pièces, la main d'œuvre ni le montant : il n'y a rien à
facturer avant que le garage ait travaillé.

## Modifier une intervention, et le contrôle des montants (lot 2)

Migration `075_interventions_pieces_et_controle_montants.sql`. Trois choses :

- **`maintenance_parts`** : une ligne par pièce remplacée (nom, quantité, prix unitaire), plus
  `maintenance_records.labor_cost` pour la main d'œuvre. Le détail **explique** le montant
  total, il ne le remplace pas : une réparation de plusieurs dégâts tient son total du
  règlement. L'écran signale un écart sans jamais bloquer.
- **`updateMaintenanceRecord`** : le crayon de la liste ouvre
  `/maintenance/<véhicule>/<intervention>/edit`. Toucher au montant exige un motif écrit ; le
  reste se modifie librement. Une intervention déjà réglée **corrige** son écriture comptable
  (`financial_transactions` par `reference = maintenance:<id>`), elle n'en crée jamais une
  seconde.
- **`maintenance_amount_requests`** : au-delà de 20 % ou 20 € d'écart (le plus petit des deux,
  donc le déclenchement le plus tôt), et **si l'agence a allumé le contrôle**
  (`agency_settings.require_amount_validation`, éteint par défaut), le montant ne bouge pas :
  une demande part et attend la réponse d'un autre gérant ou associé.
  `repondreDemandeMontant` refuse que l'auteur valide sa propre demande.

Deux détails qui ont leur raison d'être :

- **La première saisie n'est pas une correction.** Passer de 0 € à 250 € ne déclenche jamais le
  contrôle, sinon toute intervention créée sans montant serait bloquée à sa première facture.
- **Le contrôle est éteint par défaut** : chez un client où personne d'autre ne peut valider,
  l'allumer bloquerait toute correction.

## Ce qui reste à faire

Lot 3 : le rendez-vous garage devient un passage au garage partagé entre plusieurs véhicules
(remarque 43), l'heure du rendez-vous devient saisissable (38.A), et supprimer une intervention
retire son véhicule du créneau au lieu d'effacer le créneau entier.
