# Ce qui reste à faire jusqu'au dimanche 2 août 2026

> Document de travail, mis à jour le 31/07/2026. Il remplace le point de reprise collé en début de session.
>
> **Règle de lecture : les étapes se font dans l'ordre.** Elles sont classées du moins cher au plus cher, et les vérifications passent avant les constructions. Ce qui dépend d'une réponse de Jeff est marqué comme bloqué et attend, il ne se contourne pas.

## Où on en est

**Livré et en ligne aujourd'hui.** Commit `5d21d55` sur `main` : la vue semaine du tableau de bord écrit la couleur du véhicule avant la plaque. La correction du 30/07 ne couvrait que les cartes de l'accueil.

**Closes par Jeff lui-même, retirées de la liste.** Le document d'une infraction qui ouvrait une page d'erreur (remarque 10) et le filtre véhicule trop large sur iPhone (remarque 7). Ne pas les rouvrir.

**Abandonné.** La restriction d'accès au simulateur d'appareil : le simulateur n'est pas déployé et ne le sera pas, il reste sur la machine de Jeff. Le gardien d'accès du logiciel est revenu à son état d'origine.

**Reste ouvert :** huit remarques et trois demandes nouvelles, détaillées ci-dessous.

---

## Étape 1. Vérifier les tâches du jour et les alertes

**Pourquoi en premier :** c'est déjà écrit dans le code, il s'agit de le contrôler à l'écran, pas de le construire.

Ce que Jeff demande : une tâche du jour dépassée et non faite quitte les tâches du jour et part dans les alertes ; une tâche marquée faite disparaît simplement, sans alerte ; dans les deux cas l'évènement reste dans le calendrier pour l'historique.

Ce que le code fait déjà, vérifié le 31/07 dans `app/(dashboard)/page.tsx` autour de la ligne 518 : la bascule vers les alertes existe, avec une tolérance réglable dans les paramètres, 30 minutes par défaut, pour ne pas basculer une tâche pendant qu'on est en train de la faire.

**À contrôler, une branche après l'autre :** la tâche dépassée qui bascule, la tâche faite qui disparaît sans alerte, et l'évènement qui reste dans le calendrier. Captures à l'appui. Si les trois passent, l'étape se ferme sans une ligne de code.

## Étape 2. Le bouton « Aujourd'hui » du calendrier

Remarque 19, point 3. Fichier `components/calendar/CalendarToolbar.tsx`, ligne 66. Il déplace la date sans changer de vue ; il doit atterrir sur la vue jour du jour même, tâches comprises. Un quart d'heure.

## Étape 3. Qui porte une tâche dans le calendrier

Remarque 19, point 4. Une tâche non attribuée s'écrit « non attribué » en gras. Une tâche attribuée affiche le nom de la personne et son poste, pour ne pas la confondre avec le client.

L'évènement transporte déjà le nom, **mais pas le poste** : à ajouter dans ce que le calendrier lit (`types/calendar.ts` et `app/api/calendar/events/route.ts`), puis à afficher dans les trois endroits qui dessinent une tâche. Trois quarts d'heure.

## Étape 4. Le bas coupé sur tablette en paysage

Remarque 19, point 2. Impossible d'afficher le calendrier de tout le monde. Défaut de hauteur dans `components/calendar/CalendarPage.tsx`, à reproduire en 1024 sur 768 puis à corriger. Moins d'une heure.

## Étape 5. Le format commun des lignes

Ajout du 31/07. « Tâches du jour » et la vue semaine doivent s'écrire pareil, sur trois lignes :

```
Smart Fortwo Noir · DQ-314-CV      le véhicule et sa couleur, puis la plaque
George Alex Romeo                  le client
Échéance proche                    le type de tâche, sans le montant
```

**Contrainte vérifiée le 31/07, elle décide de la façon de faire.** Le texte long est fabriqué et rangé en base à la création de la tâche (`lib/calendar/syncAlerts.ts`, ligne 54) **et le même texte part dans les notifications du téléphone** (`app/api/notifications/route.ts`, lignes 456 et 460). Sur un écran de verrouillage, le montant a du sens : c'est pour ça qu'il y est.

**Donc on ne touche ni au texte enregistré, ni à la notification. On change l'affichage à deux endroits :** la vue semaine (`components/dashboard/DashboardCalendar.tsx`, ligne 57) et les tâches du jour (`app/(dashboard)/page.tsx`, ligne 811). Pour afficher sans le montant, chaque alerte doit porter le véhicule, le client et le montant séparément au lieu d'une phrase collée (`lib/utils/alerts.ts`, ligne 517), en laissant la phrase actuelle intacte pour la notification. Environ une heure.

**En attente d'une décision de Jeff :** le titre enregistré colle ses morceaux avec un tiret cadratin, contraire à sa règle. Le corriger touche le texte des notifications.

## Étape 6. La vue tablette sur téléphone

Remarque 19, point 1, **et le seul gros morceau de la série calendrier.** Sur téléphone il faut défiler jusqu'en bas pour voir les tâches d'une date, alors que la tablette les montre toutes avec les heures à côté.

En dessous de 768 px, l'application charge un écran entièrement différent (`components/calendar/MobileCalendar.tsx`, 19 Ko), pas une version rétrécie de la tablette. Le chemin le plus court : faire basculer le téléphone sur la vue tablette, puis réparer ce qui déborde en 390 px de large.

**Une demi-journée, et un vrai risque de casse :** c'est l'écran que les salariés utilisent sur le terrain. Captures téléphone avant et après, obligatoires. Si ça part de travers, on arrête et on en reparle.

## Étape 7. L'acompte qui bloque la voiture

Remarque 8, **débloquée le 31/07 : il n'y a aucun calcul automatique.** Décision de Jeff : le gérant fixe lui-même, à la création de la location, la durée de validité de l'acompte, au cas par cas. Cette durée se décompte sur la réservation par un chronomètre visible sur le tableau de bord, même principe et même emplacement que le chrono des réservations sans acompte. Passé le délai, la réservation s'annule et la voiture repart en disponible.

Ce que ça demande : un champ de durée sur le formulaire de réservation quand un acompte est saisi, le décompte, et l'annulation automatique à l'échéance. Le pourcentage d'acompte ne pilote rien, il reste une information.

---

## Après la réinitialisation du quota, dimanche 2 août

Les trois chantiers ci-dessous demandent de l'analyse et touchent la structure des données. Ils ne se font pas dans les 24 % de quota restants.

## Étape 8. Les interventions et la fiche véhicule

Remarques 2 et 3. **Le cadrage est complet**, obtenu le 31/07, sauf la fourrière. Trois lots testables l'un après l'autre.

**La règle de fond :** une intervention ne se planifie que sur la base de faits. Un fait, c'est un dégât déclaré, et il n'arrive que par trois chemins : la saisie manuelle depuis la fiche du véhicule côté entretien, l'état des lieux de retour d'une réservation, une déclaration de sinistre. **L'objectif numéro un, dans les mots de Jeff :** que l'état des lieux remonte les dommages et les prix facturés au client au moment de créer l'intervention, pour voir d'un coup d'œil si le coût de la réparation est proportionnel à ce qui a été encaissé.

**Lot 1, le cœur.** L'intervention redevient modifiable, dit de quel véhicule elle parle, se relie à sa réservation. Plusieurs dommages par intervention, choisis dans la liste des dégâts **non encore réparés** du véhicule, classés par origine, avec le prix facturé visible à côté de chaque dommage facturé. Champ garage en texte libre, à ne pas confondre avec la rubrique Partenariats qui porte les agences de location. Personne affectée à la création, avec sa tâche dans son calendrier et sa notification. Kilométrage de départ pré-rempli au dernier relevé connu quelle qu'en soit la source, kilométrage saisi à la reprise. Le véhicule devient indisponible, avec une date de reprise prévue affichée et la libération réelle à la saisie de la reprise. Les entretiens rangés par véhicule, une ligne qui se déplie sur son historique avec la dernière intervention et le total dépensé.

**Lot 2, la déclaration du dégât.** La saisie depuis la fiche véhicule ne change pas de place. On lui ajoute le type précis, la photo datée qui garde l'heure de la constatation, l'auteur de la déclaration, et si le dégât vient d'un incident ou s'il est simplement constaté. Quatre origines : location, usure, usage interne, non communiquée. La liste des types réunit **les éléments que l'état des lieux sait déjà facturer**, à relire dans le code et à faire valider avant d'écrire, **plus les pannes mécaniques** qui ne sont jamais facturées. Sans cette deuxième famille, une panne déclencherait à tort l'alerte « réparé sans avoir été constaté ». Et l'état mécanique de la fiche véhicule perd tout l'argent, remarque 2 : il se réduit à un signalement, le détail vit dans Suivi véhicule.

**Lot 3, l'argent.** Enregistrement sans montant, notification « le véhicule X a une intervention en attente de devis », détail élément par élément ensuite, devis et facture des pièces en pièces jointes, saisie du montant réservée au gérant et aux associés. Puis la rubrique **« CA dommages et réparations »** en comptabilité : elle entre dans le chiffre d'affaires total, on veut seulement pouvoir la suivre séparément, et elle détaille l'origine de chaque ligne, facture de restitution rattachée au dommage, usure, usage interne ou origine non communiquée. Deux blocs à ne pas mélanger : les dommages clients, qui ont une recette en face, et les coûts d'usage interne et d'usure, qui n'en ont aucune.

**La fourrière et l'immobilisation, tranchées le 31/07.** Même système que les interventions, rattachées à une infraction. **Les frais sont facturés au client quand l'infraction vient d'une réservation** ; rien n'est facturé quand le véhicule était en usage interne, le coût reste à la société. L'état des lieux ne porte aucune mention de la fourrière et n'a pas à en porter : le rattachement se fait par l'infraction.

**Les types d'infraction, tranchés le 31/07 :** les quatre familles retenues, vitesse et feux, stationnement et circulation, comportement au volant, péage et contrôle technique, **plus tous les autres types existant en France**. La liste complète est à dresser à partir des catégories officielles du code de la route et à faire valider par Jeff avant d'être écrite en base. Aucun type inventé.

## Étape 9. Les grilles tarifaires dans les paramètres

Demande du 31/07. Une section réservée à l'administrateur et au gérant, pour créer et modifier des grilles nommées, deux pour commencer, « Sportive » et « Citadine ». Chaque grille porte le kilomètre supplémentaire, le retard à l'heure, le retard à la journée, le carburant, la caution et la franchise. Objectif de Jeff, dans ses mots : modifier ces tarifs à tout moment sans avoir à intervenir dans le développement.

**Attention, cette demande touche un défaut connu et non corrigé.** Les six champs de tarifs de l'écran des paramètres sont enregistrés et réaffichés, mais **aucun autre fichier ne les lit** : la facturation prend le prix inscrit sur chaque véhicule. L'écran annonce 1 € du kilomètre pendant que les factures comptent 2 €. Livrer des grilles sans les brancher reproduirait le même piège en plus grand.

**Le vrai travail, trois choses :** créer les grilles, rattacher chaque véhicule à une grille, faire lire la grille par la facturation. Deux jours, pas une après-midi. Plan écrit avant d'écrire.

## Étape 10. Les campagnes e-mail

Demande du 31/07, **la plus grosse des trois.** Envoyer newsletters, codes promotionnels et informations, nouveaux véhicules, changement d'horaires, nouveautés, événements, sans passer par un outil externe. Destinataires au choix : un client, une sélection, tout le fichier. Personnalisation avec le nom du client et le véhicule loué. Prévisualisation avant envoi. Historique des campagnes avec la date, les destinataires, le statut d'envoi, le taux d'ouverture et le taux de clic si c'est possible.

**À vérifier avant de le promettre :** les taux d'ouverture et de clic ne dépendent pas du logiciel mais de ce que Resend accepte de remonter sur le compte de Jeff. Plan écrit avant d'écrire.

---

## Ce qui reste hors de ce plan

**La facturation des infractions au client**, remarques 9 et 11, un seul chantier. Quand le responsable est identifié, lui envoyer la facture de la contravention : le montant, le type d'infraction modifiable pour coller à l'avis reçu, les frais de dossier au pourcentage prévu au contrat selon le type de véhicule. L'envoi part de la fiche infraction, avec un aperçu de la facture avant envoi, un texte qui explique les contraventions reçues, et un lien de paiement vers le compte du gérant. **À replacer avec Jeff**, il ne l'a pas classé dans l'ordre du week-end.

**La barre du haut**, remarque 12. Vérification faite dans le code et à l'écran : elle est déjà fixe. À ne rouvrir que si Jeff la revoit défiler.

## Ajouté le 30/07/2026, pour une prochaine session

**La facture de restitution devient modifiable avant envoi.** Trois montants doivent pouvoir être repris à la main au moment de l'aperçu, avant que le client ne reçoive quoi que ce soit :

- le montant des **dommages** relevés à l'état des lieux de retour,
- les **frais de retard**, jusqu'à hauteur du prix calculé,
- le **prix lui-même**, pour permettre une remise exceptionnelle.

**Réservé au gérant et aux associés.** Aucun autre rôle ne doit voir ces champs, encore moins pouvoir y toucher : un employé ou un prestataire garde la facture telle que le logiciel la calcule.

**Le format des notifications, à reprendre d'un bloc.** Jeff a passé en revue les 35 notifications du logiciel le 30/07 (page d'aperçu construite ce jour-là). Deux corrigées, les autres à aligner sur le même format. Défauts déjà repérés : « Départ du jour » et « Retour du jour » n'écrivent pas la couleur du véhicule alors que les notifications de réservation le font ; « Rappel dans 1 h » ne dit ni le véhicule ni la plaque ; « Document expire bientôt » ne nomme que le document ; et deux notifications différentes annoncent le même changement de statut d'une tâche (numéros 17 et 18 de l'aperçu). **Attendre la liste que Jeff renverra depuis la page d'aperçu.**

**La notification « Document expire bientôt » doit mener au remplacement.** Demande de Jeff du 30/07/2026 : le clic ouvre la fiche du véhicule en modification, à l'endroit des documents, avec le formulaire d'ajout déjà ouvert, pour déposer le document de remplacement sans chercher.

**Le préalable est une modification de la base** : vérifié le 30/07, la table `documents` ne porte aucun lien vers un véhicule, seulement une catégorie et parfois une réservation. Il faut donc d'abord rattacher un document à son véhicule, puis seulement le lien de la notification a un sens. Chantier à part, pas un ajustement d'affichage.

**Le classement urgent / important n'a pas de règle écrite.** Chaque type d'alerte décide pour lui-même, et deux ou trois classements se discutent : « Contrat à signer » est urgent alors que le départ peut être dans huit jours, « Départ du jour » n'est qu'important alors que c'est aujourd'hui. À trancher avec Jeff, une demi-heure de travail.

## Les quatre questions, toutes tranchées le 31/07

1. **L'acompte** : aucun calcul automatique, le gérant fixe la durée de validité au cas par cas à la création de la location.
2. **La fourrière** : facturée au client quand l'infraction vient d'une réservation, à la charge de la société sinon.
3. **Les types d'infraction** : les quatre familles retenues, plus tous les autres types existant en France, liste à dresser et à faire valider.
4. **Le tiret cadratin** : corrigé pour les nouvelles tâches seulement. Aucune opération sur la base, les anciennes s'éteignent d'elles-mêmes puisque ces tâches ont une échéance courte. À l'écran la question disparaît dès l'étape 5, la ligne étant reconstruite sur trois lignes.

## Le rythme et le modèle

Les étapes 1 à 7 sont de l'exécution : Sonnet suffit. Les étapes 8 à 10 demandent de l'analyse et touchent la structure des données : Opus, après la réinitialisation du quota dimanche. Jeff bascule lui-même de modèle, il faut le lui signaler avant de commencer.

**Il restait 24 % de quota hebdomadaire le 31/07 au matin.** Les huit remarques et les trois nouvelles demandes ne tiennent pas dedans : c'est la raison de cet ordre, et de la coupure au dimanche.
