# Le plan de travail

Deux sources, fusionnées par onglet, dans l'ordre du menu.

- **`G` · Le gérant**, 27 demandes reçues le 02/08/2026 par notes vocales. **Elles passent
  devant tout** (décision de Jeff du 02/08, et règle du §7 du CLAUDE.md : une remontée du
  gérant en usage réel passe devant le reste).
- **`J` · Jeff**, 11 remarques ouvertes sur 44 dans son simulateur : 8, 9, 10, 11, 38, 39,
  40, 41, 42, 43, 44.

Chaque ligne dit ce qui est demandé, l'état vérifié dans le code au 02/08, et le geste.

**Ce qui est tranché et ne se rouvre pas** : les mots devis et facture restent (décision du
01/08 au soir). Les arbitrages sont rassemblés en fin de document.

---

## L'ordre de travail

| Quand | Quoi | Source |
|---|---|---|
| **En premier** | Le véhicule en déplacement affiché disponible | J · 40 |
| **Ensuite** | Les 27 demandes du gérant, onglet par onglet | G |
| **Enfin** | Les remarques de Jeff restantes | J |

**Pourquoi le véhicule en déplacement passe avant tout** : c'est le seul point de toute la
liste qui fait mentir un chiffre montré au gérant, et il coûte trois heures.

---

# 1 · TABLEAU DE BORD

## J · 45 · Les textes doivent rester alignés

**Ce que Jeff voit.** Sur les lignes du tableau de bord, les textes se décalent d'une ligne
à l'autre, « ça crée un désordre pas possible ». **« À assigner » doit toujours occuper la
troisième ligne**, et l'ensemble rester justifié.

**Ce qui existe déjà.** Le format commun des lignes à trois niveaux a été livré le 30/07
(`96fb5c6`), et les notifications ont suivi le même format (`f32d18e`).

**La cause probable, à confirmer à l'écran** : quand une information manque sur une ligne
(pas de client, pas de véhicule, personne d'assigné), la ligne suivante remonte et l'ensemble
se désaligne. **Le geste** : la troisième ligne existe toujours, même vide, et « À assigner »
s'y écrit systématiquement.

## G · Les tâches du jour et les alertes doivent être complémentaires

**Ce qu'il demande.**

1. Une tâche planifiée dans la journée, **dépassée et non réalisée**, quitte « Tâches du
   jour » et passe dans « Alertes ».
2. Une tâche **réalisée** quitte « Tâches du jour » sans passer par les alertes. ✅ **déjà
   le cas**, elle n'est plus « à faire ».
3. Dans tous les cas, l'événement **reste visible dans le calendrier**. ✅ **déjà le cas.**

**L'état réel, vérifié.** « Tâches du jour » couvre la journée métier, de 7 h à 3 h du
matin (`app/(dashboard)/page.tsx` ligne 513). Une tâche dont l'heure est passée **y reste
en rouge jusqu'à 3 h**. Les alertes ne prennent que les journées précédentes
(`lib/utils/alerts.ts` ligne 290, `lt(due_datetime, minuitCeMatin)`).

**Ce n'est pas un oubli, c'est une règle écrite** et commentée dans le code. Le gérant
demande de la changer : la bascule se fait à l'heure dépassée, plus à minuit.

**À ne pas confondre avec la demande de Jeff ci-dessous** : celle du gérant fait *entrer*
la tâche dans les alertes, celle de Jeff décide *dans quel bloc* elle tombe une fois
entrée. Les deux se suivent et se traitent ensemble.

---

# 2 · CALENDRIER

## J · 44 · L'écran des disponibilités

**Où.** `/calendrier/disponibilites`.

1. **La flèche retour et le titre collent au bord de l'écran.** Il manque la marge que
   portent les autres écrans.
2. **Les dates n'y défilent pas** comme sur le tableau de bord. La bande des jours qui se
   pousse librement a été livrée le 01/08 sur le calendrier et l'accueil (`3014373`),
   **mais pas ici**.

**Le geste.** Reprendre la bande de dates de l'accueil telle quelle. **Ne pas la
réécrire** : trois versions ont été nécessaires avant de tomber sur le bon comportement (la
bande se pousse et ne change pas la journée affichée ; on tape une date pour ça).

---

# 3 · RÉSERVATIONS ET ÉTATS DES LIEUX

## G · La facturation du retour

**Ce qu'il demande.** Après avoir facturé au retour de l'état des lieux, voir la trace de
ce qui a été facturé. Son exemple : un lavage à 50 € qui n'apparaît nulle part sur la page
du retour. Le montant doit **s'accumuler au forfait**, puis un bouton **Enregistrer**
comptabilise le tout.

**L'état réel, vérifié.** ✅ **Déjà corrigé**, commits `62fc004` et `5c049f1`.
`components/inspection/InspectionFlow.tsx` affiche maintenant le forfait de location, chaque
frais **sous son vrai nom** (un lavage n'est plus rangé dans « Dommages constatés »), le
total à payer (forfait + frais) et le reste dû. Le commentaire ligne 654 décrit mot pour mot
le défaut qu'il signale.

**Il a testé une version d'avant. À lui faire revérifier.**

❓ **Non vérifié** : le bouton qui comptabilise le tout à la fin. À regarder à l'écran.

## G · Le kilométrage illimité

**Ce qu'il demande.**

1. Une case à cocher « Kilométrage illimité » au départ ou sur la réservation.
2. Cochée, un encart s'ouvre pour saisir le montant facturé.
3. Le montant est modifiable, **y compris 0 €** (une Smart ou une C3 l'ont inclus, une BMW
   se facture).
4. Le montant entre dans le calcul du prix de la réservation.
5. Il apparaît sur le contrat et sur le récapitulatif de location.

**L'état réel, vérifié : ❌ rien n'existe.** Aucune trace de kilométrage illimité dans le
code.

## Comment ça marche, tranché par Jeff le 02/08

**Le prix vit dans la grille tarifaire, pas dans la réservation.** Chaque véhicule y porte
**quatre prix d'illimité**, calés sur les quatre formules de location : jour semaine, jour
week-end, forfait week-end, semaine de 7 jours. Un illimité à la semaine ne coûte pas sept
fois celui d'une journée, exactement comme le forfait week-end n'est pas deux fois le prix du
jour.

**Les cases sont vides par défaut**, et le vide a un sens :

| Valeur | Ce que ça veut dire |
|---|---|
| **Vide** | L'option n'est pas proposée sur ce véhicule |
| **0 €** | L'option existe et est offerte (une C3 dont l'illimité est inclus) |
| **60 €** | L'option existe à ce prix, pour cette formule |

**À la réservation** : une case à cocher. Cochée, le logiciel prend le prix de la formule
déjà choisie (trois jours en semaine, un week-end complet, une semaine) et l'ajoute au
total. **Personne ne choisit quel prix appliquer**, il découle des dates.

## ⚠️ Le vrai travail : ce qui s'éteint, et ce qui ne s'éteint surtout pas

**Ce qui s'éteint : la FACTURATION du dépassement, et elle seule.** Avec l'illimité, aucune
ligne « kilomètres supplémentaires » n'apparaît sur la facture de restitution, quel que soit
le compteur au retour. Les kilomètres inclus sont portés par le véhicule
(`vehicles.km_included_daily`) et recopiés sur la réservation à sa création
(`lib/actions/reservations.ts` ligne 495) ; l'état des lieux de retour compare ensuite le
compteur et facture le dépassement. **Si ce calcul continue de tourner, le client paie
l'illimité ET ses kilomètres en trop.**

**Ce qui reste, toujours (précision de Jeff du 02/08) : le relevé du compteur au départ et au
retour.** Il n'a rien à voir avec la facturation. C'est lui qui fait vivre le suivi du parc :
l'évolution du kilométrage réservation par réservation, la mise à jour de
`vehicles.current_km` (`components/inspection/InspectionFlow.tsx` ligne 470), les échéances
d'entretien et le contrôle technique. **Ne jamais le désactiver, même sous illimité.**

En résumé : on relève toujours, on ne facture pas.

**Le contrat et le récapitulatif de location** portent la mention, avec le montant.

## J · 42 · Le paiement d'une réservation

Remontée par le canal SAV.

1. **Le reste à payer.** En bas de la fiche, après la saisie du montant versé :
   « Reste à payer x € » ou « Paiement effectué x € ». Ses mots : « quelque chose de
   simple ». Depuis `/reservations/f7280e1b-fd4b-48f7-bbf0-82f4868ba110`.
2. **L'acompte redemandé à la confirmation**, alors qu'il a été saisi à la création. À
   retirer de l'écran de confirmation. **Vérifier d'abord qu'il n'y sert pas à autre
   chose**, par exemple pour une réservation créée sans acompte.

## J · 8 · L'acompte bloque la voiture

Un acompte de 20 % du montant bloque le véhicule pour une durée proportionnelle, avec un
compte à rebours visible.

**Tranché le 01/08 : rien d'automatique.** À zéro, une alerte part au gérant, **il décide**
de libérer ou de prolonger. Aucune réservation ne disparaît seule, aucun acompte n'est
acquis sans décision humaine. Le véhicule reste bloqué tant que rien n'est fait : un
véhicule libéré par erreur coûte plus cher qu'un véhicule bloqué un jour de trop.

---

# 4 · CLIENTS · rien à faire

---

# 5 · VÉHICULES

## J · 39 · Créer une immobilisation depuis son onglet

Un « + » dans l'onglet Immobilisations ouvre un formulaire : véhicule, type
(maintenance, réservé, hors service, fourrière, non restitué, déplacement professionnel),
date de fin prévue, motif. **Le statut du véhicule suit tout seul.** Ses mots : « créer une
fluidité et pas complexifier la tâche via 50 onglets remplis de technologie qui ne seront
jamais utilisés ».

**Ce qui existe déjà.** L'écran `/vehicles/immobilises` connaît les six types, et le bouton
de changement de statut existe sur la fiche véhicule (`VehicleStatusButton`). **Il manque le
raccourci depuis l'onglet lui-même.**

---

# 6 · SUIVI VÉHICULE

Le plus gros bloc des deux listes. Volet Entretien pour les interventions, volet Infractions
pour les contraventions.

## G · Le suivi complet d'une intervention · LE GROS MORCEAU

Son exemple : BMW M135i GW-026-JD, plaquettes de frein.

**Ce qui existe déjà, vérifié le 02/08.** La refonte du 01/08 (`1666969`) a livré **le suivi
de l'argent** : l'intervention porte ses dommages, son devis par dégât, son règlement et sa
ventilation comptable. La table `maintenance_records` contient véhicule, type, description,
date, kilométrage, montant, garage, facture, notes, règlement, devis et location liée.

**Ce qui n'existe pas : le suivi du travail.** Aucune colonne pour ce qui suit.

| Sa demande | État |
|---|---|
| Véhicule et type à la création | ✅ fait |
| **Degré d'urgence ou priorité** | ❌ |
| **Date limite** | ❌ |
| **Personne assignée** | ❌ |
| **L'intervention entre dans les Alertes selon son urgence** | ❌ |
| **Prise en charge volontaire, avec « Pris en charge par… »** | ❌ |
| **Six statuts : à traiter, prise en charge, rendez-vous programmé, en cours, terminée, annulée** | ❌ |
| À la clôture : garage, date, kilométrage, coût total, observations, facture | ✅ fait |
| À la clôture : **pièces remplacées, prix des pièces, prix de la main d'œuvre** | ❌ |
| **L'alerte se ferme à la clôture** | ❌ impossible, elle n'entre jamais |
| L'intervention reste dans l'historique du véhicule | ✅ fait |

**Ce que ça demande en base** : urgence, date limite, personne assignée, statut de suivi,
prix des pièces, prix de la main d'œuvre, et la liste des pièces remplacées.

**Ce chantier absorbe la remarque 38 de Jeff** : ils demandent tous deux que l'intervention
devienne modifiable et suivie. À traiter d'un seul tenant avec les points ci-dessous.

## J · 38 et 43 · Les interventions au garage

### 43 · Deux lignes pour un seul rendez-vous garage

**Ce que Jeff voit.** Deux lignes « 08:00 RDV GARAGE Renault Captur · HF-760-LS » pour un
seul passage au garage sur une seule voiture, parce que les réparations sont de types
différents.

**La cause, vérifiée.** `lib/actions/maintenance.ts` ligne 160 : chaque intervention crée son
propre créneau au calendrier. Rien ne les regroupe.

**Le geste, tranché le 01/08.** Le créneau cesse d'appartenir à une intervention et devient
le passage au garage lui-même. Avant d'en créer un, on cherche s'il en existe déjà un ce
jour-là pour ce véhicule ; si oui, on le complète. **Suivi véhicule continue d'afficher
chaque intervention séparément, avec son propre montant.**

**À traiter avec** : la suppression d'une intervention efface aujourd'hui le créneau
(ligne 241). Avec un créneau partagé, elle doit seulement en retirer son véhicule, et
n'effacer le créneau que s'il ne reste personne.

### 38.A · L'heure du rendez-vous

`lib/actions/maintenance.ts` ligne 155 : `T08:00:00` en dur, tous les rendez-vous sont posés
à 8 h. Un champ heure à côté de la date, prérempli à 8 h (`TimePickerField` existe déjà).
Aucun changement de base.

### 38.B · L'intervention devient modifiable

**La cause, vérifiée.** Le fichier n'expose que quatre actions : créer, supprimer, marquer
payé, régler. **Aucune modification n'existe.**

Un crayon rouvre le formulaire, prérempli. **Dès qu'un montant est saisi, la modification
exige un motif écrit.** Le reste se modifie librement.

**Ce qu'il ne faut pas casser** : une intervention réglée a produit des écritures comptables
portant la référence `maintenance:<intervention>:<dégât>`. Modifier son montant après
règlement doit corriger l'écriture, pas en créer une seconde.

**Rappel du 01/08 au soir** : les mots devis et facture restent, les deux états « en cours /
clôturée » sont abandonnés. Ne pas les reproposer.

### 38.C · Plusieurs véhicules dans un rendez-vous

Un « + » ouvre la liste des véhicules, chacun avec son kilométrage prérempli et ses dégâts en
attente. **Une seule ligne au calendrier** portant les N voitures, **et une intervention
séparée par véhicule**. Chacune se clôture quand son garage a fini : sinon un garage qui rend
une voiture le mardi et les trois autres le vendredi bloquerait la comptabilité jusqu'au
vendredi. `calendar_events.vehicle_ids` est déjà un tableau.

### 38.D · Quatre rendez-vous sur le même créneau · RIEN À FAIRE

**Vérifié le 01/08** : `layoutEvents` (`components/calendar/MobileCalendar.tsx` ligne 79)
répartit déjà en colonnes tout ce qui se chevauche. Sur téléphone la vue jour est une liste,
la question ne s'y pose pas.

### 38.E · Le véhicule ne revient jamais disponible

**Trouvé le 01/08, hors remarque.** Créer une intervention met le véhicule en immobilisation
(ligne 170). **Rien ne le remet jamais en disponible.** Un sinistre clos le fait, une mise à
disposition aussi, un entretien non.

Le règlement remet en disponible les véhicules que cette intervention avait immobilisés, sauf
s'ils l'ont été entre-temps pour autre chose.

### 38.F · Les types alignés sur les postes facturables

> Venu de la remarque 3, close, mais l'arbitrage a été pris le 01/08 et reste à exécuter.

**Une seule liste, avec un repère facturable.** Les types d'intervention et les postes de
facture fusionnent. Chaque ligne dit si elle peut être refacturée : dégâts, nettoyage,
carburant et kilomètres supplémentaires oui ; révision, vidange et contrôle technique non.

**Ce qu'il ne faut pas casser** : la correspondance entre un type de dégât et sa catégorie
comptable (`lib/vehicles/damage-catalog.ts`) alimente l'onglet « Dégâts et réparations ». La
liste unique doit la conserver.

### 38.G · Le contrôle des montants

Corriger un montant déjà saisi ouvre une demande. **Rien ne bouge tant qu'un autre gérant ou
associé n'a pas répondu, et personne ne valide sa propre demande** : contrôle anti-fraude
voulu par Jeff, contre les faux justificatifs qui gonflent les factures. Déclenchement
au-delà de **20 % ou 20 €** d'écart, le plus petit des deux. Justification écrite obligatoire,
trace de qui a validé.

**Interrupteur d'agence, éteint par défaut.** Sans personne d'autre pour valider, la
correction passe seule et reste tracée.

## J · 9, 10 et 11 · Les infractions · UN SEUL BLOC

**Regroupées à la demande de Jeff le 02/08** : les trois touchent le même parcours.

### Ce qui existe déjà, vérifié le 02/08

L'envoi fonctionne (`transmitInfractionToClient`, `lib/actions/incidents.ts` ligne 113) : le
mail part, l'infraction passe en « transmis client », l'envoi est tracé. **Mais le mail est
écrit à la main en HTML brut dans l'action** (lignes 135 à 142), au lieu de passer par les
modèles communs de `lib/email/templates.ts`. D'où tout ce qui manque.

⚠️ **Défaut de socle** : ce mail signe `· LMS Drive` **en dur** (ligne 142), et le formulaire
dit « Frais de dossier LMS ». Les deux partiraient tels quels chez Smart Loc.

### Ce qui est demandé

1. **Le mail au format des réservations**, pas un HTML fait à part.
2. **Le prix se fixe à la main**, type d'infraction modifiable selon l'avis réellement reçu,
   frais de dossier.
3. **Une facture au format de la facture de restitution**
   (`lib/pdf/invoice-template.tsx`). **Le détail vit dans le libellé de la ligne** (nature,
   date, heure, lieu, numéro d'avis) : sans lui, le client peut répondre qu'il ne reconnaît
   pas l'infraction. Indispensable en longue durée, où la ligne cohabite avec le carburant,
   les kilomètres et les dégâts.
4. **Aperçu avant envoi.**
5. **La page d'erreur au clic sur le document.** **Piste sérieuse** : les documents sont
   rangés dans un espace privé avec une adresse publique, défaut déjà repéré le 29/07 sur les
   contrats. **Même cause probable, à confirmer.**
6. **Le cas de la longue durée** : une clause permet de **joindre l'infraction à la facture
   de restitution de l'état des lieux retour**, au lieu d'une facture séparée en cours de
   contrat.

### Le message, tranché par Jeff le 02/08 : UN SEUL, sans variante

**Le logiciel ne décide de rien, le gérant décide.** Pas de message différent selon que
l'agence a avancé l'amende ou désigné le conducteur : logique **explicitement écartée**. Le
gérant saisit les lignes et les montants à la main, obtient le PDF, et l'envoie ou le remet
en main propre. **Le bouton d'envoi reste celui d'aujourd'hui.**

> Bonjour [prénom],
>
> Vous trouverez ci-joint votre **facture de restitution liée à une contravention**, relevée
> le [date] avec la [véhicule] ([plaque]).
>
> À ce titre, le règlement de cette contravention vous incombe.
>
> Pour toute question sur le paiement, contactez-nous au [téléphone de l'agence] ou à
> [adresse de l'agence].

**Les coordonnées viennent de la configuration d'agence**, comme dans le mail de réservation.

**Tranché le 01/08 : pas de lien de paiement en ligne.** Aucune passerelle bancaire n'existe.
Le règlement se saisit à la main. **Chantier à part, non ouvert** : il demande un contrat et
des frais, et servirait aussi aux acomptes et aux locations.

### Le contexte métier, pour qui reprend le dossier

Deux situations existent, et **le code les connaît déjà** : `paid_by` vaut `client` ou
`agence`, et la dépense n'est écrite en comptabilité que si l'agence a avancé (ligne 183).

- **L'agence désigne le conducteur.** Obligation du loueur, dans les 45 jours, par le
  formulaire de requête en exonération : administrativement une contestation, mais dont
  l'objet est de désigner qui conduisait. Le client reçoit ensuite son propre avis.
- **L'agence avance l'amende**, et s'en fait rembourser.

**Ce que ça change au message : rien**, par décision de Jeff. Le gérant sait dans quel cas il
est. Écrire cette logique dans le code ferait porter au logiciel une qualification juridique
qu'il n'a pas à trancher.

---

# 7 · CONTRATS · rien à faire
# 8 · DOCUMENTS · rien à faire

---

# 9 · DÉPLACEMENTS

## J · 40.1 · ⚠️ URGENT · Le véhicule en déplacement s'affiche disponible

**À FAIRE EN PREMIER, devant tout le document.**

**Ce que le gérant voit.** Une voiture partie en déplacement professionnel apparaît
disponible sur sa fiche.

**La cause, confirmée le 01/08.** **Aucun code ne pose jamais le statut `deplacement_pro`.**
Démarrer un déplacement ne change pas le statut : le choix d'origine est de superposer
l'information à l'affichage (`fetchActiveInternalTrips`, `lib/vehicles/internalTrips.ts`).
**Trois écrans seulement font cette superposition** : la liste des véhicules, les
immobilisés, le tableau de bord. **La fiche d'un véhicule ne la fait pas** : elle lit le
statut brut, resté « disponible » (`app/(dashboard)/vehicles/[id]/page.tsx`, lignes 217 et
352).

**Le geste.** La fiche applique la même superposition que la liste. **Ne pas écrire le statut
en base** : le commentaire de `internalTrips.ts` explique pourquoi, cela créerait des statuts
orphelins quand un déplacement n'est jamais clôturé.

**Balayage à faire en même temps** : chercher tous les écrans qui affichent un statut de
véhicule sans passer par cette superposition.

## J · 40.2 à 40.5 · Le reste des déplacements

- **Choisir le véhicule comme sur une réservation** : voir s'il est libre, repérer les
  créneaux entre deux locations pour caser un déplacement d'une heure. Sous « Démarrer
  maintenant », un mois de visibilité, au-delà on renvoie au calendrier. **La recherche avec
  créneaux libres existe déjà** (`0d6cf6c`) : la reprendre telle quelle.
- **Le libellé** : modèle en grand, plaque en petit, le reste dessous. **Le format commun des
  lignes existe déjà** (`96fb5c6`).
- **Modifier un déplacement**, et lui donner une date de fin.
- **Le gérant peut modifier, Jeff non**, sur le même écran. **Cause non cherchée**, sans
  doute une condition de rôle qui oublie le super-utilisateur.

---

# 10 · PARTENARIATS · rien à faire

---

# 11 · ALERTES ET NOTIFICATIONS

> **Cet onglet ne figure pas dans `lib/navigation/tabs.ts`**, qui ne liste que les dix
> sections soumises aux permissions. Il n'est atteignable que par la barre du bas. **Ne pas
> l'oublier dans un inventaire.**

## G · Les notifications de tâches entre collaborateurs

Il a testé avec trois appareils et trois profils différents.

| Sa demande | État vérifié le 02/08 |
|---|---|
| L'assigné reçoit une notification personnelle | ✅ fait (`notifierPersonneAssignee`) |
| La tâche n'apparaît que sur son profil | ❓ non vérifié |
| Le clic mène à l'écran où il met en cours, terminé, reporté, annulé | ✅ fait (lien `/calendrier?event=<id>`) |
| Le statut remonte automatiquement à celui qui a assigné | ✅ fait (`notifierAvancement` vers `created_by`) |
| **Une action sur une tâche non attribuée est transmise aux autres** | ⚠️ **à moitié** |

**Ce qui manque précisément.** Quand quelqu'un fait avancer une tâche, tout le monde est
prévenu (diffusion aux gérants, associés et employés, sauf l'acteur). **Mais prendre une
tâche non attribuée sans changer son statut ne prévient personne** : `notifierPersonneAssignee`
n'écrit qu'à la personne assignée. Or c'est exactement le geste qu'il décrit, quelqu'un se
saisit d'une tâche libre et les autres doivent le savoir.

## J · 41 · Les 35 notifications, revérifiées une par une

Une notification annonçait un rendez-vous en retard alors qu'il s'agissait d'un **départ** en
retard. **Il ne veut pas la correction de ce cas seul** : rouvrir les 35 notifications et les
revérifier une par une, comme le 30/07 pour leur format à trois lignes. Capture jointe à la
remarque.

## J · Les tâches en retard se coupent en urgentes et importantes

**Hors remarques, demandé le 02/08.** Aujourd'hui **toutes** les tâches en retard tombent
dans le bloc « important » sous l'étiquette « Tâche en retard » (`lib/utils/alerts.ts`
ligne 299).

**Tranché : c'est le retard accumulé qui décide.** Au-delà de 24 h, la tâche monte en
« urgent » ; en deçà, elle reste « important ». **Personne ne saisit rien.**

**Où** : l'onglet Alertes seulement, le tableau de bord garde son affichage.

**Ce qui rend le geste court** : les trois blocs urgent, important et information existent
déjà (`app/(dashboard)/alerts/page.tsx` lignes 80 à 82) et chaque alerte porte son
`category`. Il n'y a qu'à la calculer au lieu de la figer.

**À ne pas oublier** : la même règle vaut pour les tâches et rendez-vous du calendrier en
retard, traités juste en dessous dans le même fichier. Sinon deux choses également en retard
tombent dans deux blocs différents selon leur provenance.

**Se traite avec la demande du gérant** au tableau de bord : la sienne fait *entrer* la tâche
dans les alertes, celle-ci décide *dans quel bloc*.

---

# 12 · COMPTABILITÉ · rien à faire
# 13 · MARKETING · voir E-mails
# 14 · ÉQUIPE · rien à faire

---

# 15 · E-MAILS · LE MODULE DE CAMPAGNES · CHANTIER NEUF

**Demandé par Jeff le 02/08**, hors remarques. Fonctionnalité à construire.

## Son cahier des charges, mot pour mot

> Le module E-mails doit permettre d'envoyer des communications aux clients, **sans passer
> par un outil externe**.
>
> - Envoi de newsletters.
> - Envoi de codes promotionnels et d'offres commerciales.
> - Envoi d'informations importantes (nouveaux véhicules, changements d'horaires,
>   nouveautés, événements).
> - Possibilité de choisir les destinataires : un client individuel, une sélection de
>   clients, l'ensemble des clients.
> - Personnalisation des e-mails (nom du client, véhicule loué).
> - Prévisualisation de l'e-mail avant l'envoi.
> - Historique des campagnes envoyées : date, destinataires, statut d'envoi, taux
>   d'ouverture et si possible taux de clic.
>
> Cette fonctionnalité permettra de communiquer facilement avec les clients tout en
> proposant un système de fidélisation et de promotion directement intégré au logiciel.

## Ses arbitrages du 02/08

- **Des modèles préparés, texte modifiable.** Trois ou quatre modèles livrés avec
  l'application, à la charte de l'agence. Le gérant change le texte et les images, pas la
  mise en page. **Il ne peut pas produire un mail laid**, et le résultat est le même chez le
  client suivant.
- **Des groupes que le gérant compose.** Il filtre sa base (dernière location, type de
  client, longue durée, montant dépensé) et **voit combien de personnes sont concernées avant
  d'envoyer**.

## Ce qui existe déjà, vérifié le 02/08

- **L'onglet E-mails n'est qu'un historique** de ce qui est parti.
- **L'onglet Marketing gère des campagnes** avec budget, résultats et clôture (table
  `campaigns`, migration 014), **mais il n'envoie aucun mail**.
- **Cinq modèles figés dans le code** (`lib/email/templates.ts`). Leur enveloppe et leur
  charte sont réutilisables telles quelles.
- **Resend** est branché pour les envois unitaires.

**Où le module vit** : l'envoi et l'historique dans E-mails ; la campagne marketing existante
s'y rattache pour le budget et le rendement.

## ⚠️ PRÉALABLE BLOQUANT · L'expéditeur est écrit en dur

Trois valeurs propres à LMS Drive vivent dans `lib/email/config.ts` :

| Ligne | Valeur en dur | Ce qui se passe chez Smart Loc |
|---|---|---|
| 30 | `LMS Drive <no-reply@sas-financial-services.com>` | Ses mails partent signés du nom de son confrère |
| 36 | `marich.toulassi.pro@gmail.com` | Ses mails clients arrivent chez le gérant de LMS Drive |
| 43 | `CLIENT_EMAILS_LIVE = false` | **Aucun mail ne part à un vrai client** |

> **Tranché par Jeff le 02/08 : la redirection reste en place.** On construit et on teste avec
> elle, ce qui est le bon filet : une campagne d'essai arrive chez le gérant et montre
> exactement ce qui serait parti. **La réactivation se fera quand tout sera propre.** Ne pas
> la basculer de sa propre initiative : ce jour-là, contrats, factures et avis d'infraction
> partent aussi pour de bon.
>
> **Pour les essais** : cent mails de test vers la même boîte consomment quand même le quota
> de cent par jour. Tester sur quelques destinataires.

## L'expéditeur, tranché le 02/08 : UN DOMAINE PAR CLIENT

**Chaque client a son propre domaine et son propre sous-domaine d'envoi.** Smart Loc enverra
depuis `no-reply@smartloc.com`.

**La procédure d'installation que ça crée :**

1. **Le client fournit son domaine.**
2. **Un compte Resend par client**, chacun sur son plan gratuit.
3. **Le client pose ses réglages techniques de domaine**, avec une procédure écrite. Modèle
   FleetLive : l'éditeur fournit l'application et la marche à suivre, le client exécute.
4. **L'expéditeur et la boîte de repli rejoignent la configuration du déploiement**, où la
   clé `RESEND_API_KEY` vit déjà. **Pas dans l'écran Paramètres** : un expéditeur qui ne
   correspond pas à un domaine vérifié casse tous les envois, le gérant n'a rien à y faire.

## Les tarifs Resend, relevés le 02/08/2026

**Transactionnel** : gratuit, 3 000 mails par mois, **100 par jour**, 1 domaine. Pro à 20 $,
50 000 mails, sans limite journalière, 10 domaines.

**Marketing**, facturé **au nombre de contacts et non de mails** : gratuit jusqu'à 1 000
contacts, puis 40 $ par mois jusqu'à 5 000.

**Le point de vigilance** : sur le gratuit, les 100 mails par jour sont **partagés avec tout
ce qui part déjà**. Une campagne à 80 clients un jour chargé ferait tomber les mails de
contrat. Le plan Marketing n'entame pas ce quota : c'est lui qu'il faut utiliser.

## ⚠️ Le consentement et le désabonnement · OBLIGATOIRE

Absent du cahier des charges, **validé par Jeff le 02/08**. Envoyer un message commercial
exige l'accord du client et **un lien de désabonnement dans chaque mail**. Ça demande :

- une colonne d'accord sur la fiche client, avec sa date ;
- une case à la création d'un client et sur sa fiche ;
- un lien de désabonnement qui retire le client des envois sans supprimer son compte ;
- l'exclusion automatique des désabonnés de tout groupe de destinataires.

**Les mails de contrat, de facture et d'infraction ne sont pas concernés** : ils exécutent le
contrat. Seul le commercial l'est.

## Les ouvertures et les clics

Resend sait remonter ouvertures, clics, rebonds et désabonnements. Demande de brancher la
remontée d'événements et une table pour les stocker. **Le taux d'ouverture est indicatif**,
pas exact : les boîtes qui bloquent les images le faussent à la baisse, celles qui préchargent
tout à la hausse. À dire au gérant plutôt qu'à laisser croire à une mesure exacte.

**Ce que Jeff veut voir au bout** : le rendement d'un envoi, donc les locations qui suivent,
rattachées à la campagne qui porte le budget.

## Ce qui reste à cadrer

- Les codes promotionnels : un simple texte dans le mail, ou de vrais codes que la réservation
  reconnaît et déduit ? **La deuxième réponse est un chantier à part**, elle touche la
  tarification.
- Combien de modèles au départ, et lesquels ?

---

# 16 · PARAMÈTRES

## G · Les grilles tarifaires par catégorie de véhicule

**Ce qu'il demande.** Une section réservée à l'administrateur et au gérant, pour créer et
modifier **plusieurs grilles tarifaires** : Sportive, Citadine. Chaque grille porte le
kilomètre supplémentaire, le retard à l'heure, le retard à la journée, le carburant, la
caution et la franchise. **Modifiables à tout moment sans intervenir dans le code.**

**L'état réel, et il est plus grave qu'un manque.** Les six champs existent déjà dans
`agency_settings`, exactement ceux qu'il liste (`extra_km_rate`, `late_hourly_rate`,
`late_daily_rate`, `fuel_rate_per_liter`, `default_deposit`, `insurance_deductible`), et
l'écran est bien réservé aux managers. **Mais aucune facture ne les lit.** Vérifié le
28/07 : zéro utilisation hors de `settings/AgencySettingsForm.tsx`, `lib/contracts/agency.ts`
et `lib/actions/agency.ts`. **Le prix appliqué vient du véhicule** (`vehicles.extra_km_price`).

**Conséquence visible** : l'écran affiche 1 € du kilomètre pendant que les factures comptent
2 €. **Le gérant peut modifier ses tarifs en croyant les changer, sans aucun effet.** Il
demande plusieurs grilles alors que la première ne fonctionne pas.

**La solution, donnée par Jeff le 02/08 : brancher les prix aux réservations par catégorie de
véhicule.** Le véhicule porte sa catégorie (citadine, sportive), la grille est portée par la
catégorie, et la facture va chercher la grille de la catégorie du véhicule. Ça règle la
demande du gérant et le défaut existant d'un seul geste.

**Tranché par Jeff le 02/08 : le prix du véhicule gagne toujours.** « Chaque véhicule a son
prix, le prix au kilomètre n'est pas le même. » La grille de catégorie ne l'écrase jamais.

**Ce que la vérification montre : le véhicule porte déjà deux des six éléments.**

| Élément de la grille | Porté par le véhicule ? |
|---|---|
| Kilomètre supplémentaire | ✅ `vehicles.extra_km_price` |
| Caution | ✅ `vehicles.deposit_amount` |
| Retard à l'heure | ❌ personne |
| Retard à la journée | ❌ personne |
| Carburant | ❌ personne |
| Franchise | ❌ personne |

**L'architecture qui en découle :**

1. **Le véhicule prime dès qu'il porte la valeur.** Rien ne change à ce qui facture
   aujourd'hui, donc aucune régression sur les factures déjà émises.
2. **La grille de catégorie sert de valeur par défaut** quand le véhicule n'a rien. Créer un
   véhicule sportif lui pose les tarifs de sa catégorie, que le gérant ajuste ensuite s'il
   veut.
3. **La grille est la seule source pour les quatre tarifs que personne ne porte** : retard à
   l'heure, retard à la journée, carburant, franchise. C'est là qu'elle règle le défaut de
   fond, ces quatre valeurs étant aujourd'hui saisies sans effet.

## La grille se gère elle-même, précision de Jeff du 02/08

**Ce n'est pas une catégorie figée sur le véhicule, c'est une grille qui porte ses voitures.**
Le gérant ouvre sa grille et **ajoute ou retire une voiture depuis la grille elle-même**, sans
passer par la fiche du véhicule.

**Où** : un onglet à l'intérieur de l'écran Paramètres, **pour ne pas allonger un écran déjà
long**. Réservé à l'administrateur et au gérant.

## Les deux niveaux, tranchés le 02/08

**Niveau grille, commun à toutes ses voitures** : retard à l'heure, retard à la journée,
carburant, franchise. Le gérant change une fois, toutes les voitures de la grille suivent.

**Niveau véhicule, propre à chacun, modifié depuis la grille** : les huit valeurs de
tarification que porte aujourd'hui la fiche.

| Valeur | Exemple |
|---|---|
| Prix par jour, semaine | 100,00 € |
| Prix par jour, week-end | 150,00 € |
| Forfait week-end complet | 350,00 € |
| Prix par semaine (7 jours) | 550,00 € |
| Caution | 2 000,00 € |
| Kilomètres inclus par jour | 200 |
| Kilomètres inclus par semaine | 1 200 |
| Supplément au kilomètre | 2,00 €/km |

**La fiche du véhicule garde tout en lecture** (décision de Jeff du 02/08) : les tarifs y
restent visibles, mais ne s'y modifient plus. **Un seul endroit pour changer un prix, l'écran
des grilles.**

## Le format visuel, validé par Jeff le 02/08 : deux présentations

⚠️ **Le piège de cet écran : douze valeurs par véhicule.** Un tableau à douze colonnes ne
tient pas sur un téléphone, et le gérant travaille dessus. **Deux présentations, une par
taille d'écran**, et pas un tableau unique qu'on fait glisser : c'est exactement le défaut
déjà signalé sur la liste des véhicules (remarque 7).

**Téléphone : la voiture se déplie, une valeur par ligne, saisie au pouce.**

```
┌────────────────────────────┐
│ SPORTIVE                   │
│ Retard/h        25,00 €    │
│ Retard/j       120,00 €    │
│ Carburant     2,10 €/L     │
│ Franchise    1 500,00 €    │
├────────────────────────────┤
│ 3 véhicules     [+ Ajouter]│
│                            │
│ ┌────────────────────────┐ │
│ │ BMW M135i        ▾  ✕  │ │
│ │ GW-026-JD              │ │
│ ├────────────────────────┤ │
│ │ Jour semaine  [   100 ]│ │
│ │ Jour week-end [   150 ]│ │
│ │ Forfait W-E   [   350 ]│ │
│ │ Semaine 7 j   [   550 ]│ │
│ │ Caution       [  2000 ]│ │
│ │ Supplément km [  2,00 ]│ │
│ │ Km inclus/j   [   200 ]│ │
│ │ Km inclus/sem [  1200 ]│ │
│ │ Km illimité   [    90 ]│ │
│ └────────────────────────┘ │
│                            │
│   Audi S3        ▾  ✕      │
│   Golf GTI       ▾  ✕      │
└────────────────────────────┘
```

**Tablette et ordinateur : tout visible d'un coup, on compare et on corrige dans les cases.**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SPORTIVE                                                    [+ Ajouter]    │
│ Retard/h 25,00 €   Retard/j 120,00 €                                       │
│ Carburant 2,10 €/L   Franchise 1 500,00 €                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ Véhicule      J.sem  J.W-E   Forf    Sem   Caut   €/km   Km/j Km/sem Illim.│
│ BMW M135i     [100]  [150]  [350]  [550] [2000]  [2,0]  [200] [1200] [ 90] │
│ Audi S3       [ 90]  [140]  [320]  [500] [1800]  [1,8]  [200] [1200] [ 80] │
│ Golf GTI      [ 80]  [120]  [300]  [450] [1500]  [1,5]  [250] [1500] [ 60] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Le prix du kilométrage illimité (« Illim. ») est porté par le véhicule**, parce que le
gérant le veut à 0 € sur une C3 et libre sur une BMW. **La réservation le propose prérempli
et modifiable** : la case à cocher de sa demande ouvre l'encart avec ce montant déjà rempli,
que l'agent peut changer pour un client donné. Zéro est une valeur valable, elle veut dire
« inclus, sans supplément », pas « non renseigné ».

**Ce qui bascule de l'un à l'autre** : la même largeur de rupture que le reste de
l'application, pour que l'écran se comporte comme ses voisins.

**Ce que ça demande** : une table de grilles (nom et les quatre valeurs communes), un
rattachement du véhicule à une grille, et la facture qui va chercher la valeur du véhicule
d'abord, celle de sa grille ensuite.

**Un véhicule n'appartient qu'à une grille**, et il peut n'en avoir aucune : il facture alors
ses propres valeurs, comme aujourd'hui. **Rien ne casse le jour de la livraison.**

**Ce qu'il ne faut pas casser** : la migration 064 a écrit les tarifs des dix véhicules de
LMS Drive plaque par plaque, kilomètre supplémentaire à 2 € compris. Ces valeurs sont la
vérité de facturation actuelle, la grille ne doit pas les remplacer.

## Les deux interrupteurs qui y arriveront

- Le contrôle des montants d'intervention (38.G), éteint par défaut.
- Le consentement commercial, si le module E-mails se fait.

---

# LES ARBITRAGES DÉJÀ TRANCHÉS

Ils ne se rouvrent pas.

**Du 01/08**

1. **Remarque 43** : le rendez-vous garage devient le contenant, une ligne par voiture et par
   jour.
2. **Remarque 8** : le compte à rebours n'automatise rien, alerte au gérant, il décide.
3. **Remarques 9 et 11** : la facture sans paiement en ligne.
4. **Remarque 3 (close)** : une seule liste avec un repère facturable. Exécution en 38.F.
5. **Remarque 38** : les mots devis et facture restent, les deux états sont abandonnés.

**Du 02/08**

6. **Le message d'infraction est unique**, sans variante selon qui paie.
7. **Un domaine et un compte d'envoi par client.**
8. **Le consentement commercial est obligatoire**, avec lien de désabonnement.
9. **`CLIENT_EMAILS_LIVE` reste à `false`** jusqu'à ce que tout soit propre.
10. **Les tâches en retard se coupent à 24 h** entre urgentes et importantes, dans Alertes
    seulement.
11. **Les grilles tarifaires se branchent par catégorie de véhicule.**
12. **La liste du gérant passe devant les remarques de Jeff.**

---

# CE QUI A ÉTÉ CLOS PAR JEFF LE 02/08/2026

Onze remarques, vérifiées par lui : **2** (état mécanique sans les montants), **3** (refonte
Suivi véhicule), **7** (colonnes sur iPhone), **12** (barre du logo fixe), **19** (vue
tablette sur téléphone), **23** (le pneu hors carrosserie), **25** (iPhone 17 et calendrier de
chacun), **29** (couleur par personne), **30** (liste des tâches du jour), **31** (taille
réduite de moitié), **36** (la fluidité).

⚠️ **Son tri n'était pas enregistré dans le simulateur local** : les onze y apparaissaient
encore ouvertes. **Ce document fait foi.**

---

# CE QUI RESTE OUVERT AILLEURS

- **La fiche d'installation d'un nouveau client** : créer la base, appliquer les migrations,
  créer le projet Vercel, poser les variables, créer le compte Resend, faire vérifier le
  domaine, créer le premier compte gérant. **Demandée par Jeff le 02/08 pour son organisation,
  pas comme fonctionnalité.** Non écrite.
- **L'onglet « Mises à jour »**, où le client voit chaque dimanche ce qui a changé et choisit
  d'appliquer ou de reporter. Après la livraison de Smart Loc.
- **Le paiement en ligne**, chantier à part non ouvert.
- **Le ménage repéré** : le second chemin de changement de statut d'une tâche, les deux
  actions devenues inutiles depuis que la réparation passe par une intervention, et le bloc
  « tarifs par défaut » qui ne pilote rien (traité en 16).
