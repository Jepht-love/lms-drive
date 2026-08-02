# Le plan des remarques ouvertes

Écrit le 01/08/2026 avec Jeff, **remis à jour après son tri du 02/08**. Il a vérifié
l'ensemble de ses remarques et en a clos onze d'un coup : **2, 3, 7, 12, 19, 23, 25, 29,
30, 31, 36**.

**10 remarques restent ouvertes sur 43** : 8, 9, 10, 11, 38, 39, 40, 41, 42, 43.

**Rangées ici dans l'ordre du menu de l'application**, du tableau de bord aux paramètres,
comme Jeff les parcourt. Chaque bloc dit : ce qu'il voit, où c'est dans le code, le geste,
et ce qu'il ne faut pas casser.

**Deux passent devant les autres**, parce qu'elles viennent du gérant en usage réel par le
canal SAV (règle du §7 du CLAUDE.md) : **le véhicule en déplacement affiché disponible**
(dans la 40) et **le paiement d'une réservation** (la 42).

**Ce qui est tranché et ne se rouvre pas** : les mots devis et facture restent (décision
du 01/08 au soir, qui annule le passage à « en cours / clôturée »). Les quatre arbitrages
du 01/08 sont en fin de document.

---

# 1 · TABLEAU DE BORD · rien à faire

La remarque 12 (la barre du logo et de la date reste en haut) est close.

# 2 · CALENDRIER · rien à faire

Les remarques 19, 25, 29, 30 et 31 sont closes. **L'onglet est entièrement traité.**

---

# 3 · RÉSERVATIONS · remarques 42 et 8

## 42 · Le paiement d'une réservation

**Remontée par le canal SAV, donc par le gérant en usage réel : elle passe devant, juste
après le bug du déplacement.**

**1. Le reste à payer.** En bas de la fiche, après la saisie du montant versé par le
client : « Reste à payer x € » ou « Paiement effectué x € ». Le calcul se fait à la saisie.
Ses mots : « quelque chose de simple ». Remontée depuis
`/reservations/f7280e1b-fd4b-48f7-bbf0-82f4868ba110`.

**2. L'acompte redemandé à la confirmation.** Confirmer une réservation redemande
l'acompte, alors qu'il a été saisi et calculé à la création. À retirer de l'écran de
confirmation. **Vérifier d'abord qu'il n'y sert pas à autre chose**, par exemple pour une
réservation créée sans acompte.

## 8 · L'acompte bloque la voiture

**Ce que Jeff veut.** Un acompte de 20 % du montant bloque le véhicule pour une durée
proportionnelle, avec un compte à rebours visible.

**Tranché le 01/08 : rien d'automatique.** Le compte à rebours arrive à zéro, une alerte
part au gérant, et **c'est lui qui décide** de libérer ou de prolonger. **Aucune
réservation ne disparaît toute seule**, aucun acompte n'est acquis sans décision humaine.

**Ce que ça implique.** La durée couverte se calcule à la saisie de l'acompte (part du
montant total rapportée à la durée de la réservation), s'affiche en compte à rebours sur
la fiche, et déclenche une alerte à son terme. Le véhicule reste bloqué tant que le gérant
n'a rien fait : c'est volontaire, un véhicule libéré par erreur coûte plus cher qu'un
véhicule bloqué un jour de trop.

---

# 4 · CLIENTS · rien à faire

---

# 5 · VÉHICULES · remarque 39

## 39 · Créer une immobilisation depuis son onglet

**Ce que Jeff veut.** Un « + » dans l'onglet Immobilisations ouvre un petit formulaire :
véhicule et type d'immobilisation (maintenance, réservé, hors service, fourrière, non
restitué, déplacement professionnel), et le statut du véhicule suit tout seul. Ses mots :
« créer une fluidité et pas complexifier la tâche via 50 onglets remplis de technologie qui
ne seront jamais utilisés ».

**Ce qui existe déjà.** L'écran `/vehicles/immobilises` liste les véhicules immobilisés et
connaît les six types. Le bouton de changement de statut existe sur la fiche véhicule
(`VehicleStatusButton`). **Il manque le raccourci depuis l'onglet lui-même.**

**Le geste.** Un « + » qui ouvre une fenêtre : véhicule, type, date de fin prévue
optionnelle, motif. Il écrit le statut et, s'il y a une date de fin, pose le créneau au
calendrier comme le fait un rendez-vous garage.

**La remarque 7 (les colonnes sur iPhone) est close.**

---

# 6 · SUIVI VÉHICULE · remarques 38, 43, 9, 10 et 11

Le plus gros bloc. Il couvre les trois volets de la page : Entretien (38 et 43) et
Infractions (9, 10, 11). Rien sur les Sinistres.

## 38 et 43 · Les interventions au garage · À TRAITER D'UN SEUL TENANT

Les deux touchent la même mécanique, elles ne se séparent pas.

### 43 · Deux lignes pour un seul rendez-vous garage

**Ce que Jeff voit.** Deux lignes « 08:00 RDV GARAGE Renault Captur · HF-760-LS » dans son
calendrier, pour un seul passage au garage sur une seule voiture, parce que les réparations
sont de types différents.

**La cause, vérifiée.** `lib/actions/maintenance.ts` ligne 160 : chaque intervention crée
son propre créneau au calendrier. Rien ne les regroupe.

**Le geste, tranché le 01/08.** Le créneau cesse d'appartenir à une intervention et
devient le passage au garage lui-même. Avant d'en créer un, on cherche s'il existe déjà un
« RDV garage » ce jour-là pour ce véhicule ; si oui, on le complète au lieu d'en créer un
second. **Suivi véhicule continue d'afficher chaque intervention séparément, avec son
propre montant.**

**À traiter avec** : la suppression d'une intervention efface aujourd'hui le créneau
(`deleteMaintenanceRecord`, ligne 241). Avec un créneau partagé, elle doit seulement en
retirer son véhicule, et n'effacer le créneau que s'il ne reste personne.

### 38.A · L'heure du rendez-vous

**La cause, vérifiée.** `lib/actions/maintenance.ts` ligne 155 : `T08:00:00` en dur, donc
tous les rendez-vous garage sont posés à 8 h du matin.

**Le geste.** Un champ heure à côté de la date, prérempli à 8 h, modifiable
(`TimePickerField` existe déjà). Le créneau du calendrier la reprend. Aucun changement de
base.

### 38.B · L'intervention devient modifiable

**Ce que Jeff voit.** Une intervention enregistrée ne se modifie plus. Une erreur de date,
de garage ou de montant oblige à la supprimer et à tout ressaisir.

**La cause, vérifiée le 01/08.** `lib/actions/maintenance.ts` n'expose que quatre
actions : créer, supprimer, marquer payé, régler. **Aucune modification n'existe.**

**Le geste.** Un crayon rouvre le même formulaire, prérempli. **Dès qu'un montant est
saisi, la modification exige un motif écrit.** Le reste (date, garage, kilométrage, dégâts
rattachés) se modifie librement.

**Ce qu'il ne faut pas casser** : une intervention réglée a produit des écritures
comptables portant la référence `maintenance:<intervention>:<dégât>`. Modifier son montant
après règlement doit corriger l'écriture, pas en créer une seconde.

**Rappel de la décision du 01/08 au soir** : les mots devis et facture restent. Les deux
états « en cours / clôturée » sont abandonnés, ne pas les reproposer.

### 38.C · Plusieurs véhicules dans un rendez-vous

**Le geste, tranché le 01/08.** Un « + » ouvre la liste des véhicules, chacun avec son
kilométrage prérempli et ses dégâts en attente. **Une seule ligne au calendrier** portant
les N voitures, **et une intervention séparée par véhicule** dans Suivi véhicule. Chacune
se clôture quand son garage a fini : sans ça, un garage qui rend une voiture le mardi et
les trois autres le vendredi bloquerait la comptabilité jusqu'au vendredi.
`calendar_events.vehicle_ids` est déjà un tableau, il n'y a rien à inventer côté
calendrier.

### 38.D · Quatre rendez-vous sur le même créneau · RIEN À FAIRE

**Vérifié le 01/08 : `layoutEvents` (`components/calendar/MobileCalendar.tsx` ligne 79)
répartit déjà en colonnes tout ce qui se chevauche.** Quatre rendez-vous au même créneau
s'affichent côte à côte. Sur téléphone la vue jour est une liste, la question ne s'y pose
pas.

### 38.E · Le véhicule ne revient jamais disponible (trouvé le 01/08, hors remarque)

**Ce que Jeff ne voit pas encore.** Créer une intervention met le véhicule en
immobilisation. **Rien ne le remet jamais en disponible.** Un sinistre clos le fait, une
mise à disposition aussi, un entretien non.

**La cause, vérifiée.** `maintenance.ts` ligne 170 pose le statut `maintenance`. Ni
`markMaintenancePaid` ni `settleIntervention` n'y touchent.

**Le geste.** Le règlement remet en disponible les véhicules que cette intervention avait
immobilisés, sauf s'ils l'ont été entre-temps pour autre chose.

### 38.F · Les types alignés sur les postes facturables (venu de la remarque 3, close)

> La remarque 3 est close, mais cet arbitrage a été pris le 01/08 et reste à exécuter. Il
> est gardé ici pour ne pas partir avec la remarque.

**Tranché : une seule liste, avec un repère facturable.** Les types d'intervention et les
postes de facture fusionnent. Chaque ligne dit si elle peut être refacturée à un client :
dégâts, nettoyage, carburant et kilomètres supplémentaires oui ; révision, vidange et
contrôle technique non. La facture de restitution ne peut plus proposer un poste qui
n'existe pas côté intervention.

**Ce qu'il ne faut pas casser** : la correspondance actuelle entre un type de dégât et sa
catégorie comptable (`lib/vehicles/damage-catalog.ts`) alimente l'onglet « Dégâts et
réparations ». La liste unique doit la conserver, pas la remplacer.

### 38.G · Le contrôle des montants (décidé le 01/08, à faire après le reste de la 38)

Corriger un montant déjà saisi ouvre une demande. **Rien ne bouge tant qu'un autre gérant
ou associé n'a pas répondu, et personne ne valide sa propre demande** : c'est explicitement
un contrôle anti-fraude voulu par Jeff, contre les faux justificatifs qui gonflent les
factures. Déclenchement au-delà de **20 % ou 20 €** d'écart, le plus petit des deux.
Justification écrite obligatoire, trace de qui a validé.

**Interrupteur d'agence, éteint par défaut.** Si l'agence n'a personne d'autre pour
valider, la correction passe seule et reste tracée.

## 9, 10 et 11 · Les infractions · UN SEUL BLOC

**Regroupées à la demande de Jeff le 02/08** : les trois touchent le même parcours,
envoyer une contravention à son responsable.

### Ce qui existe déjà, vérifié le 02/08

L'envoi fonctionne (`transmitInfractionToClient`, `lib/actions/incidents.ts` ligne 113) :
le mail part, l'infraction passe en « transmis client », l'envoi est tracé dans
l'historique des e-mails. **Mais le mail est écrit à la main en HTML brut dans l'action**
(lignes 135 à 142), au lieu de passer par les modèles communs de `lib/email/templates.ts`
qui servent aux réservations. D'où tout ce qui manque.

⚠️ **Défaut de socle trouvé au passage** : ce mail signe `· LMS Drive` **en dur dans le
code** (ligne 142). Il partirait tel quel chez Smart Loc, avec le nom du confrère. À
corriger dans ce bloc, c'est la règle du §4 du CLAUDE.md projet.

### Ce que Jeff demande

1. **Le mail au format des réservations.** Il reprend la présentation des mails de contrat
   (`contractDepartEmail`, `contractRetourEmail`), pas un HTML fait à part.
2. **Le prix se fixe à la main**, avec le type d'infraction modifiable selon l'avis
   réellement reçu, et les frais de dossier.
3. **Une facture au format de la facture de restitution**
   (`lib/pdf/invoice-template.tsx`), avec le même contenu et la même mise en page, dont le
   détail vient de l'infraction enregistrée. **Le détail vit dans le libellé de la ligne**
   (nature, date, heure, lieu, numéro d'avis), pas dans un pavé de texte à part : sans lui,
   le client peut répondre qu'il ne reconnaît pas l'infraction. Indispensable dans le cas de
   la longue durée, où la ligne cohabite avec le carburant, les kilomètres et les dégâts.
4. **Aperçu avant envoi** (remarque 11).
5. **La page d'erreur au clic sur le document** (remarque 10), à remettre au format des
   autres documents. **Piste sérieuse** : les documents sont rangés dans un espace privé
   avec une adresse publique, défaut déjà repéré le 29/07 sur les contrats. **Même cause
   probable, à confirmer.**
6. **Le cas de la longue durée.** Quand le client a une location longue durée, une clause
   permet de **joindre l'infraction à la facture de restitution de l'état des lieux
   retour**, au lieu de lui envoyer une facture séparée en cours de contrat.

### Le message, tranché par Jeff le 02/08 : UN SEUL, sans variante

**Le logiciel ne décide de rien, le gérant décide.** Pas de message différent selon que
l'agence a avancé l'amende ou désigné le conducteur : cette logique a été **explicitement
écartée par Jeff**, elle complique sans servir. Le gérant saisit les lignes et les montants
à la main, obtient le PDF, et l'envoie ou le remet en main propre, à sa convenance. **Le
bouton d'envoi reste celui d'aujourd'hui.**

Le texte du mail :

> Bonjour [prénom],
>
> Vous trouverez ci-joint votre **facture de restitution liée à une contravention**,
> relevée le [date] avec la [véhicule] ([plaque]).
>
> À ce titre, le règlement de cette contravention vous incombe.
>
> Pour toute question sur le paiement, contactez-nous au [téléphone de l'agence] ou à
> [adresse de l'agence].

**Les coordonnées viennent de la configuration d'agence**, comme dans le mail de
réservation. Rien en dur : c'est ce qui les fait suivre chez Smart Loc sans toucher au code.

**Tranché le 01/08 : pas de lien de paiement en ligne.** Aucune passerelle bancaire
n'existe dans l'application. Le règlement se fait par les moyens habituels et se saisit à
la main. **Le paiement en ligne est un chantier à part, non ouvert** : il demande un contrat
et des frais, et servirait aussi aux acomptes et aux locations. À reproposer quand le reste
sera stabilisé.

### Le contexte métier, pour qui reprend le dossier

Deux situations existent dans la vraie vie, et **le code les connaît déjà** : `paid_by`
vaut `client` ou `agence`, et la dépense n'est écrite en comptabilité que si l'agence a
avancé (`lib/actions/incidents.ts` ligne 183).

- **L'agence désigne le conducteur.** C'est l'obligation du loueur, dans les 45 jours, par
  le formulaire de requête en exonération joint à l'avis : administrativement une
  contestation, mais dont l'objet est de désigner qui conduisait. Le client reçoit ensuite
  son propre avis et le règle à l'administration.
- **L'agence avance l'amende**, et s'en fait rembourser.

**Ce que ça change au message : rien**, par décision de Jeff. Le gérant sait dans quel cas
il est et saisit les lignes en conséquence. Écrire cette logique dans le code reviendrait à
faire porter au logiciel une qualification juridique qu'il n'a pas à trancher.

---

# 7 · CONTRATS · rien à faire

# 8 · DÉPLACEMENTS · remarque 40

Cinq demandes, dont **la première passe devant tout le reste du document**.

## 40.1 · ⚠️ URGENT · Le véhicule en déplacement s'affiche disponible

**Ce que le gérant voit.** Une voiture partie en déplacement professionnel apparaît
disponible sur sa fiche.

**La cause, confirmée le 01/08.** **Aucun code ne pose jamais le statut
`deplacement_pro`.** Démarrer un déplacement ne change pas le statut du véhicule : le choix
d'origine est de superposer l'information à l'affichage (`fetchActiveInternalTrips`,
`lib/vehicles/internalTrips.ts`). **Trois écrans seulement font cette superposition** : la
liste des véhicules, les immobilisés, le tableau de bord. **La fiche d'un véhicule ne la
fait pas** : elle lit le statut brut, resté « disponible »
(`app/(dashboard)/vehicles/[id]/page.tsx`, lignes 217 et 352).

**Le geste.** La fiche véhicule applique la même superposition que la liste.
**Ne pas écrire le statut en base** : le commentaire de `internalTrips.ts` explique
pourquoi, cela créerait des statuts orphelins quand un déplacement n'est jamais clôturé.

**Balayage à faire en même temps** : chercher tous les écrans qui affichent un statut de
véhicule sans passer par cette superposition.

## 40.2 · Choisir le véhicule comme sur une réservation

Voir s'il est libre, et repérer les créneaux entre deux locations pour caser un déplacement
d'une heure. Placé juste sous « Démarrer maintenant », un mois de visibilité, au-delà on
renvoie au calendrier. **La recherche avec créneaux libres existe déjà** (commit `0d6cf6c`,
réservations) : la reprendre telle quelle, pas la réécrire.

## 40.3 · Le libellé d'un déplacement

« HK-347-GV Rdv pro Marich Toulassi · 28/07/2026 23:01 » devient : modèle en grand, plaque
en petit, le reste dessous. **Le format commun des lignes existe déjà** (commit `96fb5c6`) :
reprendre celui-là.

## 40.4 · Modifier un déplacement

Un crayon qui rouvre le formulaire, plus un champ de date de fin.

## 40.5 · Le gérant peut modifier, Jeff non

Sur le même écran. **Cause non cherchée à ce jour**, probablement une condition de rôle qui
oublie le super-utilisateur.

---

# 9 · PARTENARIATS · rien à faire
# 10 · COMPTABILITÉ · rien à faire
# 11 · MARKETING · voir le module E-mails ci-dessous
# 12 · ÉQUIPE · rien à faire
# 13 · DOCUMENTS · rien à faire

---

# 14 · E-MAILS · LE MODULE DE CAMPAGNES · CHANTIER NEUF

**Demandé par Jeff le 02/08/2026**, hors remarques. Ce n'est pas une correction, c'est une
fonctionnalité à construire.

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

## Ses deux arbitrages du 02/08

- **Des modèles préparés, texte modifiable.** Trois ou quatre modèles livrés avec
  l'application (relance, offre, information), à la charte de l'agence. Le gérant change le
  texte et les images, pas la mise en page. **Il ne peut pas produire un mail laid**, et le
  résultat est le même chez le client suivant.
- **Des groupes que le gérant compose.** Il filtre sa base (dernière location, type de
  client, longue durée, montant dépensé) et **voit combien de personnes sont concernées
  avant d'envoyer**.

## Ce qui existe déjà, vérifié le 02/08

- **L'onglet E-mails n'est qu'un historique** de ce qui est parti (`EmailsList.tsx`).
- **L'onglet Marketing gère des campagnes** avec budget, résultats et clôture
  (`lib/actions/campaigns.ts`, table `campaigns` depuis la migration 014), **mais il
  n'envoie aucun mail**.
- **Cinq modèles figés dans le code** (`lib/email/templates.ts`) : contrat de départ,
  contrat de retour, invitation d'un collaborateur, réinitialisation de mot de passe, et le
  bloc de contact. Leur enveloppe et leur charte sont réutilisables telles quelles.
- **Resend** est déjà branché pour les envois unitaires.

**Où le module vit** : l'envoi et l'historique dans l'onglet E-mails, qui porte déjà
l'historique ; **la campagne marketing existante s'y rattache** pour porter le budget et
dire ce que l'envoi a rapporté. À confirmer avec Jeff s'il le veut ailleurs.

## ⚠️ Deux points absents du cahier des charges, obligatoires

**1. Le consentement et le désabonnement.** Envoyer un message commercial à un client exige
son accord et **un lien de désabonnement dans chaque mail**. Ce n'est pas optionnel. Ça
demande :

- une colonne d'accord sur la fiche client, avec sa date ;
- une case à la création d'un client et sur sa fiche ;
- un lien de désabonnement dans chaque envoi commercial, qui retire le client des envois
  sans supprimer son compte ;
- l'exclusion automatique des désabonnés de tout groupe de destinataires.

**Les mails de contrat, de facture et d'infraction ne sont pas concernés** : ils sont liés à
l'exécution du contrat et partent sans accord préalable. Seul le commercial l'est.

**2. Le volume et son coût.** Resend facture à l'envoi et limite le débit. Un envoi à toute
la base part en file d'attente, pas d'un bloc. À chiffrer avant de promettre un envoi
massif, et à dire au gérant.

## Le suivi des ouvertures et des clics

Techniquement possible : Resend sait remonter ouvertures, clics, rebonds et désabonnements.
Demande de brancher la remontée d'événements et une table pour les stocker. **Le taux
d'ouverture est indicatif**, pas exact : les boîtes mail qui bloquent les images le
faussent à la baisse, celles qui préchargent tout le faussent à la hausse. À dire au gérant
plutôt qu'à laisser croire à une mesure exacte.

**Ce que Jeff veut voir au bout** : le rendement d'un envoi, donc les locations qui suivent,
rattachées à la campagne qui porte déjà le budget.

## ⚠️ PRÉALABLE BLOQUANT · L'expéditeur est écrit en dur (trouvé le 02/08)

**À corriger avant le module, il le rend inutilisable en l'état.** Trois valeurs propres à
LMS Drive vivent dans `lib/email/config.ts` :

| Ligne | Valeur en dur | Ce qui se passe chez Smart Loc |
|---|---|---|
| 30 | `LMS Drive <no-reply@sas-financial-services.com>` | Ses mails partent signés du nom de son confrère |
| 36 | `marich.toulassi.pro@gmail.com` | Ses mails clients arrivent chez le gérant de LMS Drive |
| 43 | `CLIENT_EMAILS_LIVE = false` | **Aucun mail ne part à un vrai client**, tout va au gérant |

**Le troisième point est le plus important pour ce module** : depuis le 24/07/2026 et à la
demande de Jeff, tous les mails clients (contrats, factures, avis d'infraction) sont
redirigés vers la boîte du gérant, qui reçoit une copie de tout. **Une campagne partirait
donc cent fois dans sa boîte, et zéro fois aux clients.**

> **Tranché par Jeff le 02/08 : la redirection reste en place.** On construit et on teste
> avec elle, ce qui est justement le bon filet : une campagne d'essai arrive chez le gérant
> et montre exactement ce qui serait parti. **La réactivation se fera quand tout sera
> propre**, et pas avant. Ne pas la basculer de sa propre initiative : ce jour-là, les
> contrats, les factures et les avis d'infraction partent aussi pour de bon aux locataires.
>
> **Un détail pour les essais** : cent mails de test vers la même boîte consomment quand
> même le quota de cent par jour. Tester sur quelques destinataires, pas sur toute la base.

## L'expéditeur, tranché par Jeff le 02/08 : UN DOMAINE PAR CLIENT

**Chaque client a son propre domaine et son propre sous-domaine d'envoi.** Smart Loc
enverra depuis `no-reply@smartloc.com`, pas depuis un domaine de FleetLive.

**Ce que ça implique, et qui devient la procédure d'installation d'un nouveau client :**

1. **Le client fournit son domaine.** Sans domaine, pas d'envoi à son nom.
2. **Un compte Resend par client**, chacun sur son plan gratuit : 3 000 mails par mois,
   100 par jour, un domaine. C'est exactement le format d'un compte gratuit, et ça colle à
   la règle « un client, une base, un déploiement ».
3. **Le client pose ses réglages techniques de domaine** (les enregistrements que Resend
   lui donne), avec une procédure écrite. C'est le modèle de FleetLive : l'éditeur fournit
   l'application et la marche à suivre, le client exécute.
4. **La clé d'envoi va dans la configuration du déploiement**, elle y est déjà
   (`RESEND_API_KEY`). **L'expéditeur et la boîte de repli doivent l'y rejoindre.**

**Ce que ça rapporte** : un client qui envoie beaucoup ne bloque jamais les contrats d'un
autre, chacun garde son plafond, et le locataire reçoit un mail de son loueur et non d'un
éditeur qu'il ne connaît pas. **Tout reste gratuit** tant qu'un client ne dépasse ni
3 000 mails par mois ni 1 000 contacts.

## Les tarifs Resend, relevés le 02/08/2026

**Transactionnel** (les contrats, factures, avis) :

| Plan | Prix | Mails par mois | Par jour | Domaines |
|---|---|---|---|---|
| Gratuit | 0 $ | 3 000 | **100** | 1 |
| Pro | 20 $ | 50 000 | sans limite | 10 |

**Marketing** (les campagnes), facturé **au nombre de contacts et non de mails envoyés** :
gratuit jusqu'à 1 000 contacts, puis 40 $ par mois jusqu'à 5 000.

**Le point de vigilance** : sur le plan gratuit, les 100 mails par jour sont **partagés
avec tout ce qui part déjà** de l'application. Une campagne à 80 clients un jour de forte
activité ferait tomber les mails de contrat. Le plan Marketing, facturé aux contacts,
n'entame pas ce quota : c'est lui qu'il faut utiliser pour les campagnes.

**Ce qui ferait basculer un client au payant** : plus de 3 000 mails par mois, ou plus de
1 000 contacts dans sa base. À 20 $ par mois pour 50 000 mails, le coût se répercute sans
difficulté sur la licence.

## Ce qui reste à cadrer avant d'écrire

- Le module vit-il dans E-mails, dans Marketing, ou à cheval ?
- Les codes promotionnels : un simple texte dans le mail, ou de vrais codes que la
  réservation sait reconnaître et déduire ? **La deuxième réponse est un chantier à part**,
  elle touche la tarification.
- Combien de modèles au départ, et lesquels ?

---

# 15 · PARAMÈTRES · rien à faire

**Deux choses y arriveront** : l'interrupteur du contrôle des montants d'intervention
(point 38.G), éteint par défaut, et le réglage du consentement commercial si le module
E-mails se fait.

---

# TRANSVERSE · remarque 41

## 41 · Les 35 notifications, revérifiées une par une

**Ce que Jeff voit.** Une notification annonçait un rendez-vous en retard alors qu'il
s'agissait d'un départ en retard. **Il ne veut pas la correction de ce cas seul** : rouvrir
les 35 notifications et les revérifier une par une, comme cela a été fait le 30/07 pour
leur format à trois lignes. Une capture est jointe à la remarque.

---

# LES QUATRE ARBITRAGES DU 01/08/2026 · TRANCHÉS

Ils ne se rouvrent pas :

1. **Remarque 43, le rendez-vous garage devient le contenant.** Une ligne au calendrier par
   voiture et par jour, portant toutes les réparations.
2. **Remarque 8, le compte à rebours n'automatise rien.** Alerte au gérant, il décide.
3. **Remarques 9 et 11, la facture sans paiement en ligne.** La passerelle bancaire est un
   chantier à part, non ouvert.
4. **Remarque 3 (close), une seule liste avec un repère facturable.** Exécution gardée au
   point 38.F.

---

# CE QUI A ÉTÉ CLOS PAR JEFF LE 02/08/2026

Onze remarques, vérifiées par lui : **2** (état mécanique sans les montants), **3** (refonte
Suivi véhicule), **7** (colonnes sur iPhone), **12** (barre du logo fixe), **19** (vue
tablette sur téléphone), **23** (le pneu hors carrosserie), **25** (iPhone 17 et calendrier
de chacun), **29** (couleur par personne), **30** (liste des tâches du jour), **31** (taille
réduite de moitié), **36** (la fluidité).

⚠️ **Son tri n'était pas enregistré dans le simulateur local** au moment d'écrire ces
lignes : les onze remarques y apparaissaient encore ouvertes. Soit il a trié sur le
simulateur en ligne, qui tient sa propre liste, soit le marquage n'a pas été sauvegardé.
**Ce document fait foi** en cas d'écart.

---

# CE QUI RESTE OUVERT AILLEURS

Hors remarques, déjà consigné dans `MODIFICATIONS-A-FAIRE.md` :

- **L'onglet « Mises à jour »**, où le client voit chaque dimanche ce qui a changé et
  choisit d'appliquer maintenant ou de reporter. Placé après la livraison de Smart Loc.
- **Le paiement en ligne**, chantier à part non ouvert.
- **Le ménage repéré** : le second chemin de changement de statut d'une tâche, les deux
  actions devenues inutiles depuis que la réparation passe par une intervention, et le bloc
  « tarifs par défaut » des paramètres qui ne pilote rien.
