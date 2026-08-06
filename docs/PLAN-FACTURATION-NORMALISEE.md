# Plan — Facturation normalisée (format officiel)

Cadré avec Jeff le 06/08/2026. **À valider avant d'écrire une ligne de code.**

## Objectif

Un **format de facture officiel unique** (le modèle `docs/Facture commerciale
entreprise professionnel classique sobre.pdf`), appliqué à **deux factures** au
contenu différent :

- **Facture de LOCATION** (nouvelle) — émise **au départ**, à la signature de
  l'état des lieux. Contenu : le forfait de location + les options (km illimité…).
- **Facture de RESTITUTION** (existe déjà) — émise **au retour**, uniquement s'il
  y a des frais constatés (km sup, retard, dommages…). Passe au même format.

## Décisions déjà prises (ne pas rouvrir)

1. **Deux factures, un seul format.** La restitution ne re-facture jamais la
   location (pas de double comptage).
2. **Facture de location au départ** : la **signature** de l'EDL départ déclenche
   sa création. **Un seul mail au client, deux pièces jointes** : le contrat de
   location (conditions générales + EDL) et la facture de location. Facture
   **enregistrée dans l'app et téléchargeable** manuellement depuis la réservation.
3. **Facture de restitution au retour** : seulement les **frais de retour**, et
   seulement **si le montant est > 0**.
4. **Identité légale = celle de l'appli** (`agency_settings` : « 2 rue Jean Zay,
   Bonneuil-sur-Marne », SIRET actuel). On **ajoute l'email** (à afficher aussi
   sur le contrat) et le **N° de TVA intracommunautaire**. Jeff remplit ces
   valeurs dans Paramètres — aucune valeur en dur dans le code (règle du socle).
5. **TVA configurable.** Un **taux de TVA en réglage** (défaut **20 %**). Prix
   stockés **TTC**, le HT se déduit (`HT = TTC / (1 + taux)`). Si le taux vaut
   **0**, pas de colonne TVA, un seul montant, et la mention obligatoire
   « TVA non applicable, art. 293 B du CGI ». Jeff ajuste sans développeur.
6. **Numérotation : une série continue par type.** `FL-2026-00001` pour les
   locations, `FR-2026-00001` pour les restitutions. Chaque série continue et
   par année.

## Ce que le format normalisé impose (repris du modèle)

En-tête logo + « FACTURE » · Date d'émission + date de règlement + N° de facture ·
**Vendeur** (nom, tél, email, adresse, SIRET, N° TVA) **en face du** client
(nom, tél, email, adresse) · Tableau **Description / Prix Unitaire HT / Quantité /
Total HT** · Totaux **TOTAL HT / TVA X % / REMISE / TOTAL TTC** · Pied
**Dépôt de garantie + Mode de règlement**.

## Étapes

### 1. Réglages agence (Paramètres)
- Migration `agency_settings` : ajouter `vat_number` (N° TVA) et `vat_rate`
  (numérique, défaut 20). Le champ `email` existe déjà.
- Champs correspondants dans le formulaire Paramètres.
- Afficher l'email de l'agence sur le **contrat de location** (câblage déjà fait
  côté prévisu ; il ne manque que la valeur en base).

### 2. Table `invoices`
- Migration : ajouter `type` (`location` | `restitution`), et **figer** au moment
  de l'émission `vat_rate`, `total_ht`, `total_vat`, `total_ttc` (une facture
  émise ne doit jamais changer — obligation légale). Vérifier `cancelled_at`.

### 3. Calcul HT / TVA — `lib/invoices/tva.ts`
- TTC → `{ ht, tva, ttc }` selon le taux. Taux 0 → `ht = ttc`, pas de TVA.

### 4. Gabarit normalisé — `lib/pdf/invoice-template.tsx`
- Refondre au format du modèle (en-tête, vendeur/client en vis-à-vis, colonnes
  HT, totaux HT/TVA/remise/TTC, pied dépôt + règlement).
- Variante franchise (taux 0) : sans colonne TVA + mention art. 293 B.
- Mettre `InvoicePreviewClient.tsx` **en miroir exact** (l'aperçu à l'écran doit
  être identique au PDF — règle déjà posée dans le fichier).

### 5. Facture de LOCATION (nouvelle)
- Type `location`. Lignes = forfait location (X jours) + options, depuis le détail
  de prix déjà calculé (`rentalPriceBreakdown`). Série `FL`.
- Générée à la **signature de l'EDL départ**, dans le flux qui produit/envoie le
  contrat. Mail = contrat + facture (2 PJ). Stockée + téléchargeable.

### 6. Facture de RESTITUTION (existe)
- Basculer sur le nouveau gabarit, série `FR`, contenu **inchangé** (frais de
  retour, si > 0).

### 7. Numérotation par série
- Compteur continu par (type, année) : `FL-YYYY-NNNNN`, `FR-YYYY-NNNNN`.

## Défauts confirmés (06/08/2026)
- **Date de règlement = date d'émission** (payé au départ).
- **Dépôt + mode de règlement** (pied) : repris de la réservation
  (`deposit_amount`, moyen de paiement). Le « (chèque non encaissé) » suit le mode.
- **Remise** : ligne REMISE si la réservation en porte une ; sinon « - ».
- **Taux de TVA de base = 20 %, configurable.** Prix laissés en **TTC** pour
  l'instant (on ne sait pas encore si le prix communiqué est TTC ou HT) ; le HT se
  déduit. Modifiable depuis la grille tarifaire.

## Ce que Jeff a fourni (à mettre en `agency_settings`, PAS dans le code)
- **Email agence** et **N° de TVA intracommunautaire** communiqués le 06/08/2026.
  Valeurs saisies en base au moment de créer les champs — jamais écrites en dur
  (règle du socle : aucune valeur client dans le dépôt).

## Figée à l'émission (rappel légal)
Une facture émise ne change plus. On **fige** à l'émission les montants, le taux
de TVA, les lignes et les identités (vendeur + client) : la facture lit cette
photo, jamais la donnée vivante. Une correction se fait par un **avoir**, pas en
éditant la facture. C'est ce qui rend la numérotation continue opposable.

## Taille
Chantier conséquent (migrations, gabarit partagé, deux flux d'émission, envoi
groupé au départ, réglages). **Plusieurs jours.** À placer dans le planning des
onglets — ne se lance qu'après ton feu vert.
