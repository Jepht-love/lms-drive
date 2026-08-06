# Les modifications à effectuer

> **▶ Le plan d'exécution est dans `PLAN-REMARQUES.md`**, écrit le 01/08/2026 au soir :
> les 21 remarques ouvertes regroupées par onglet, avec leur cause vérifiée, le geste et
> la durée. **C'est lui qu'on suit pour travailler.** Ce document-ci reste la liste
> brute et l'historique des décisions.

Liste tenue au fil de l'eau, ouverte le 01/08/2026. Chaque ligne dit ce qui change
pour l'utilisateur, pas comment c'est fabriqué. L'ordre de traitement suit celui
que Jeff donne, pas celui de cette liste.

**État du dépôt au moment d'écrire : tout est poussé sur `main` jusqu'à `2f45274`.**
Rien n'attend dans l'arbre de travail.

---

## 1. Où en sont les remarques du simulateur

Elles vivent dans son outil d'annotation (`/simulateur.html`, clé `lms_remarques`
du navigateur). **42 posées, 22 livrées, 20 ouvertes.** Chaque remarque livrée est
marquée `✅ FAIT (<commit>)` en tête de son texte, dans l'outil : c'est comme ça
qu'il voit ce qui reste, il ne faut pas attendre qu'il le demande.

⚠️ **Les remarques ne suivent pas d'un navigateur à l'autre.** Elles sont rangées
dans le navigateur qui les écrit. Celles du simulateur en ligne et celles du
simulateur local sont deux listes différentes.

### Livrées le 01/08/2026

| N° | Ce qui a changé | Commit |
|---|---|---|
| 35 | Un dommage déjà déclaré se corrige, par un crayon sur sa ligne | `b56dbdf` |
| 37 | La bande des jours se pousse librement, calendrier et accueil | `3014373` |

### Le chantier en cours : la remarque 38

Le gros morceau des interventions au garage. **Décidé avec Jeff, à exécuter d'un
seul tenant** (il ne veut pas de livraison par morceaux) :

- **A. L'heure du rendez-vous.** Toute intervention est aujourd'hui posée à 8 h du
  matin, écrit en dur dans `lib/actions/maintenance.ts`. Ajouter l'heure à côté de
  la date ; le créneau « RDV garage » du calendrier la reprend. Aucun changement de
  base.
- **B. L'intervention en cours, puis clôturée.** Deux états remplacent le couple
  devis/facture, **qui disparaît du vocabulaire de l'écran** (décision de Jeff).
  Tant qu'elle est en cours, tout se modifie : date, heure, garage, kilométrage,
  montants, dégâts rattachés. **La clôture verrouille et écrit la comptabilité**,
  ce que fait aujourd'hui `settleIntervention` à la saisie du montant. Demande une
  migration : la contrainte de `maintenance_records.quote_status` n'accepte que
  `brouillon`, `valide`, `annule`.
- **C. Plusieurs véhicules dans un rendez-vous.** Un « + » ouvre la liste des
  véhicules avec leurs dégâts déclarés. **Arbitrage de Jeff du 01/08/2026, après
  proposition contraire à son premier choix : une seule ligne dans le calendrier
  portant les N voitures, et une intervention séparée par véhicule dans Suivi
  véhicule.** Chacune se clôture quand son garage a fini. Sans ça, un garage qui
  rend une voiture le mardi et les trois autres le vendredi bloquerait la
  comptabilité jusqu'au vendredi. `calendar_events.vehicle_ids` est déjà un
  tableau, il n'y a rien à inventer côté calendrier.
- **D. Quatre rendez-vous sur le même créneau, en vue jour.** **À vérifier avant de
  coder** : `layoutEvents` (`components/calendar/MobileCalendar.tsx`) place déjà les
  événements en colonnes quand ils se chevauchent. Si c'est le cas, il n'y a rien à
  faire. Sur téléphone la vue jour est une liste depuis la remarque 30, la question
  ne s'y pose pas.

### Les quatre remarques du soir

- **39 — Les immobilisations.** Pouvoir mettre un véhicule en immobilisation depuis
  l'onglet Immobilisations, par un « + » et un petit formulaire sur le type. Le
  statut du véhicule suit tout seul : maintenance, réservé, hors service, fourrière,
  non restitué, déplacement professionnel. Même automatisme que le retour d'une
  location. Sa phrase à garder en tête : « créer une fluidité et pas complexifier la
  tâche via 50 onglets remplis de technologie qui ne seront jamais utilisés ».
- **40 — Les déplacements**, cinq demandes en une :
  1. Choisir le véhicule comme sur une réservation : voir s'il est libre, et les
     créneaux entre deux locations pour caser un déplacement d'une heure. Placé
     juste sous « Démarrer maintenant », un mois de visibilité, au-delà le calendrier.
  2. Le libellé « HK-347-GV Rdv pro Marich Toulassi · 28/07/2026 23:01 » : modèle en
     grand, plaque en petit, et les autres informations en dessous.
  3. Modifier un déplacement, et lui ajouter une date de fin.
  4. **Le gérant peut modifier un déplacement, Jeff non, sur le même écran.** Cause
     à chercher, sans doute une différence de rôle.
  5. **Bug, marqué urgent par lui, remonté par le gérant : un véhicule en
     déplacement reste affiché disponible sur sa fiche.** C'est le seul point de la
     40 qui fait mentir un chiffre montré au gérant.
- **41 — Les notifications, à reprendre en entier.** Une notification annonçait un
  rendez-vous en retard alors qu'il s'agissait d'un **départ** en retard. Il ne veut
  pas la correction de ce cas seul : **rouvrir les 35 notifications du logiciel et
  les revérifier une par une**, comme cela avait été fait le 30/07/2026 pour leur
  format à trois lignes. Une capture est jointe à la remarque.
- **42 — Le paiement d'une réservation**, deux points :
  1. En bas de la fiche, après la saisie du montant versé par le client, afficher
     **« Reste à payer x € »** ou **« Paiement effectué x € »**. Le calcul se fait à
     la saisie, et le message dit si le client a tout réglé. Ses mots : « quelque
     chose de simple ». Remontée par le canal SAV depuis
     `/reservations/f7280e1b-fd4b-48f7-bbf0-82f4868ba110`.
  2. **La confirmation d'une réservation redemande l'acompte**, alors qu'il a déjà
     été saisi et calculé à la création. **À retirer de l'écran de confirmation.**

### Les 15 autres remarques ouvertes

**Suivi véhicule et interventions**
- **#2** l'état mécanique du véhicule sans les montants, juste le dommage
- **#3** l'intervention n'est pas modifiable et ne dit rien du véhicule (recoupe la 38)
- **#23** le pneu rangé en carrosserie, et les tirets anglais à supprimer

**Calendrier**
- **#19** la vue tablette sur mobile quand on sélectionne une date
- **#25** sur iPhone 17 Pro Max, un écran mal ajusté et la barre « LMS Drive » devant
- **#29** supprimer le code couleur lié au type
- **#30** le format de la liste quand on clique un jour en vue mois
- **#31** taille à réduire de moitié (sa deuxième partie, le défilement, est livrée)

**Une par onglet**
- **#7** véhicules : sur iPhone, réduire la taille pour voir les autres colonnes
- **#8** réservations : l'acompte bloque la voiture sur une période
- **#9** infractions : envoyer la facture au responsable identifié
- **#11** infractions : envoi par e-mail avec aperçu de la facture avant envoi
- **#10** documents : page d'erreur au clic, à remettre au format des autres
- **#12** accueil : la barre du logo et de la date doit rester en haut
- **#36** la fluidité, **reportée par Jeff à une prochaine session**

## 2. Rendre l'application instantanée — REPORTÉ

**Ce qu'il constate :** un changement de statut de tâche fait attendre. Mesuré en
local le 01/08/2026 : 6 secondes entre le clic sur « Enregistrer » et la ligne qui
se met à jour. En ligne ce sera moins, mais perceptible.

**La cause :** partout, l'écran attend la réponse du serveur avant de se redessiner.

**La règle décidée avec Jeff, à ne pas déborder le jour où on s'y met :**

> Instantané uniquement sur ce qui est réversible et sans conséquence financière :
> un statut, une case, un libellé. **Jamais sur l'argent ni sur les pièces qui font
> foi** : une réparation, une facture, un état des lieux, une caution, une
> suppression. Là, on attend le serveur et on l'assume.

**Ce qui rend l'opération sûre ici :** les notifications d'avancement de tâche
partent du serveur, après écriture réussie, et seulement si le statut a réellement
changé (`app/api/calendar/events/[id]/route.ts`). Peindre l'écran en avance ne peut
donc pas déclencher une fausse notification à l'équipe, et c'est aussi ce qui
prévient tout le monde quand deux personnes touchent la même tâche.

**Périmètre prévu :** le calendrier et les tâches d'abord, ses deux exemples.
Ensuite la même règle à chaque écran rouvert, sans chantier séparé. Tout reprendre
d'un coup touche une quarantaine d'écrans déjà validés par le gérant.

## 3. Ce qui a été livré aujourd'hui, pour mémoire

- **Lot 2 du chantier comptable** : l'intervention porte ses dégâts, une écriture
  comptable par dégât réparé, avec son origine et son type.
- **Lot 3** : l'onglet « Dégâts et réparations » en comptabilité (`83feeb6`), qui
  met le facturé au client face au payé au garage, ventilé par origine.
- **Le simulateur** entre dans le dépôt et s'ouvre en ligne (`2f45274`), visible du
  seul super-administrateur.

## 4. Le ménage repéré, pas encore fait

- **Deux chemins pour changer le statut d'une tâche**, chacun avec son envoi de
  notification : `app/api/calendar/events/[id]/route.ts` (utilisé) et
  `app/api/calendar/events/[id]/status/route.ts` (appelé de nulle part). Sans effet
  aujourd'hui ; le jour où quelqu'un rebranche le second, une seule action enverra
  deux notifications. **À supprimer**, quand Jeff le dit.
- **`resolveVehicleIssue` et `setDamageQuote`** ne sont plus appelés depuis que la
  réparation passe par une intervention. À supprimer une fois la 38 finie.
- **Le bloc « tarifs par défaut » des paramètres ne pilote rien.** Les six champs
  sont enregistrés et réaffichés, mais aucune facture ne les lit : le prix vient du
  véhicule. Le gérant peut croire changer ses tarifs sans aucun effet. Défaut réel,
  qui touchera aussi Smart Loc.

## 5. Ce qui reste ouvert et ne se corrige pas tout seul

- **Balayer les fenêtres de l'application.** Celle du calendrier était enfermée dans
  la bande du milieu de l'écran et impossible à fermer sur iPhone, corrigé le
  01/08/2026. Toutes les fenêtres bâties sur le même modèle ont probablement le même
  défaut. **Non balayé.**
- **Les réparations d'avant le 01/08/2026 sont absentes du nouvel onglet compta.**
  Elles ont été soldées dégât par dégât, sans intervention, donc sans origine. Leur
  en poser une à la main toucherait des écritures existantes : Jeff n'a rien
  demandé.
- **L'onglet « Mises à jour »**, où le client voit chaque dimanche ce qui a changé et
  choisit d'appliquer maintenant ou de reporter d'une semaine. Chantier de 4 à
  6 jours, placé après la livraison de Smart Loc.

## 6. À signaler à Jeff, toujours ouvert

- **Ses recettes « Km supplémentaires » totalisent 119 326 €** contre 6 450 € de
  locations, sur la réservation RES-2607-2595 (59 661 km facturés à 2 €). **Il a
  refusé le ménage en base le 01/08/2026** : ne rien supprimer sans qu'il le
  redemande.
- **Une dépense de 320 € du 01/08** vient d'un test de bout en bout sur le dégât
  d'essai « Porte avant droite ». Même décision : on n'y touche pas.

## ⚠️ Priorité (décidée le 05/08/2026)

Les remarques **#13 à #24** viennent de retours pris **avec le gérant en direct** :
elles ont un **poids de priorité supérieur** au `PLAN-REMARQUES.md`. Ce n'est pas un
ordre strict « tout #13-24 avant tout le plan » : c'est une **règle d'arbitrage** —
**en cas de choix entre une modif du plan et une des #13-24, la #13-24 l'emporte.**
Plusieurs recoupent d'ailleurs l'ancien plan et le ferment en même temps :
#13 = 38.C, #15 = 38.E, #23 touche #8.

## 7. Nouvelles remarques du 03/08/2026 (relevées du simulateur, clé `lms_remarques`)

Cinq remarques ajoutées par Jeff, encore à faire. Les douze autres de la même
série sont marquées ✅ FAIT dans son outil.

- **#13 · Intervention à plusieurs véhicules** (`/maintenance/…/new`). Quand on
  ajoute un deuxième véhicule à une intervention, seul le premier passe en
  immobilisé. **Tous les véhicules d'une intervention doivent passer en
  immobilisation**, pas seulement un.
- **#14 · Comptabilité, pièces justificatives** (`/accounting`). Rattacher chaque
  mouvement +/- à sa pièce : contrat de location, facture garage, facture de
  restitution… **Chaque mouvement doit porter son document.**
- **#15 · Clôture d'un déplacement** (`/internal-trips`). Clôturer n'importe quel
  déplacement, professionnel ou réparation, **doit remettre le véhicule en
  disponible**.
- **#16 · Réservation immédiate** (`/reservations/new`). La réservation ne sert
  aujourd'hui qu'au futur. Ajouter un mode **« Départ »** pour une location qui
  commence maintenant : au clic, **la date et l'heure sont déjà préremplies**.
- **#17 · Alertes** (`/alerts`). Pouvoir **supprimer une alerte à la main** en cas
  de rush, quand on n'a pas le temps de clôturer la tâche qui l'a déclenchée.

## 8. Remarques du 04/08/2026 (#18 à #24, relevées du simulateur)

Sept remarques ajoutées. **Plusieurs sont de gros chantiers** (refonte du menu au
format shadcn, rubrique « En cours », geste de retour par glissement), pas des
corrections rapides : à cadrer avant de lancer.

- **#18 · Heures / fuseau** (`/`, `/calendrier`). Jeff a cru voir un décalage
  horaire. **Vérifier que toutes les heures affichées sont en heure française**,
  pas en temps universel. Rejoint le piège connu `BUSINESS_TZ` (heures mises en
  forme côté serveur).
- **#19 · Menu horizontal au format shadcn** (zone dessinée sur `/`, 283×843 px).
  Faire tomber la barre de menu verticale à l'horizontale, style `ui.shadcn.com` :
  les **3 tirets** pour ouvrir le menu, le **« ? » du SAV** passé de l'autre côté,
  la **date** aussi, le tout vraiment interactif. **Ajouter un onglet « Départ »**
  (logo ⏱️) entre Réservation et Calendrier. Demande d'ensemble : **appliquer le
  design shadcn à l'application.**
- **#20 · Onglet « Départ » = départ instantané** (`/reservations/...`). Précision
  sur la #16 : le « Départ » est une location qui **démarre maintenant**. Garder la
  fonctionnalité, mais dans le **nouvel onglet Départ**, pas dans Réservations
  (qui reste pour le futur).
- **#21 · Rubrique « En cours » sur le tableau de bord** (zone dessinée sur `/`,
  1142×98 px). Une tâche du jour a un bouton **« démarré »** ; démarrée, elle
  bascule dans **« En cours »**. Un **pop-up** la suit sans quitter le tableau de
  bord (ex. un déplacement affecté : le collaborateur reçoit la notification, clique
  démarrer, ouvre le pop-up, remplit les détails, clôture). **Démarrer / terminer
  une tâche ou une intervention met le véhicule disponible ou immobilisé**
  automatiquement. Une tâche non démarrée bascule en alerte. But : centraliser la
  décision pour les collaborateurs, sans les envoyer dans tous les onglets. Format
  shadcn.
- **#22 · Complément #21** (`/`). Rappelle aussi la suppression manuelle des
  alertes (déjà #17), motif : le rush.
- **#23 · Acompte** (`/reservations/...`). Trois boutons acompte → **n'en garder
  qu'un**, à la création de la réservation ; supprimer le pop-up des deux autres.
  Dans « Paiement de la location », **griser l'acompte** (déjà saisi à l'étape
  précédente) et **déduire son montant du total**.
- **#24 · Retour par glissement** (toute l'app). Ajouter le geste **swipe depuis le
  bord gauche vers la droite** pour revenir à l'écran précédent (comme iOS natif,
  Snapchat, LinkedIn), **interactif** et **restaurant l'état** de l'écran précédent
  (défilement, données). À poser globalement sur toutes les pages compatibles, et
  **retirer le bouton retour** qu'il remplace.

## 9. Remarque du 05/08/2026 (#25)

- **#25 · Prévisu contrat : adresse client + KM illimité** (`/contracts/[id]/preview`).
  Deux trous **dans la prévisualisation** : le bloc Locataire n'affichait aucune
  adresse (le PDF, lui, l'a toujours) ; le KM illimité affichait « 200 » (le forfait
  stocké) au lieu de « Illimité ». **FAIT** : la prévisu montre l'adresse complète
  (rue, code postal, ville) et écrit « Illimité ». Le PDF rendait déjà les deux
  correctement (adresse ligne 799, « Illimité » ligne 870) : rien à y changer.
  **Balayage du même défaut ailleurs** (le forfait affiché au lieu d'« Illimité ») :
  corrigé aussi sur la **fiche contrat**, la **fiche réservation** (qui masque en
  plus le « Supplément KM » sous illimité) et le **récap de signature de l'EDL**
  (via `contratInfo`, pages départ + arrivée, champ `kmIllimite` ajouté à `ContratInfo`).
  Le **calcul** de l'EDL retour était déjà bon (0 € facturé, « Non facturé »).
  Adresse confirmée à l'écran ; l'état « Illimité » reste à voir sur un contrat qui
  porte l'option (aucun des 14 contrats actuels ne l'a). À tester avant de pousser.

## 10. Remarques du 05/08/2026 (#26 à #28)

- **#26 · Recherche client : signaler le téléphone manquant** (recherche client).
  Aujourd'hui la recherche indique déjà les infos manquantes d'une fiche ; ajouter
  le **numéro de téléphone** à cette liste. À trancher avant de coder : est-ce un
  simple avertissement, ou le téléphone absent doit-il **bloquer la location**
  (comme « dossier incomplet ») ? Toucher `lib/clients/completeness.ts` change les
  deux à la fois — attention à ne pas re-bloquer des réservations.
- **#27 · Prix de l'option illimité non détaillé + adresses** (écran à préciser).
  On voit « prix/jour, km illimité, total 360 € » sans **le prix facturé pour
  l'option illimité** : il faut l'afficher en ligne. Recoupe #25 pour l'adresse
  (locataire incomplète = ville + code postal), mais **ajoute** l'adresse du
  **loueur absente sur un écran**. La prévisu montre déjà le prix illimité dans le
  détail et l'adresse complète (fait en #25) : **demander à Jeff sur quel écran** il
  a vu ça (fiche réservation ? confirmation ? PDF ?) avant de corriger.
- **#28 · Section « Non finalisé ⏳ » : brouillon de réservation auto-enregistré.**
  Une location commencée doit être **sauvegardée à chaque page** : véhicule, nom,
  prénom, prix… Si la tablette s'éteint, on reprend aux dernières sélections sans
  redemander les mêmes infos au client. Une section « Non finalisé » liste ces
  réservations en cours. **Gros chantier, plan requis** (où stocker le brouillon,
  quand il expire, comment il se reprend, quand il devient une vraie réservation).
