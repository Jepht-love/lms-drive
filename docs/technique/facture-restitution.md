# La facture de restitution

Fiche de reprise pour un développeur qui arrive sans Jeff. État au 03/08/2026.

## Ce que c'est

La facture des frais constatés au retour du véhicule : retard, dommages, nettoyage,
carburant, fourrière. Elle naît à la clôture du contrat depuis l'état des lieux de retour,
se complète à la main sur la fiche réservation, puis part au client par e-mail.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `lib/actions/invoices.ts` | Créer, modifier les lignes, envoyer, annuler |
| `app/(dashboard)/reservations/InvoiceCard.tsx` | Le bloc de saisie sur la fiche réservation |
| `app/(dashboard)/reservations/[id]/facture/` | **L'aperçu à l'écran**, page + composant |
| `app/api/invoices/[invoiceId]/preview/route.ts` | Le PDF, rendu à la volée (rien n'est figé) |
| `lib/pdf/invoice-template.tsx` | Le modèle PDF |
| `lib/invoices/mentions-legales.ts` | Les sept mentions légales, **source unique** |

## L'aperçu ne doit jamais mentir

`app/(dashboard)/reservations/[id]/facture/` et `lib/pdf/invoice-template.tsx` affichent le
même document par deux techniques différentes (HTML d'un côté, react-pdf de l'autre). **Une
ligne ajoutée à l'un s'ajoute à l'autre**, sinon le gérant valide un document qui n'est pas
celui que le client reçoit. Les mentions légales sont déjà partagées ; le reste ne l'est pas,
c'est le point de vigilance.

## Pourquoi une page et pas le PDF en nouvel onglet

Le bouton « Prévisualiser » ouvrait `/api/invoices/[id]/preview` dans un onglet. Sur le
téléphone du gérant, la visionneuse PDF s'affiche en plein écran **sans bouton retour** :
l'application paraissait bloquée (remonté le 03/08/2026, et déjà remonté quelques semaines
plus tôt sur un autre écran). La règle qui en sort : **aucun document ne s'ouvre hors de
l'application**. Le PDF reste accessible, mais par un téléchargement volontaire
(`?download=1`, qui bascule l'en-tête en `attachment`).

## Pièges

- **Les dates sont mises en forme côté serveur**, dans `page.tsx`, à l'heure de l'agence.
  Vercel tourne en temps universel : un composant client rendu d'abord côté serveur
  afficherait deux heures de moins, puis se corrigerait tout seul à l'affichage.
- **`fmtNombre`, jamais `toLocaleString`** : ce dernier écrit « 15/000 € » dans le PDF, et
  l'aperçu doit afficher exactement les mêmes chiffres.
- **La facture n'est pas figée tant qu'elle n'est pas envoyée.** L'aperçu la recalcule à
  chaque ouverture ; c'est voulu, le gérant ajuste ses lignes avant l'envoi.
- Sur téléphone, le tableau à quatre colonnes se replie en liste. Ne pas le rétablir : à
  390 px il débordait.
