# Cahier des charges LMS Drive — synthèse par rubrique

> Synthèse fidèle du cahier des charges rédigé par le gérant (`docs/LOGICIEL-LMS-DRIVE-CDC.docx`,
> 542 lignes). **Le document original fait foi** ; ce fichier sert à retrouver vite ce qui est
> attendu d'un onglet sans rouvrir le Word. Établi le 26/07/2026.
>
> Cinq rubriques ont été ajoutées après ce document, avec l'accord du gérant : **Contrats,
> Partenariats, Équipe, E-mails, Paramètres**. Elles ne sont décrites nulle part — pour
> celles-là, la référence est le gérant lui-même.

## Le principe qui traverse tout le document

**Chaque rubrique doit alimenter les autres automatiquement.** C'est l'exigence répétée à
chaque section, et c'est ce qui fait la valeur du logiciel aux yeux du gérant : une saisie
unique, qui se propage partout. Un écran qui enregistre correctement mais ne met pas à jour
les modules liés ne répond pas au cahier des charges, même s'il « fonctionne ».

Objectif général énoncé : un outil **simple, efficace, adapté aux réalités du terrain**, avec
un accès personnalisé selon le rôle et les autorisations de chacun.

## Correspondance avec les rubriques de l'application

| Cahier des charges | Dans l'appli |
|---|---|
| Tableau de bord | `/` |
| Comptabilité | `/accounting` |
| Entretien & suivi véhicule | `/suivi` — volet Entretien |
| Calendrier | `/calendrier` |
| Départ & retour | `/reservations` + `/inspections` *(à confirmer)* |
| Répertoire client | `/clients` |
| Fiche technique de chaque véhicule | `/vehicles` |
| Marketing | `/marketing` |
| Infraction et sinistre | `/suivi` — volets Sinistres et Infractions |
| Document | `/documents` |
| Mise à disposition inter-agences | `/partnerships` |
| Gestion des déplacements professionnels | `/internal-trips` |

---

## 1. Tableau de bord

Page d'accueil. Objectif : **une vision globale de la journée sans ouvrir les autres onglets**.

Affiche : nombre total de véhicules · disponibles · en location · immobilisés (entretien,
réparation, sinistre, contrôle technique) · la liste des véhicules loués avec le nom du client,
la date de retour prévue et **le nombre de jours restants** · les départs et retours du jour ·
les réservations à venir · les tâches du jour (lavage, préparation, rendez-vous, entretien,
livraison, récupération) · les alertes importantes (révision, assurance qui expire, contrôle
technique, documents manquants, retard de retour).

**Deux règles impératives :**

- **Aucune donnée financière.** Ni comptabilité, ni bénéfices, ni dépenses. C'est délibéré : la
  page doit rester accessible à **tous** les collaborateurs. Y ajouter un indicateur d'argent
  est une faute, pas une amélioration.
- **Chaque information affichée doit être cliquable** et renvoyer vers l'onglet qui la détaille.

Le tableau de bord doit rester **volontairement épuré et facile à lire**.

## 2. Comptabilité

Objectif : centraliser les données financières et suivre **la rentabilité véhicule par véhicule**.

Affiche : chiffre d'affaires global et par véhicule · bénéfices par véhicule et globaux ·
charges fixes et variables · dépenses et recettes en temps réel · paiements à venir et échéances.

**Chaque mouvement est tracé avec** : date, montant, véhicule concerné, fournisseur ou
bénéficiaire, mode de paiement, catégorie, commentaire.

Catégories citées : loyer véhicule, assurance, carburant, péages, lavage, réparations,
entretien, publicité et marketing, fournitures, salaires, amendes, autres.

Attendus :

- **Alimentation automatique depuis les autres onglets**, mise à jour en temps réel.
- **Analyse financière** permettant d'identifier vite les plus gros postes de dépense et
  d'expliquer une baisse de rentabilité sur une période.
- **Clôtures journalière, mensuelle, annuelle** — les données sont **figées** à la clôture pour
  garantir un historique fiable.
- **Période personnalisable** : jour, semaine, mois, trimestre, année, ou période libre.
- **Exports PDF et Excel** de toutes les écritures, transmissibles au comptable.
- Graphiques : évolution du chiffre d'affaires, des dépenses, rentabilité par véhicule, charges
  principales, bénéfices mensuels et annuels.
- **Accès restreint aux utilisateurs autorisés.**

**Demande explicite du gérant, ajoutée en fin de section :** dans les bilans mensuel et annuel,
pouvoir **mettre une entrée ou une sortie « en transparent »** — elle est déduite du total — puis
télécharger le bilan ainsi ajusté pour l'envoyer au comptable.

## 3. Entretien & suivi véhicule

Objectif : centraliser entretien, nettoyage, réparations et suivi technique, avec
**l'historique complet par véhicule**, mois en cours et mois précédents.

Suit : carburant, lavages, révisions, vidanges, niveaux de liquides, huile moteur, liquide de
refroidissement, lave-glace, pneus, freins, réparations mécaniques et carrosserie, travaux,
contrôles techniques, diagnostics et anomalies.

**Chaque intervention est enregistrée avec** : date, véhicule, **kilométrage au moment de
l'intervention**, type, montant payé, prestataire ou garage, facture ou justificatif, commentaire.

Alimenté automatiquement par : Départ & retour, Déplacements professionnels, Mise à disposition
inter-agences, Fiche technique, Calendrier, Comptabilité.

**À chaque départ ou retour de véhicule**, le kilométrage, le niveau de carburant, l'état de
propreté et les dommages constatés doivent **alimenter cet onglet automatiquement**.

**Alertes automatiques attendues** : révision à effectuer · vidange bientôt nécessaire ·
contrôle technique à prévoir · pneus à contrôler · niveau d'huile à vérifier · **lavage à faire
avant une location** · réparation en attente · anomalie signalée lors d'un retour.

Finalité énoncée : anticiper, éviter les oublis, réduire les pannes, garder une flotte propre et
disponible.

## 4. Calendrier

Objectif : centraliser l'organisation quotidienne, hebdomadaire et mensuelle.

Visualise : réservations · départs · retours · rendez-vous clients · rendez-vous garages ·
livraisons et récupérations · tâches du jour · **disponibilités des employés et associés**.

**Chaque utilisateur voit les tâches qui lui sont attribuées** — quoi faire, à quelle heure, avec
quel véhicule, pour quel client.

**Statuts de tâche** : à faire · en cours · terminé · reporté · annulé.

**Alertes automatiques attendues** : départ véhicule dans 1 heure · retour prévu aujourd'hui ·
lavage avant location · rendez-vous client · rendez-vous garage · contrôle état des lieux à
faire · paiement ou caution à vérifier · document client manquant.

## 5. Départ & retour

**Le cahier des charges en fait « l'une des fonctionnalités principales ».** Objectif :
**dématérialiser entièrement la location** et supprimer le contrat papier.

À la création d'un départ : sélectionner un client existant **ou** en créer un. Si le client
existe, **toutes ses informations se préremplissent** (identité, date de naissance, adresse,
e-mail, téléphone, permis, pièce d'identité, historique, documents). **Recherche instantanée par
nom, prénom ou téléphone.**

À enregistrer : véhicule · date et heure de départ · date et heure de retour prévue · kilométrage
de départ · niveau de carburant · montant de la location · montant de la caution · forfait
kilométrique · options complémentaires.

**L'état des lieux se fait dans le logiciel, sur une représentation visuelle du véhicule :** on
clique sur la zone concernée (l'exemple donné est une jante), **elle passe en rouge**, on ajoute
un commentaire et une ou plusieurs photos. **Le même mécanisme au retour**, pour comparer
automatiquement l'état départ / retour.

**Caution** : montant déposé, date, mode de paiement, restitution, retenues, prélèvements en cas
de dommages, d'amendes ou d'impayés.

**Signature électronique du client directement dans le logiciel.** Puis le contrat est
automatiquement généré en PDF, envoyé par e-mail au client, archivé dans la base documentaire, et
associé à la fiche client **et** à la fiche véhicule.

**Propagation automatique exigée** : la réservation entre au calendrier · le véhicule passe en
« indisponible » · la date de retour est enregistrée · les données financières partent en
comptabilité · les kilométrages vont au suivi véhicule · les alertes d'entretien se mettent à
jour · l'historique client s'enrichit.

## 6. Répertoire client

Connecté à Départ & retour, Comptabilité, Réservations et Infractions — **mise à jour
automatique après chaque location**.

Fiche client : identité, date de naissance, adresse, e-mail, téléphone, permis, pièce d'identité,
date d'inscription, documents, historique des locations.

Parcours client accessible : nombre total de locations · véhicules déjà loués · **chiffre
d'affaires généré par le client** · réservations à venir · annulations · offres et avantages
accordés · réductions personnalisées · **statut VIP**.

**Partie « Historique et incidents »** : amendes · sinistres · dommages causés · retards de
restitution · impayés · cautions retenues · litiges.

**Fiche descriptive interne** partagée entre collaborateurs, avec des exemples donnés par le
gérant : « client ponctuel et respectueux », « habitué de l'agence », « préfère les véhicules
sportifs », « souhaite être contacté par téléphone », « client exigeant nécessitant un suivi
particulier ». **Visible uniquement par les collaborateurs autorisés.**

Également attendu : **note de satisfaction interne de 1 à 5 étoiles** · identifier les meilleurs
clients · identifier les clients à risque · signaler ceux sous surveillance · **liste noire avec
justification obligatoire**.

Indicateur financier : dettes en cours, factures impayées, cautions retenues, remboursements en
attente.

## 7. Fiche technique de chaque véhicule

Un dossier complet par véhicule, **mis à jour automatiquement** depuis Départ & retour,
Entretien, Comptabilité, Calendrier, Déplacements internes et Mise à disposition inter-agences.

**Informations générales** : marque, modèle, finition, année de mise en circulation,
immatriculation, VIN, couleur, nombre de places, nombre de portes, carburant, puissance fiscale,
puissance moteur, boîte de vitesses, kilométrage actuel.

**Informations commerciales** : prix journalier, hebdomadaire, mensuel · caution · kilométrage
inclus par formule · date de mise en location · **taux d'occupation** · chiffre d'affaires généré
· **rentabilité du véhicule**.

**Informations administratives** : carte grise, assurance, contrôle technique, contrats,
documents, **dates d'expiration**.

**Suivi technique** : kilométrage de suivi et historiques — révisions, vidanges, réparations,
travaux, pneus, contrôles techniques, carrosserie.

**Historique des locations** : nombre total, dernières locations, clients concernés, périodes
d'immobilisation, utilisations internes, mises à disposition inter-agences.

**Historique des incidents** : sinistres, accidents, dégradations, amendes, dossiers d'assurance,
expertises.

**État du véhicule** : état général, niveau de carburant actuel, dernier kilométrage, dernier
lavage, dernier contrôle. **Statuts** : disponible · loué · réservé · en entretien · immobilisé ·
mis à disposition d'une autre agence.

**Photos du véhicule** enregistrables et actualisables, pour garder un historique visuel de son
état dans le temps.

## 8. Marketing

Objectif : mesurer l'efficacité et la rentabilité des actions commerciales.

Par campagne : nom · objectif · date de lancement · date de fin · budget engagé · **canal**
(Instagram, Snapchat, TikTok, Facebook, Google, flyers, partenariats) · responsable · résultats ·
observations.

Analyse de rentabilité : prospects générés · réservations obtenues · chiffre d'affaires généré ·
**retour sur investissement** · **coût d'acquisition par client** · plus-value apportée.

**Profil type de clientèle établi automatiquement** à partir du Répertoire client, des
Réservations, de Départ & retour, de la Comptabilité et des Véhicules : tranches d'âge les plus
représentées · véhicules les plus demandés · périodes de forte activité · secteurs géographiques
les plus rentables · canaux d'acquisition les plus performants · habitudes de consommation ·
clients les plus fidèles.

## 9. Infraction et sinistre

### Infractions

Par infraction : date · véhicule · **client ou utilisateur responsable** · type · montant de
l'amende · points concernés · date de réception de l'avis · date de transmission au conducteur ·
date de règlement · statut.

**Statuts** : en attente · transmis au client · contesté · réglé · clôturé.

Le logiciel doit dire instantanément : **quel client avait le véhicule au moment de l'infraction**
· si l'amende est réglée · si des frais administratifs ont été facturés · si le dossier est en
cours.

### Sinistres

Par sinistre : date · véhicule · conducteur responsable · description des faits · **photos des
dommages** · déclaration · numéro de dossier · montant réel des réparations · retenue sur caution.

**Statuts** : déclaré · en attente de traitement · en expertise · en réparation · en attente de
remboursement · clôturé.

### Interconnexion

Connecté à Départ & retour, Répertoire client, Comptabilité, Entretien & suivi, Fiche technique.
À la création d'une infraction ou d'un sinistre, **les informations du client, du véhicule et du
contrat se récupèrent automatiquement**. Les dépenses de réparation ou de franchise partent
**automatiquement en comptabilité** et dans l'historique du véhicule.

## 10. Document

Bibliothèque documentaire numérique. Classement par catégories :

- **Entreprise** : KBIS, statuts, attestation d'assurance, RIB, documents comptables, contrats
  fournisseurs.
- **Véhicules** : cartes grises, attestations d'assurance, contrôles techniques, certificats de
  cession, procès-verbaux d'expertise, factures d'entretien et de réparation, documents de mise à
  disposition.
- **Clients** : contrats de location, états des lieux, pièces d'identité, permis, justificatifs de
  domicile, procurations, autorisations.
- **Partenaires** : contrats de partenariat, conventions de mise à disposition inter-agences,
  accords commerciaux, contrats de prestation.

Fonctions attendues : consulter · télécharger · imprimer · **envoyer directement par e-mail** ·
archivage automatique · **recherche rapide par mot-clé, véhicule, client ou catégorie**.

**Tout document généré par le logiciel** (contrat, état des lieux, rapport de sinistre, facture)
**s'y enregistre automatiquement**. Chaque document porte une date de création, un auteur, un
statut et un **historique des modifications**. L'accès à certaines catégories doit pouvoir être
restreint selon les droits.

## 11. Mise à disposition inter-agences

Gère les échanges de véhicules avec les agences partenaires, **dans les deux sens** : mettre un
véhicule LMS Drive à disposition d'un partenaire, **ou** utiliser le véhicule d'un partenaire pour
répondre à une demande client que LMS Drive ne peut pas satisfaire.

Par opération : agence partenaire · véhicule · **propriétaire** · **utilisateur** · dates et
heures de départ et de retour · kilométrages départ et retour · niveaux de carburant départ et
retour · **prix de mise à disposition** · **prix de relocation au client final** · **marge
réalisée** · caution éventuelle · observations.

**Distinction explicite exigée** entre **véhicules sortants** (propriété LMS Drive, confiés à un
partenaire) et **véhicules entrants** (propriété partenaire, utilisés par LMS Drive).

Calculs automatiques : coût réel de mise à disposition · chiffre d'affaires généré · marge ·
rentabilité de l'opération.

Suit aussi : infractions, sinistres, réparations, retenues financières, états des lieux,
documents associés. Transmet tout à Comptabilité, Entretien & suivi, Infractions & sinistres,
Calendrier et Fiche technique.

## 12. Gestion des déplacements professionnels

Suivi des véhicules utilisés **en interne** par les associés et les employés. Le cahier des
charges le décrit comme **« un système de pointage »**.

Par utilisation : utilisateur · **fonction de l'utilisateur** · véhicule · dates et heures de
départ et de retour · **motif du déplacement** · kilométrages départ et retour · niveaux de
carburant départ et retour · péages · frais engagés · observations.

Doit permettre d'identifier vite : **quel collaborateur utilisait le véhicule à une date donnée**
· les kilomètres parcourus · la consommation de carburant · les frais · les infractions reçues.

**En cas d'amende, le logiciel doit désigner automatiquement l'utilisateur responsable du véhicule
au moment des faits** pour faciliter les démarches administratives.

Connecté à Fiche technique, Entretien & suivi, Infractions & sinistres, Comptabilité. Met à jour
automatiquement le kilométrage des véhicules et leur historique d'utilisation.

---

## La phrase de conclusion du gérant

> Ce projet a pour ambition de fournir à LMS Drive un outil de gestion complet, évolutif et adapté
> aux spécificités du secteur de la location automobile. Grâce à l'interconnexion des différents
> modules, le logiciel devra permettre un gain de temps significatif, une meilleure traçabilité des
> opérations et une prise de décision facilitée grâce à des données fiables et actualisées en temps
> réel.
