# Les modifications à effectuer

Liste tenue au fil de l'eau, ouverte le 01/08/2026. Chaque ligne dit ce qui change
pour l'utilisateur, pas comment c'est fabriqué. Une ligne livrée est barrée et
porte son commit.

L'ordre de traitement suit celui que Jeff donne, pas celui de cette liste.

---

## 1. Les remarques du simulateur

Elles vivent dans son outil d'annotation (`localhost:3100/simulateur.html`), clé
`lms_remarques`. **38 posées, 20 livrées, 18 ouvertes.** Chaque remarque livrée est marquée
`✅ FAIT (<commit>)` en tête de son texte, dans l'outil : c'est comme ça qu'il voit
ce qui reste.

| N° | Ce qu'il demande | État |
|---|---|---|
| 35 | Modifier une déclaration de dommage déjà faite | ✅ écrit et vérifié à l'écran, pas encore commité |
| 36 | L'application est lente à réagir : voir §2 | à faire |
| 37 | Défilement coulissant des jours, façon Google Agenda, dans le calendrier et sur l'accueil | à faire |
| 38 | Le chantier des interventions au garage : voir §3 | à faire |

Les 14 autres remarques ouvertes restent à reprendre une par une.

## 2. Rendre l'application instantanée

**Ce qu'il constate :** un changement de statut de tâche fait attendre, deux fois.
Mesuré en local le 01/08/2026 : 6 secondes entre le clic sur « Enregistrer » et la
ligne qui se met à jour. En ligne ce sera moins, mais perceptible.

**La cause :** partout, l'écran attend la réponse du serveur avant de se redessiner.

**Ce qui change :** l'écran affiche le résultat tout de suite et laisse le serveur
suivre derrière, comme les applications grand public. Si le serveur refuse, l'écran
remet la ligne en arrière et le dit clairement.

**La règle décidée avec Jeff le 01/08/2026, à ne pas déborder :**

> Instantané uniquement sur ce qui est réversible et sans conséquence financière :
> un statut, une case, un libellé. **Jamais sur l'argent ni sur les pièces qui font
> foi** : une réparation, une facture, un état des lieux, une caution, une
> suppression. Là, on attend le serveur et on l'assume.

**Ce qui rend l'opération sûre ici :** les notifications d'avancement de tâche
partent du serveur, après écriture réussie, et seulement si le statut a réellement
changé. Peindre l'écran en avance ne peut donc pas déclencher une fausse
notification à l'équipe, et c'est aussi ce qui prévient tout le monde quand deux
personnes touchent la même tâche.

**Périmètre retenu pour commencer :** le calendrier et les tâches, ses deux
exemples. Ensuite la même règle s'applique à chaque écran rouvert, sans chantier
séparé. Tout reprendre d'un coup touche une quarantaine d'écrans déjà validés par
le gérant : écarté avant le point du mardi.

## 3. Le chantier des interventions au garage (remarque 38)

Ce que Jeff décrit, dans l'ordre où il l'a écrit :

1. **Poser un rendez-vous pour plusieurs véhicules à la fois.** Une fenêtre où on
   coche les véhicules, puis un rendez-vous par véhicule, chacun avec ses dommages
   déclarés.
2. **Une heure sur l'intervention**, qui crée le créneau « RDV garage » dans le
   calendrier pour ce véhicule.
3. **Vocabulaire des montants** à revoir sur les interventions (devis, facture).
   *Sa phrase est coupée à cet endroit, question posée, en attente.*
4. **Une intervention modifiable tant qu'elle est en cours**, avec deux états :
   « intervention en cours » et « intervention clôturée ».
5. **Quatre rendez-vous sur le même créneau** en vue jour du calendrier.

Le cadrage déjà validé du volet comptable est dans `PLAN-INTERVENTIONS-COMPTA.md`.

### Les questions posées, en attente de réponse

1. « on plus parler de devis facture sur les intervention » : arrêter d'employer
   ces deux mots, ou au contraire les faire apparaître ?
2. Quatre véhicules chez le même garage à la même heure : quatre rendez-vous
   distincts dans le calendrier, ou un seul portant les quatre ?
3. Ce qui déclenche l'écriture en comptabilité : la clôture de l'intervention, ou
   la saisie du montant réellement payé comme aujourd'hui ?
4. La lenteur de la remarque 36 : constatée en local ou sur son téléphone ?

## 4. Le ménage repéré en passant

- **Deux chemins pour changer le statut d'une tâche**, chacun avec son envoi de
  notification : `app/api/calendar/events/[id]/route.ts` (utilisé) et
  `app/api/calendar/events/[id]/status/route.ts` (appelé de nulle part). Sans effet
  aujourd'hui ; le jour où quelqu'un rebranche le second, une seule action enverra
  deux notifications. **À supprimer**, quand Jeff le dit.
- **`resolveVehicleIssue` et `setDamageQuote`** ne sont plus appelés depuis que la
  réparation passe obligatoirement par une intervention. À supprimer une fois le
  chantier des interventions fini.
- **Le bloc « tarifs par défaut » des paramètres ne pilote rien.** Les six champs
  sont enregistrés et réaffichés, mais aucune facture ne les lit : le prix vient du
  véhicule. Le gérant peut croire changer ses tarifs sans aucun effet. Défaut réel,
  non corrigé, qui touchera aussi Smart Loc.

## 5. Ce qui reste ouvert et ne se corrige pas tout seul

- **Balayer les fenêtres de l'application.** Celle du calendrier était enfermée
  dans la bande du milieu de l'écran et impossible à fermer sur iPhone, corrigé le
  01/08/2026. Toutes les fenêtres bâties sur le même modèle ont probablement le
  même défaut. **Non balayé.**
- **Le tableau « Chiffre d'affaires prestations annexes »**, lot 3 du chantier
  comptable : combien les factures de restitution amortissent les réparations, par
  véhicule et par période.
- **L'onglet « Mises à jour »**, où le client voit chaque dimanche ce qui a changé
  et choisit d'appliquer maintenant ou de reporter d'une semaine. Chantier de 4 à
  6 jours, placé après la livraison de Smart Loc.
