# Cartographie LMS Drive — chaque onglet, écran par écran

Document de travail préparé pour la réunion avec le gérant. Chaque rubrique est décrite telle qu'elle existe dans l'application (lue dans le code, rien inventé) : à quoi elle sert, ce qu'on y voit, ce qui se passe au clic, ce qu'elle alimente ailleurs, et ce qui se règle par client.

**Version visuelle et annotable :** `/cartographie.html` (à ouvrir dans le navigateur sur le poste où tourne l'application, comme le simulateur). On y clique un élément pour y coller une remarque, et on exporte la liste en Markdown.

**Comment s'en servir à la main :** annoter directement sous chaque rubrique, entre les balises `> ⟶ NOTE :`. Deux angles de correction : **fonctionnement** (ce que fait un bouton) et **design / UX** (ce qu'on voit, sur téléphone comme sur ordinateur).

**Légende des accès :** Tous = tout collaborateur · Managers = gérant et associé · Gérant = gérant seul. Les accès se règlent onglet par onglet dans **Équipe**.

---

## Les grands parcours — comment ça se passe

**① Créer une réservation.** Nouvelle réservation (véhicule + client + dates + prix) → à l'enregistrement : bloque le véhicule (**Calendrier**), passe le véhicule « réservé » (**Véhicules**), encaisse l'acompte (**Comptabilité**), notifie « Nouvelle réservation » → contrat + état des lieux de départ (**Contrats**, véhicule « loué ») → au retour : EDL, dégâts, caution soldée, facture (**Comptabilité** + **Documents**).

**② État des lieux (départ → retour).** Photos + dégâts + signatures → validation départ : contrat signé, véhicule « loué », réservation « en cours » → retour : comparaison, km, dégâts chiffrés, caution soldée → facture de restitution (**Comptabilité** + **Documents**).

**③ Traiter une infraction.** Nouvelle infraction (conducteur retrouvé par véhicule + date, **Clients**) → transmission au client (**E-mails** + **Documents**) → suivi paiement / refacturation (**Comptabilité**) → si impayée : alerte à l'accueil.

**④ Mise à disposition inter-agences.** Opération sortante (véhicule « chez partenaire ») ou entrante (véhicule partenaire au parc) → convention + états des lieux + signature (**Documents**) → si entrant : location du véhicule emprunté (**Réservations** + **Contrats**) → retour : clôture (**Comptabilité**).

**⑤ Entretien d'un véhicule.** Planifier une intervention (véhicule immobilisé, **Calendrier**) → suivi (prise en charge, avancement) → clôture : coût + facture garage (**Comptabilité** + **Documents**) → véhicule de nouveau disponible (**Véhicules**).

---

## 1. Tableau de bord — `/` · Tous · ✅ validé

La journée en un écran : état du parc, ce qui est en location, missions du jour, alertes. **Aucune donnée d'argent** (règle du cahier des charges, l'accueil reste ouvert à tous). Tout est cliquable et renvoie vers l'onglet qui détaille.

**À l'écran :** compteurs Flotte (Parc total, Occupation, Disponibles, En location, Immobilisés) · liste « En location » (badge Loué / Départ en retard / Réservé) · Tâches du jour (+ à préparer, renvoi vers alertes) · Alertes (retard, contrat, CT, assurance…) · bande « Semaine » défilante.

| Élément | Ce qui se passe au clic | Va vers |
|---|---|---|
| Cartes Parc / Disponibles / En location / Immobilisés | Ouvre la flotte filtrée sur le compteur | Véhicules |
| Ligne « En location » | Ouvre la fiche et le suivi de la réservation | Réservations |
| + Créer (tâches) | Ouvre le calendrier sur un tiroir de création pré-rempli | Calendrier |
| Carte d'alerte | Renvoie vers l'onglet qui traite l'alerte | Réservations · Véhicules · Contrats · Suivi |

**Lit (n'écrit rien) :** véhicules, réservations, contrats, calendrier & tâches, déplacements, alertes.
**Paramétrage client :** bloc Flotte masquable par collaborateur · seuil de retard réglable · **ne jamais ajouter d'indicateur d'argent**.

> ⟶ NOTE :

---

## 2. Calendrier — `/calendrier` · Tous · ✅ validé

L'agenda de l'équipe : départs / retours des locations, tâches (lavage, préparation, RDV garage), livraisons, récupérations, déplacements internes, disponibilités des associés. Chaque personne ou équipe a sa couleur.

**À l'écran :** vue jour / semaine · sélecteur de date · bouton Créer · filtres par équipe (couleurs) · blocs d'événements · tiroir d'un événement (assigner, ouvrir la réservation, faire l'état des lieux) · sous-écran Disponibilités.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Créer | Tâche, RDV client / garage, livraison, récupération, déplacement, indisponibilité | Calendrier · Accueil |
| Assigner à… | Attribue à une personne / équipe | Accueil (« qui s'en charge ») |
| Ouvrir la réservation | Bascule vers la location liée | Réservations |
| Faire l'état des lieux | Lance le parcours départ / retour | États des lieux · Contrats · Véhicules |
| Disponibilités | Chaque associé pose ses jours | Calendrier |

**Notifications :** Nouvelle tâche · Tâche / RDV en retard · Avancement d'une tâche.
**Paramétrage client :** équipes et couleurs par client · heure d'ouverture de la journée · ⚠ jours de week-end encore figés dans le code (à descendre en réglage).

> ⟶ NOTE :

---

## 3. Réservations — `/reservations` · Tous · ✅ validé · cœur du logiciel

La location de A à Z : créer, encaisser acompte et caution, signer le contrat, états des lieux départ et retour, prolonger, facturer, clôturer. C'est ici que « créer une réservation » alimente presque tous les autres onglets.

**À l'écran — liste :** bouton Nouvelle · recherche · filtres de statut (option, confirmée, en cours, en retard, terminée) · lignes véhicule / client / dates / prix.
**À l'écran — créer :** véhicule (avec disponibilité ○ libre / ● pris « jusqu'au X ») · client (recherche ou + Nouveau client à la volée) · dates départ / retour · prix/jour, km inclus, supplément km, caution, mode et référence de caution, acompte · détail du prix jour par jour · prix négocié (réduction calculée) · notes internes.
**À l'écran — suivi de la location :** étapes (option › confirmée › contrat › départ › en cours › retour › terminée) · paiement (relance) · caution · prolonger · modifier dates · état des lieux de retour · facture.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Créer la réservation | Enregistre, encaisse l'acompte, bloque le véhicule. Alerte si dossier client incomplet | Calendrier · Véhicules · Accueil · Comptabilité |
| + Nouveau client | Crée la fiche à la volée | Clients |
| Relancer le paiement | E-mail de règlement au client | E-mails |
| Valider le contrat | Passe en signé, crée la créance | Contrats · Comptabilité |
| État des lieux départ / retour | Photos + signatures ; départ → « loué », retour → « disponible » | États des lieux · Véhicules · Contrats |
| Prolonger · Modifier dates | Étend / déplace en revérifiant la disponibilité | Calendrier · Comptabilité |
| Générer la facture | Produit la facture PDF | Comptabilité · Documents |
| Client pas venu | Marque « non présenté », libère le véhicule | Véhicules · Calendrier |

**Notifications :** Nouvelle réservation · Départ du jour · Retour du jour · Retour en retard · Départ en retard · Contrat à signer / clôturer.
**Paramétrage client :** modes de caution · délai d'expiration d'une option · tarifs (week-end, forfait, km) portés par le véhicule. ⚠ La facture prend le prix du véhicule, pas les « tarifs par défaut » des Paramètres.

> ⟶ NOTE :

---

## 4. Clients — `/clients` · Tous · ✅ validé

Le répertoire des locataires : coordonnées, pièces d'identité et permis, historique des locations, incidents (amendes, sinistres), notes internes, informations commerciales. Source du dossier vérifié à chaque réservation.

**À l'écran :** bouton Nouveau · recherche · filtre blacklistés · lignes nom / téléphone / CA.
**Fiche :** coordonnées · documents d'identité (CNI recto / verso, permis, photos) · historique & incidents (locations, amendes, sinistres, impayé) · infos commerciales (source d'acquisition) · notes internes · Blacklister.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Nouveau client | Crée la fiche (identité, coordonnées, source) | Clients · Marketing |
| Ajouter une pièce | Photo / import CNI, permis, justificatif | Documents |
| Blacklister | Bloque le client (motif obligatoire) ; plus choisissable en réservation | Réservations · Calendrier · Véhicules |
| Note interne | Observation libre | Clients |

**Notifications :** Document expiré.
**Paramétrage client :** liste des sources d'acquisition · pièces obligatoires du dossier · sévérité du blocage « dossier incomplet ».

> ⟶ NOTE :

---

## 5. Véhicules — Flotte — `/vehicles` · Tous (bloc flotte réglable)

Le parc en temps réel : chaque véhicule, son statut (disponible, loué, réservé, immobilisé, chez partenaire…), ses échéances (CT, assurance, révision), ses besoins d'entretien, sa fiche technique.

**À l'écran :** bouton Ajouter · recherche · filtres de statut · filtres d'entretien (Garage, Vidange, Pneus, Dégradé) · cartes glissables (marque, modèle, couleur, plaque, statut, retour prévu, besoins).
**Fiche :** CA généré · occupation 90 j · location en cours + réservé ensuite · échéances CT / assurance / révision · entretiens, incidents, documents · Modifier.
**Ajouter :** plaque, marque, modèle, version, couleur, énergie, km, tarifs, caution, km inclus, grille tarifaire, échéances.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Ajouter | Crée le véhicule | Véhicules · Accueil |
| Glisser une carte | Réserver, changer le statut | Réservations |
| Changer le statut | Disponible, maintenance, hors service, fourrière… | Accueil · Calendrier |
| Filtres d'entretien | Isole garage / vidange / pneus / dégradé | Suivi |

**Notifications :** Contrôle technique · Assurance · Révision / entretien · Lavage avant location.
**Paramétrage client :** tarifs / caution / km portés par chaque véhicule · grille tarifaire (Paramètres) · seuils d'entretien. ⚠ Le fichier d'amorçage porte les 10 véhicules de LMS Drive en dur — jamais pour un autre client.

> ⟶ NOTE :

---

## 6. Suivi véhicule — `/suivi` · Entretien : Tous · Sinistres & Infractions : Managers · 3 volets en 1

Trois volets sur une page : **Entretien** (interventions garage, vidange, pneus), **Sinistres** (accidents), **Infractions** (amendes). Le gérant valide les trois en une séance.

**À l'écran :** onglets Entretien / Sinistres / Infractions · sélecteur de véhicule + carte situation · « Planifier une intervention » · interventions (statut, prise en charge, clôture, montant) · infractions (retrouver le conducteur par véhicule + date, transmettre, marquer payée, refacturer).

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Planifier une intervention | Crée l'intervention ; le véhicule peut passer immobilisé | Véhicules · Calendrier · Accueil |
| Prendre en charge · Changer le statut | Suit l'avancement | Accueil (alertes) |
| Clôturer · Régler | Solde et enregistre le coût | Comptabilité · Documents |
| Déclarer un sinistre | Ouvre l'accident, le rattache au véhicule | Véhicules · Comptabilité · Clients |
| Créer / transmettre une infraction | Retrouve le conducteur, transmet, suit le paiement, refacture | Clients · Comptabilité · Véhicules |

**Notifications :** Révision / entretien · Nouveau sinistre · Infraction non réglée · Intervention à traiter.
**Paramétrage client :** catégories et seuils d'entretien · règle de refacturation des amendes · accès Sinistres / Infractions réservé aux managers.

> ⟶ NOTE :

---

## 7. Contrats — `/contracts` · Consultation : Tous · Gestion : Managers

Le contrat de location en PDF : loueur et locataire, détail de la période louée, prix/jour, km inclus, dépôt de garantie, cachet et visa de l'agence apposés automatiquement. Signé **pendant l'état des lieux**, client et agent.

**À l'écran :** recherche (n°, véhicule, client) · statuts (brouillon, à signer, signé, clôturé) · prévisualisation (loueur / locataire, détail, signatures, cachet & visa) · télécharger le PDF.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Prévisualiser | Génère le PDF (identité agence + articles légaux) | Documents |
| Signer (à l'EDL) | Signatures client et agent sur la tablette | États des lieux · Documents |
| Valider le contrat | Passe en signé, crée la créance | Réservations · Comptabilité |

**Notifications :** Contrat à signer / clôturer.
**Paramétrage client :** identité loueur, cachet, visa (config client) · articles légaux modifiables. ⚠ Défaut connu : les PDF de contrat ne s'ouvrent depuis aucun écran — accès à rétablir.

> ⟶ NOTE :

---

## 8. Documents — `/documents` · Selon permissions

Le classeur de tous les documents (contrats, pièces clients, factures, avis d'infraction, papiers véhicules et partenaires), avec un écran d'import & tri pour ranger un lot en le rattachant.

**À l'écran :** recherche · filtres (clients, véhicules, contrats, partenaires) · lignes avec expiration · import & tri (zone de dépôt, type, rattachement, expiration).

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Import & tri | Range un lot, le rattache à un client / véhicule / partenaire | Clients · Véhicules · Partenariats |
| Envoyer par e-mail | Transmet un document au client | E-mails |
| Remplacer · Supprimer | Met à jour ou retire | Documents |

**Notifications :** Document expiré.
**Paramétrage client :** familles et types de documents · seuil d'alerte avant expiration.

> ⟶ NOTE :

---

## 9. Déplacements — `/internal-trips` · Tous

L'usage interne des véhicules, hors location : un déplacement pro, immédiat ou planifié, confié à un conducteur, avec motif, horaires et autonomie. Le véhicule sort du parc louable le temps du déplacement.

**À l'écran :** bouton Nouveau · en cours · historique · formulaire (véhicule parmi les disponibles, conducteur, motif, début, retour prévu, autonomie km).

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Démarrer (immédiat) | Sort le véhicule maintenant, « déplacement pro » | Véhicules · Calendrier · Accueil |
| Planifier | Programme un déplacement futur au calendrier | Calendrier · Accueil |
| Assigner | Confie à un conducteur | Calendrier |
| Retour | Clôt, remet disponible (km parcourus) | Véhicules · Accueil |

**Paramétrage client :** liste des motifs de déplacement.

> ⟶ NOTE :

---

## 10. Partenariats — `/partnerships` · Managers

La mise à disposition de véhicules entre agences : prêter (sortant) ou emprunter (entrant) pour honorer une location. Chaque opération a sa convention, ses états des lieux et la signature du représentant.

**À l'écran :** bouton Opération · onglets Opérations / Agences partenaires · opérations sortantes et entrantes · nouvelle opération (agence, véhicule, client associé, conditions, convention).

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Créer une opération | Sortant → « chez partenaire » ; Entrant → véhicule au parc temporaire | Véhicules · Accueil |
| Démarrer la location (entrant) | Lance l'EDL + le contrat | États des lieux · Contrats · Réservations |
| Valider la convention | Signature du représentant partenaire | Documents |
| Enregistrer le retour | Clôt la mise à disposition | Véhicules · Comptabilité |

**Paramétrage client :** liste des agences partenaires (saisie dans l'app) · modèle de convention et cachet propriétaire.

> ⟶ NOTE :

---

## 11. Comptabilité — `/accounting` · Managers · jamais sur l'accueil

Toute la vie financière : recettes et dépenses, clôtures (journalière, mensuelle, annuelle), créances client, échéances à venir (LLD / LOA), graphiques, indicateurs par véhicule, rapport de CA, dégâts et réparations, remises.

**À l'écran :** compteurs (CA, charges, bénéfice) · sous-onglets (Mouvements, Clôtures, Créances, Échéances, Graphiques, KPI véhicule, Rapport CA, Dégâts) · recherche · lignes recette / charge · créances (marquer payée) · échéances récurrentes.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Mouvement | Recette ou dépense (catégorie, méthode, note) | Comptabilité |
| Clôturer jour / mois / année | Fige et réconcilie la période | Comptabilité |
| Marquer une créance payée | Solde un reste dû client | Réservations |
| Créer une échéance | Ponctuelle ou récurrente (LLD / LOA) | Comptabilité |

**Notifications :** Échéances de la semaine.
**Paramétrage client :** catégories de charges · méthodes de paiement · règles de clôture. Onglet réservé aux managers.

> ⟶ NOTE :

---

## 12. Marketing — `/marketing` · Managers

Campagnes et connaissance client : lancer une campagne (canal, budget, dates), mesurer le résultat (CA généré, coût d'acquisition), lire le profil de la clientèle (fidélité, VIP, canaux, habitudes).

**À l'écran :** bouton Campagne · onglets Campagnes / Performances / Profil clientèle · cartes campagne (budget, CA, CAC) · fidèles (≥3), VIP · CA par canal d'acquisition.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Campagne | Crée une campagne (canal, budget, lancement, objectif) | Marketing |
| Clôturer une campagne | Enregistre bilan et enseignements | Marketing |
| Profil clientèle | Calcule fidélité, VIP, canaux depuis les locations | — |

**Paramétrage client :** canaux d'acquisition · seuils de fidélité.

> ⟶ NOTE :

---

## 13. Équipe — `/equipe` · Managers · c'est ici qu'on règle les accès

Les membres de l'agence : inviter, définir le rôle, et surtout régler ce que chacun voit, onglet par onglet. Plus la couleur de calendrier, la date d'embauche, l'état du compte.

**À l'écran :** bouton Inviter · onglets Actifs / Inactifs · lignes membre (rôle, couleur, actif) · permissions (rôle, couleur calendrier, onglets accessibles, bloc flotte, documents visibles, compte actif).

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Inviter | E-mail d'invitation à rejoindre l'agence | E-mails |
| Onglets accessibles | Coche les onglets visibles par ce membre | Menu de tous les écrans |
| Compte actif / inactif | Autorise ou coupe la connexion | Accès |

**Paramétrage client :** c'est l'écran qui **porte le paramétrage par usage** (rôles, accès par onglet, visibilité flotte et documents). Compta, marketing, équipe et paramètres restent réservés aux managers.

> ⟶ NOTE :

---

## 14. Paramètres — `/settings` · Gérant

L'identité et les réglages de l'agence : raison sociale, SIRET, adresse, coordonnées, grilles tarifaires (et rattachement aux véhicules), frais de restitution, journal des actions.

**À l'écran :** identité agence · tarifs par défaut · journal (contrôle des montants, recherche) · grilles tarifaires (créer, tarifs, véhicules rattachés) · frais de restitution (postes ajoutables, réordonnables).

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Enregistrer l'identité | Met à jour l'agence (contrats, factures) | Contrats · Factures |
| Créer / modifier une grille | Définit des tarifs, les rattache à des véhicules | Véhicules · Réservations |
| Frais de restitution | Ajoute et ordonne les postes facturés au retour | Facture de restitution |

**Paramétrage client :** c'est **la surface de configuration du client** (identité, grilles, frais). ⚠ Défaut connu : les « tarifs par défaut » sont enregistrés mais ne pilotent aucune facturation.

> ⟶ NOTE :

---

## 15. E-mails — `/emails` · Managers

L'historique des e-mails envoyés par l'application : relances de paiement, factures, documents, invitations d'équipe, conventions. Chaque envoi, son destinataire, son contenu.

**À l'écran :** filtres (paiement, facture, document) · lignes e-mail envoyé (statut, date) · contenu.

| Vient de | Type d'envoi |
|---|---|
| Réservations | Relances de paiement |
| Documents | Envois de documents |
| Équipe | Invitations |
| Partenariats | Conventions |

**Paramétrage client :** expéditeur et modèles d'e-mail (config client). Onglet en lecture, il ne déclenche pas les envois.

> ⟶ NOTE :

---

## 16. États des lieux — `/inspections` · Sur le terrain (tablette) · écran d'action clé

Le parcours de départ et de retour, fait à la tablette : photos, dégâts, kilométrage, carburant, propreté, signatures client et agent. Une version assistée par l'IA existe. C'est l'écran qui déclenche le passage « loué », la signature du contrat et, au retour, le solde de la caution.

**À l'écran :** étapes (photos › dégâts › km & carburant › propreté › signatures) · relevé des dégâts sur le schéma (rayure, bosse, impact, fissure, crevaison, usure, salissure intérieure…) · niveaux de propreté · signatures · au retour : comparaison, km supplémentaires, solde de caution, facture de restitution.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| Valider l'EDL de départ | Fige photos et dégâts, signatures, signe le contrat, véhicule « loué » | Contrats · Véhicules · Réservations |
| Valider l'EDL de retour | Compare l'état, relève km / carburant, chiffre les dégâts, solde la caution, prépare la facture de restitution | Véhicules · Comptabilité · Documents |
| Signaler un dégât | Ajoute le dégât au véhicule (devis, à réparer) | Véhicules · Suivi |

**Paramétrage client :** schéma du véhicule, types de dégâts, niveaux de propreté · règle de solde de caution et de facture de restitution.

> ⟶ NOTE :

---

## 17. SAV — Tickets — `/sav` · Managers · service facturé (assistance 24/24)

Le canal par lequel le gérant remonte ses bugs et ses questions, avec capture. C'est aussi un produit vendu : l'assistance 24 h/24 de FleetLive passe par ici. Rubrique qui doit être irréprochable, c'est la vitrine du service que le client paie.

**À l'écran :** bouton Ticket · filtres (ouverts, en cours, résolus) · lignes ticket (description, capture jointe) · changement de statut.

| Action | Ce qui se passe | Met à jour |
|---|---|---|
| + Ticket | Le gérant décrit le problème et joint une capture | SAV |
| Changer le statut | Ouvert › En cours › Résolu | SAV |

**Paramétrage client :** rubrique commune, point d'entrée du contrat d'assistance FleetLive.

> ⟶ NOTE :

---

## Rappels d'architecture (à garder en tête pendant la réunion)

- **Un seul code, plusieurs clients.** Les fonctionnalités se partagent, jamais les données. L'identité et les tarifs d'un client vivent dans sa configuration et sa base, jamais dans le code.
- **Le tableau de bord ne montre aucune donnée d'argent** — délibéré, pour rester ouvert à tous.
- **Chaque rubrique doit alimenter les autres automatiquement** — c'est l'exigence du cahier des charges et la valeur du logiciel.
- **Aucune valeur propre à un client dans le code** — un besoin propre à un client est un interrupteur de réglage, jamais du code à part.
