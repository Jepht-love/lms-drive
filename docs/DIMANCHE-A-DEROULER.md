# Ce qu'il y aura à dérouler dimanche

> Document de commandes, écrit pendant que le contexte était encore chaud, pour que
> l'exécution ne repaie pas l'analyse. **Chaque bloc dit : ce que Jeff voit, le fichier
> et la ligne, le geste exact, et comment on vérifie.** Rien n'y demande de réfléchir.
>
> Le plan de fond, avec le pourquoi de chaque demande, reste dans
> `PLAN-JUSQU-AU-DIMANCHE-2026-08-02.md`. Ce document-ci ne le remplace pas, il le
> rend exécutable.

---

## Ce qui est déjà livré et en ligne

Quatre commits poussés sur `main`, donc chez le gérant :

| Commit | Ce qui a changé |
|---|---|
| `96fb5c6` | Le format commun des lignes du tableau de bord (étape 5 du plan, close) |
| `e464bb6` | La journée bascule à minuit, plus de tolérance de 30 minutes (étape 1, close) |
| `f32d18e` | 28 notifications sur 35 passées à trois lignes, avec la couleur du véhicule |
| `64e1998` | Une échéance de véhicule ouvre la page où sa date se corrige |

**À ne pas rouvrir :** les étapes 1 et 5 du plan, le doublon contrat/tâche de clôture,
le format des lignes, la règle de minuit. Tranchés et livrés.

---

# Les blocs, dans l'ordre

## Bloc A. Le bouton « Aujourd'hui » du calendrier — ÉCRIT, NON VU À L'ÉCRAN

**Ce que Jeff voit.** Il appuie sur « Aujourd'hui », la date change mais il reste sur
la vue mois. Il devrait atterrir sur la journée du jour, tâches comprises.

**Où.** `components/calendar/CalendarPage.tsx`, ligne 239, fonction `handleNavigate`.
Le cas `today` fait `setCurrentDate(new Date())` et s'arrête là.

**Le geste.** Ajouter `setView('day')` juste après. Une ligne. `setView` est déjà
disponible dans le même composant (ligne 57).

**Vérification.** Ouvrir le calendrier en vue mois, appuyer sur « Aujourd'hui »,
vérifier qu'on arrive sur la vue jour à la bonne date. Capture téléphone.

**Durée : un quart d'heure. Modèle : Sonnet.**

---

## Bloc B. Qui porte une tâche dans le calendrier — ÉCRIT, NON VU À L'ÉCRAN

> **Fait le 30/07 :** le poste est lu (`enrichEvents.ts`, `types/calendar.ts`), le
> panneau du jour écrit le nom puis le poste sur sa propre ligne, « Non attribué »
> s'écrit en gras ambre, et la colonne du calendrier dit « Non attribué » au lieu de
> « Non assigné ». **Deux endroits volontairement laissés :** la vue semaine du tableau
> de bord, où « À assigner » est déjà en gras et où la place manque pour un poste (cet
> onglet est validé par le gérant, ne pas y toucher sans le lui demander), et l'en-tête
> de colonne du calendrier, où le poste n'apporte rien et encombrerait 36 px de haut.
> **Reste à faire : le regarder à l'écran.**

**Ce que Jeff voit.** Une tâche affiche un nom sans qu'on sache si c'est le client ou
le salarié. Une tâche sans personne n'affiche rien du tout.

**Ce qu'il veut.** Le nom **et le poste** de la personne. « Non attribué » en gras
quand personne ne la porte.

**Le chemin est complet, il n'y a rien à chercher.**

1. `lib/calendar/enrichEvents.ts`, ligne 30 : la requête lit `id, full_name` sur les
   profils. Ajouter `role`.
2. `types/calendar.ts`, ligne 42 : `assigned_profile` est décrit comme
   `{ id, full_name }`. Ajouter `role`.
3. Afficher, avec `roleLabel()` de `lib/roles.ts` pour le libellé du poste :
   - `components/calendar/DayEventsPanel.tsx`, ligne 96 (le panneau du jour)
   - `components/calendar/ResourceColumn.tsx`, ligne 43 (l'en-tête de colonne)
   - `components/dashboard/DashboardCalendar.tsx`, ligne 48 (la vue semaine de l'accueil)
4. « Non attribué » en gras : `components/calendar/CalendarPage.tsx`, ligne 142, où le
   texte « Non assigné » est déjà écrit. Le libellé change aussi.

**Piège.** Cette résolution passe par le client administrateur, pas par une jointure
normale : les règles d'accès empêchent un employé de lire le profil d'un tiers. Ne pas
« simplifier » en jointure, ça viderait le nom pour tout le monde sauf le gérant. Le
commentaire en tête du fichier l'explique.

**Vérification.** Une tâche attribuée, une non attribuée, sur téléphone et sur
ordinateur. Quatre captures.

**Durée : trois quarts d'heure. Modèle : Sonnet.**

---

## Bloc C. Le bas coupé sur tablette en paysage

**Ce que Jeff voit.** En 1024 sur 768, le calendrier de tout le monde ne tient pas, le
bas est coupé et rien ne défile.

**Où.** `components/calendar/CalendarPage.tsx`. La structure de hauteur tient en trois
lignes : 328 (`flex h-full overflow-hidden`), 349 (`flex flex-col flex-1
overflow-hidden`), 391. Le `overflow-hidden` de la ligne 328 coupe sans laisser
défiler.

**Le geste.** Reproduire d'abord en 1024 sur 768, capture à l'appui, avant de toucher
quoi que ce soit. La piste la plus probable est de rendre la zone des colonnes
défilante au lieu de la couper, en gardant l'en-tête fixe.

**Attention.** Cet écran est utilisé sur le terrain. Captures avant et après, en
tablette paysage **et** en tablette portrait, pour vérifier qu'on n'a pas déplacé le
problème.

**Durée : moins d'une heure. Modèle : Sonnet.**

---

## Bloc D. Le simulateur dans le menu

**Fait pendant la session du 30/07, à vérifier à l'écran.**

- `app/(dashboard)/menu/page.tsx` : lien « Simulateur » dans le bloc Éditeur, sous SAV,
  conditionné à `SIMULATEUR_DISPONIBLE` (faux en production) et à l'adresse de Jeff.
- `.gitignore` : les trois outils de l'éditeur sont désormais ignorés
  (`public/simulateur.html`, `public/simulateur.js`, `public/apercu-notifications.html`).
  Un `git add .` ne peut plus les envoyer chez un client.

**Reste à faire :** ouvrir le menu et confirmer que le lien s'affiche et fonctionne.
Non vérifié à l'écran le 30/07, la session du navigateur piloté ayant expiré.

---

## Bloc E. La vue tablette sur téléphone

**Ce que Jeff voit.** Sur téléphone il faut défiler jusqu'en bas pour voir les tâches
d'une date. Sur tablette elles sont toutes visibles avec les heures à côté.

**Ce qu'il faut savoir avant de commencer.** En dessous de 768 px, l'application ne
rétrécit pas la tablette : elle charge un écran entièrement différent,
`components/calendar/MobileCalendar.tsx`, 19 Ko. Le chemin le plus court est de faire
basculer le téléphone sur la vue tablette, puis de réparer ce qui déborde en 390 px.

**Le vrai risque.** C'est l'écran que les salariés utilisent sur le terrain. Si ça part
de travers, on arrête et on en reparle, on ne s'acharne pas.

**Durée : une demi-journée. Modèle : Sonnet, mais avec un plan écrit d'abord.**

---

## Bloc F. L'acompte qui bloque la voiture

**Le plan annonçait cette étape comme débloquée. Elle l'est sur la décision, pas sur le
code : il n'y a rien à modifier, tout est à construire.** Vérifié le 30/07.

**Ce qui existe.**

- Le statut « option » d'une réservation est un pré-blocage **sans aucun décompte** :
  aucun chronomètre n'existe nulle part, contrairement à ce que le plan laissait
  entendre. `app/(dashboard)/page.tsx`, lignes 153, 225, 273, 295, 323.
- L'acompte n'est **pas** un champ de la réservation. C'est `payment_amount`, un
  paiement encaissé, saisi dans `app/(dashboard)/reservations/ReservationForm.tsx`
  ligne 464.

**Le piège à ne jamais confondre.** `deposit_amount` est la **caution**, pas l'acompte.
Le formulaire porte les deux à quelques lignes d'écart (438 pour la caution, 464 pour
l'acompte). Les mélanger fausserait la facturation.

**Ce que la décision de Jeff impose de construire.** Un champ de durée de validité sur
le formulaire quand un acompte est saisi, cette durée stockée sur la réservation, un
décompte visible sur le tableau de bord, et l'annulation automatique à l'échéance avec
retour du véhicule en disponible.

**Donc : changement de structure de base. Plan écrit et validé avant d'écrire, et
Opus, pas Sonnet.** Ce n'est pas une étape de fin de liste, c'est un chantier.

---

# Après la réinitialisation du quota

Ces trois chantiers touchent la structure des données. Le cadrage complet est dans
`PLAN-JUSQU-AU-DIMANCHE-2026-08-02.md`, étapes 8, 9 et 10. Ce qui suit ne redit pas le
contenu, il dit ce qui doit être prêt **avant** de lancer chacun.

## Le cadrage des dégâts et interventions, obtenu le 30/07/2026

### Ce qui existe déjà dans le code, à ne pas réinventer

- **L'écran « Faits & interventions »** : `app/(dashboard)/maintenance/[vehicleId]/VehicleFacts.tsx`.
  Il prend un libellé en texte libre et une gravité (« À surveiller », « Rayure »,
  « Dommage »). Rien d'autre. C'est cet écran qui doit apprendre le type et l'origine.
- **Le barème facturable** : `lib/contracts/damage-rates.ts`, quatorze lignes avec
  leurs prix. Il sert au contrat PDF **et** au chiffrage du retour.
- **Le stockage d'un dégât** : `vehicles.maintenance_flags`, un tableau rangé dans une
  colonne du véhicule, pas une table. Un dégât y porte une zone, un libellé, une
  gravité, et s'il vient d'un état des lieux ou d'une saisie manuelle. **Il ne porte ni
  prix, ni origine, ni auteur, ni date de réparation.** Type dans
  `types/database.ts`, `MaintenanceFlag`.
- **Un défaut à corriger au passage** : la catégorie comptable d'une dépense est
  **devinée à partir des mots du libellé** (`lib/actions/vehicle-issues.ts`, fonction
  `expenseCategoryForDamage`). Si le mot attendu n'apparaît pas, tout part dans
  « réparations » par défaut.

### Ce que Jeff a tranché le 30/07

**Les types de dégât, deux familles.**

1. **Les quatorze dégâts facturables** du barème actuel. Les types sont bons,
   **les montants sont à revoir** : Jeff les redonne, ou ils deviennent modifiables
   depuis les paramètres. Sujet ouvert.
2. **Dix familles de panne mécanique, jamais facturées au client** : moteur,
   embrayage, boîte de vitesses, freins, batterie et électricité, pneumatiques par
   usure, climatisation, échappement, direction et suspension, électronique et
   calculateur. **Validées telles quelles.**

**Un dégât réparé reste, marqué réparé**, avec sa date et son coût. Il ne disparaît pas
de la fiche : c'est ce qui permet de comparer ce qui a été encaissé et ce qui a été
dépensé, et d'empêcher qu'un même dégât soit réparé deux fois.

**Le prix facturé suit le dégât.** Un dégât qui remonte d'un état des lieux ou d'un
sinistre **porte le montant facturé au client**, et ce montant est visible au moment de
planifier l'intervention chez le garagiste. C'est l'objectif numéro un de Jeff : voir
d'un coup d'œil si la réparation coûte plus que ce qui a été encaissé.

**Un fait ajouté à la main doit dire son origine.** Quatre origines, validées : la
location (remplie toute seule quand le dégât remonte d'un état des lieux ou d'un
sinistre), l'usure du temps, le dégât constaté sans cause identifiée, et le dégât causé
par un membre de l'équipe.

**Un dégât constaté mais non facturé au client** garde sa trace, avec la mention « non
facturé » et sa raison : geste commercial, pris par l'assurance, client non
responsable. C'est ce qui permet de voir une réparation à payer sans recette en face.

**Les montants ne se voient que par le gérant et les associés.** Un employé ou un
prestataire voit le dégât et son type, jamais ce qui a été facturé. Même règle que le
tableau de bord.

### Où vit le calcul de rentabilité, tranché le 30/07/2026

**En comptabilité, pas sur la fiche du véhicule.** Ce n'est pas un indicateur de suivi,
c'est de l'argent : il se lit avec les autres recettes et les autres dépenses.

**La clé qui relie tout est le fait déclaré.** Un dégât constaté à l'état des lieux ou
dans un sinistre remonte dans l'entretien, une intervention est planifiée chez le
garagiste, et la ligne comptable naît de ce chaînage. Marge = ce qui a été facturé au
client moins ce qu'a coûté la réparation. **Un dégât d'usure ou d'usage interne entre
sans recette en face : il ne fait que baisser la marge.** Bilan de fin de mois : quel
véhicule coûte le plus en sinistres et en interventions.

**L'immobilisation est déjà couverte, ne pas la recompter.** Le barème facture au
client 70 € par jour en citadine et 500 € en sportif, pour une réparation comme pour
une fourrière, et le tarif journalier de la fourrière s'y ajoute. Il n'y a donc pas de
manque à gagner caché à mesurer. Suggestion écartée par Jeff le 30/07.

**Le tableau à construire, validé sur maquette :** « Dégâts & réparations », ventilé
**par origine d'abord, par type ensuite**, avec trois colonnes, facturé, dépensé,
solde.

```
DÉGÂTS & RÉPARATIONS · juillet
                        facturé   dépensé   solde
Facturé au client       +1 900 €  -1 340 €   +560 €
   Crevaison       3×   +1 200 €    -840 €
   Rayure légère   2×     +600 €    -310 €
Usure                        0 €    -420 €   -420 €
   Batterie        1×         0 €    -190 €
Usage interne                0 €    -180 €   -180 €
Non communiquée              0 €    -260 €   -260 €
Total                   +1 900 €  -2 200 €   -300 €
```

**Deux points d'entrée, un seul calcul :** en comptabilité pour tout le parc, et sur la
fiche d'un véhicule filtré sur lui, parce qu'une intervention se planifie depuis la
fiche, pas depuis la comptabilité. **Ne pas écrire deux fois le calcul**, seulement le
filtre. Le regroupement par type sert aussi de signal : trois crevaisons en deux mois
sur le même véhicule, ce n'est plus de la malchance.

### La correction du barème, faite le 30/07/2026

**Le défaut trouvé.** L'état des lieux de retour proposait ses propres montants, sans
rapport avec le contrat signé et identiques pour toutes les catégories : 50 € pour une
rayure légère quand le client signait 300 € en citadine et 500 € en sportif. Six à dix
fois trop peu à chaque validation sans relecture. Défaut présent aussi chez Smart Loc.

**Ce qui a été écrit.** `components/vehicle-schema/inspection-types.ts` porte désormais
`tarifDommage(type, zone, catégorie)`, qui rend le montant du contrat. Plus aucun prix
n'est écrit dans ce fichier. `InspectionFlow.tsx` l'appelle par zone, affiche la ligne
du contrat appliquée sous le dégât, et laisse le champ **vide** quand le contrat dit
« sur devis » au lieu de proposer 0 €.

**La correspondance retenue**, la zone tranchant entre vitrage, jante et carrosserie :

| Saisi par l'agent | Ligne du contrat | Citadine | Sportif |
|---|---|---|---|
| Rayure (sur jante) | Rayure par jantes | 300 € | 500 € |
| Rayure (ailleurs) | Rayure légère | 300 € | 500 € |
| Rayure profonde | Rayure profonde | 500 € | 800 € |
| Fissure sur jante | Fissure jantes | 500 € | 800 € |
| Fissure, impact ou casse sur vitrage | Pare-brise, vitre cassé | 1 000 € | 5 000 € |
| Bosse, ou impact et casse sur carrosserie | Dommage carrosserie | sur devis + 30 % | sur devis + 50 % |
| Crevaison, usure pneu | Usure anormale pneu | 400 € | 700 € |
| Salissure | Nettoyage intérieur / extérieur | 50 € | 100 € |
| Manquant | aucune ligne chiffrée | à saisir | à saisir |

**Arbitré par Jeff :** un éclat sur une vitre prend le tarif de remplacement, l'agent
baisse à la main s'il juge le vitrage réparable.

**Reste à décider :** `lib/contracts/damage-rates.ts` est **entièrement mort**, aucun
fichier ne l'importe, et il porte une fausse grille (rayure à 80 €) plus des conditions
de location qui ne sont nulle part. À supprimer, mais c'est la décision de Jeff.

## Interventions et fiche véhicule (étape 8)

**Trois lots, testables l'un après l'autre.** Le cadrage est complet sauf un point.

**Ce qui manque et que Jeff peut préparer sans moi :** la liste des types de dommage.
Elle doit réunir les éléments que l'état des lieux sait déjà facturer, plus les pannes
mécaniques qui ne sont jamais facturées. **Sans cette deuxième famille, une panne
déclencherait à tort l'alerte « réparé sans avoir été constaté ».** La liste des
éléments facturables est à extraire du code de l'état des lieux et à lui faire valider.

**À dresser aussi :** les types d'infraction. Quatre familles retenues (vitesse et
feux, stationnement et circulation, comportement au volant, péage et contrôle
technique), plus tous les autres types existant en France, à tirer des catégories
officielles du code de la route. **Aucun type inventé**, validation de Jeff avant
écriture en base.

## Grilles tarifaires (étape 9)

**Ne pas livrer les grilles sans les brancher.** Le défaut existant : les six champs de
tarifs de l'écran des paramètres sont enregistrés et réaffichés, mais aucun autre
fichier ne les lit. La facturation prend le prix inscrit sur le véhicule. L'écran
annonce 1 € du kilomètre pendant que les factures comptent 2 €.

Trois choses, pas une : créer les grilles, rattacher chaque véhicule à une grille,
faire lire la grille par la facturation. **Deux jours.**

## Campagnes e-mail (étape 10)

**À vérifier avant de le promettre à Jeff :** les taux d'ouverture et de clic ne
dépendent pas du logiciel mais de ce que Resend accepte de remonter sur son compte. Le
reste (destinataires, personnalisation, aperçu, historique) ne pose pas de question.

## Facture de restitution modifiable

Trois montants repris à la main au moment de l'aperçu, avant envoi : les dommages, les
frais de retard jusqu'à hauteur du prix calculé, et le prix lui-même pour une remise
exceptionnelle. **Réservé au gérant et aux associés** : aucun autre rôle ne voit ces
champs.

## Notification « Document expire bientôt »

**Le préalable est une modification de la base.** La table `documents` ne porte aucun
lien vers un véhicule, seulement une catégorie et parfois une réservation. Tant que ce
lien n'existe pas, le clic ne peut pas mener au bon endroit.

À ne pas confondre avec ce qui a été livré le 30/07 : les alertes de contrôle
technique, d'assurance et de révision ouvrent désormais la page de modification du
véhicule, là où leurs dates se corrigent. Ce sont des dates portées par le véhicule,
pas des documents.

---

# Ce qui attend une décision de Jeff

**Le classement urgent contre important.** Aucune règle écrite aujourd'hui, chaque type
d'alerte décide pour lui-même. Deux exemples qui se discutent : « Contrat à signer »
est urgent alors que le départ peut être dans huit jours ; « Départ du jour » n'est
qu'important alors que c'est aujourd'hui. Une demi-heure une fois la règle donnée.

**Les 7 notifications restantes.** 28 sur 35 sont passées au format trois lignes.
Restent volontairement à part le résumé des échéances de l'agence, le regroupement des
débiteurs et le programme du jour, qui sont des listes. À confirmer qu'on les laisse
ainsi.

**La facturation des infractions au client.** Chantier entier, jamais placé dans
l'ordre : montant, type d'infraction modifiable pour coller à l'avis reçu, frais de
dossier au pourcentage prévu au contrat selon le type de véhicule, envoi depuis la
fiche infraction avec aperçu et lien de paiement.

**Les remarques du simulateur.** Le stockage lu le 30/07 est vide sur les deux
navigateurs pilotés : elles sont dans Chrome for testing, hors de portée. Jeff les
colle, ou il ouvre le simulateur depuis le menu dans la fenêtre pilotée.
