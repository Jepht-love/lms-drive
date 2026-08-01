# Plan — Relier les dégâts, les interventions et la comptabilité

Cadré avec Jeff le 01/08/2026. À dérouler après le commit du lot 1.

## Le problème en une phrase

L'état des lieux crée un dégât ; l'entretien crée une intervention chez le garage ;
**les deux ne se connaissent pas.** Impossible aujourd'hui de dire « ces 180 € payés
au garage réparent la rayure facturée 300 € au client du contrat n° 2026-041 ».
C'est le chaînon qui manque pour mesurer l'amortissement d'un véhicule.

## Ce qui existe déjà, à ne pas refaire

| Brique | Où | État |
|---|---|---|
| Dégât localisé à l'état des lieux, prix du contrat, origine « Location », réservation d'origine | `components/inspection/InspectionFlow.tsx` | fait (lot 1, non commité) |
| Facture de restitution, numérotée, envoyée, comptabilisée | `lib/actions/invoices.ts` | fait |
| Dégât visible dans la fiche du véhicule, avec devis et réparation | `VehicleFacts.tsx`, `ResolveDamageRow.tsx` | fait (lot 1) |
| Intervention au garage : date, garage, kilométrage, montant, rendez-vous au calendrier, immobilisation du véhicule, facture rangée dans Documents | `lib/actions/maintenance.ts` | fait |
| Dépense comptable rattachée au véhicule et à la réservation | `financial_transactions` | colonnes déjà présentes |

## Décisions de cadrage (Jeff, 01/08/2026)

1. **Une intervention répare plusieurs dégâts, avec un montant par dégât.** Le devis
   du garage est détaillé ligne par ligne. Rien à répartir à la main, la ventilation
   comptable par type reste exacte.
2. **Point d'entrée unique : Suivi véhicule, onglet Entretien.** Les entretiens
   courants (vidange, révision, contrôle technique) passent par le même écran, avec
   zéro dégât coché.
3. **Le garage reste une saisie libre**, comme aujourd'hui.
4. **Le devis a trois états** : brouillon, « Devis validé », réparé. Modifiable et
   annulable tant que la réparation n'est pas faite. Un devis validé n'écrit rien en
   comptabilité, il s'affiche à part.
5. **Vidange et contrôle technique restent dans Suivi véhicule mais n'entrent pas
   dans le calcul des réparations de dommages.** Le tableau d'amortissement ne
   compte que rayures, jantes, pare-brise, carrosserie et compagnie.
6. **Période du tableau : le mois en cours, ajustable de date à date.**
7. **Un dégât de location non facturé au client** (geste commercial, assurance) sort
   de l'origine « Location » et va sur une ligne « Non facturé », avec son motif.
8. **Un dégât n'a plus de vie comptable propre : il vit dans une intervention.** Rien
   ne s'écrit en dépense tant que le garage n'est pas payé. Le bouton « Réparé » de la
   fiche véhicule disparaît, remplacé par le passage en intervention.
9. **Mais chaque dommage garde SA ligne de dépense**, même réparé dans une
   intervention groupée : c'est le garage qui évalue séparément une portière et une
   vitre, et c'est cette évaluation qu'on veut lire.
10. **La date du garage fait foi, pour tout.** C'est la règle la plus importante de
    la rubrique, et la seule date qui compte : facture du garage payée et véhicule
    réparé. La date à laquelle le dégât a été CONSTATÉ n'entre pas dans ce tableau.

    - **Dommage facturé au client** : sa recette voyage avec lui. Les 300 € facturés
      et les 180 € payés au garage apparaissent tous deux dans le mois où le garage
      a été réglé, côte à côte. On lit un couple, pas deux événements.
    - **Dommage sans responsable** (usure, usage interne, non communiqué) : la
      dépense y va seule, rien en face.

    Cas limite, à ne pas perdre : **un dommage facturé mais jamais réparé** (petite
    rayure encaissée, aucun passage au garage) n'a pas de date de garage et
    n'entrerait dans aucun mois. Il s'affiche en tête du tableau, sur une ligne
    « facturé, pas encore réparé », et bascule dans le mois du garage le jour où la
    réparation a lieu.

    La comptabilité générale, elle, n'est pas concernée : elle garde les dates
    réelles de l'argent et ne bouge pas d'un jour. Ce tableau est une lecture, pas
    une écriture.

## Lot 2 — L'intervention porte ses dégâts

### Base de données (migration 073)

`maintenance_records` reçoit trois colonnes :

- `quote_amount` (numérique) — le devis total du garage
- `quote_status` (texte) — `brouillon`, `valide`, `annule`
- `reservation_id` (référence) — la location d'origine, quand l'intervention ne
  répare que des dégâts d'une seule location

`financial_transactions` reçoit une colonne :

- `damage_origin` (texte) — `location`, `usure`, `usage_interne`, `non_communiquee`,
  `non_facture`. C'est elle qui permet de ventiler sans avoir à remonter le dégât à
  chaque affichage.

Le dégât lui-même (`vehicles.maintenance_flags`, déjà au format libre) reçoit
`intervention_id`. Aucune migration nécessaire de ce côté.

### Écran

`/suivi`, onglet Entretien, bouton « Planifier une intervention » :

1. Véhicule, date, garage, kilométrage — comme aujourd'hui.
2. **Nouveau bloc** : la liste des dégâts non réparés du véhicule, une case par
   dégât, un champ « devis » par ligne. Chaque ligne rappelle ce qui a été facturé
   au client et l'origine.
3. Zéro dégât coché : le formulaire redevient l'entretien courant d'aujourd'hui
   (type à choisir, vidange, révision, contrôle technique).
4. Enregistrer en brouillon, ou valider le devis.

À la réparation : saisir le montant réel **par ligne**, ce qui crée **une écriture
comptable par dégât**, portant son origine, son véhicule et sa réservation. Une
intervention qui mélange une rayure de location et une usure produit donc deux
écritures, correctement ventilées.

### Ce qu'il ne faut pas casser

- `resolveVehicleIssue` (réparation d'un dégât isolé, sans passer par une
  intervention) doit continuer de fonctionner : c'est le chemin rapide.
- Le garde anti-doublon `reference = maintenance:<id>` empêche déjà une dépense
  écrite deux fois. L'écriture par dégât doit avoir sa propre référence,
  `maintenance:<id>:<flagId>`.
- L'immobilisation automatique du véhicule et le rendez-vous au calendrier existent :
  les garder tels quels.

## Lot 3 — La rubrique de comptabilité — ÉCRIT LE 01/08/2026

`app/(dashboard)/accounting/degats/page.tsx`, plus sa tuile sur `/accounting`.

**Deux décisions prises le jour de l'écriture, qui modifient ce qui suit :**

- **Périmètre limité aux dégâts et réparations.** L'idée d'un onglet « Chiffre
  d'affaires prestations annexes » couvrant aussi carburant, kilomètres et
  nettoyage a été écartée par Jeff : le carburant et les kilomètres restent où ils
  sont.
- **Rien avant la clôture de l'intervention.** La ligne « Devis validé » prévue
  ci-dessous n'existe pas : l'onglet ne montre que ce qui est réellement payé.

**Limite connue, à dire au gérant :** les réparations enregistrées avant le
01/08/2026 par l'ancien chemin (`resolveVehicleIssue`, un dégât soldé isolément)
ne portent pas d'origine et n'apparaissent donc pas dans le tableau. Seules les
réparations passées par une intervention y entrent.

Nouvel onglet dans Comptabilité : **« Dégâts et réparations »**.

Deux blocs face à face, sur la période choisie (mois en cours par défaut) :

**Recettes** — les frais de restitution facturés aux clients, par véhicule.

**Dépenses** — les réparations, ventilées par origine :

| Origine | Recette en face | Ce que ça dit |
|---|---|---|
| Location | oui | ce que le client a payé, ce que la réparation a coûté, la marge |
| Non facturé | non | ce que les gestes commerciaux et l'assurance coûtent |
| Usure du temps | non | le vieillissement du parc |
| Usage interne | non | ce que l'équipe casse |
| Non communiquée | non | ce qu'on n'a pas su rattacher |

Sous chaque origine, le détail par véhicule. Une ligne « Devis validé » s'affiche à
part, en dessous, sans entrer dans les totaux.

**La lecture visée :** sur un mois, combien de factures de restitution encaissées,
combien de réparations payées, et quel véhicule coûte le plus.

## Ordre d'exécution

1. Commiter le lot 1 (huit corrections déjà écrites et vérifiées).
2. Migration 073.
3. Lot 2, l'écran d'intervention.
4. Lot 3, l'onglet de comptabilité.

Les lots 2 et 3 sont des changements de structure : ils relèvent d'Opus, donc de la
réinitialisation du quota du dimanche 2 août à 18 h.
