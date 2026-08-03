# A2 · Le suivi complet d'une intervention

Cadré avec Jeff le 02/08/2026, huit questions posées et répondues. **Ce document dit ce qui
est tranché et dans quel ordre on l'exécute.** La demande d'origine est dans
`docs/PLAN-REMARQUES.md`, section 6.

## Ce qui est tranché

| Question | Réponse de Jeff |
|---|---|
| Découpage | **Trois lots**, testés l'un après l'autre |
| Urgence | **Trois niveaux saisis à la main** : normale, haute, critique |
| Pièces remplacées | **Une ligne par pièce** : nom, quantité, prix unitaire. Main d'œuvre à part |
| Prise en charge | **On se met soi-même dessus**, et le statut suit |
| Date limite | **Facultative**. Dépassée, l'intervention monte en urgent |
| Contrôle des montants (38.G) | **Dans le lot 2**, tout de suite |
| Qui fait quoi | Tout le monde crée et prend ; **seuls gérant et associé clôturent** |
| Entrée en alertes | **Dès la création, selon l'urgence**. Sort une fois terminée ou annulée |

Acquis sans être redemandés : le suivi du travail est indépendant du suivi de l'argent (une
intervention peut être terminée sans être réglée) ; les mots devis et facture restent ; un
créneau garage devient le passage au garage lui-même, partagé par les véhicules ; le règlement
remet le véhicule en disponible.

## Les trois lots

### Lot 1 · Le suivi du travail

Ce que le gérant réclame en premier : savoir **qui fait quoi, pour quand, et où ça en est**.

**En base** (migration 074, purement additive sur `maintenance_records`) :

| Colonne | Ce qu'elle porte |
|---|---|
| `urgency` | `normale` · `haute` · `critique`, défaut `normale` |
| `due_date` | la date limite, facultative |
| `assigned_to` | la personne désignée, facultative |
| `taken_by` / `taken_at` | qui s'est mis dessus, et quand |
| `work_status` | `a_traiter` · `prise_en_charge` · `rdv_programme` · `en_cours` · `terminee` · `annulee` |
| `closed_at` | le moment de la clôture |

Les interventions déjà réglées passent en `terminee` : sans ça, tout l'historique remonterait
en alerte le jour de la migration.

**Dans le code** : le formulaire de création reçoit l'urgence, la date limite et la personne ;
l'écran d'historique montre l'état et permet de le changer ; un bouton « Je prends en charge »
inscrit son nom ; le règlement clôt le travail s'il ne l'est pas déjà.

**Dans les alertes** : une intervention critique est urgente, une haute est importante, une
normale n'alerte pas. Une date limite dépassée passe en urgent quelle que soit l'urgence
d'origine. Terminée ou annulée, elle disparaît des alertes.

**Ce qu'il ne faut pas casser** : `settleIntervention` écrit une écriture comptable par dégât,
avec la référence `maintenance:<intervention>:<dégât>` comme garde anti-doublon. Le lot 1 n'y
touche pas.

### Lot 2 · Le compte rendu, la modification, le contrôle des montants

**Séparation exigée par le gérant le 02/08/2026** : planifier et rendre compte sont deux
moments différents, avec deux écrans différents. Une fois l'intervention réalisée, la personne
renseigne le véhicule concerné, la nature exacte, les pièces remplacées ou réparées, le garage,
la date, le prix des pièces, celui de la main d'œuvre, le coût total, le kilométrage, ses
observations et la facture. Passer une intervention en « terminée » ouvre donc ce compte rendu,
et la clôture n'est plus possible sans le remplir.


- Un crayon rouvre l'intervention, préremplie. Toute modification touchant un montant exige un
  motif écrit.
- Les pièces remplacées : une ligne par pièce (nom, quantité, prix unitaire), plus le prix de
  la main d'œuvre. Leur somme doit égaler le montant total de l'intervention.
- Le contrôle anti-fraude (38.G) : au-delà de 20 % ou 20 € d'écart, la correction attend la
  validation d'un autre gérant ou associé. Personne ne valide sa propre demande. Interrupteur
  d'agence, éteint par défaut.
- Une intervention réglée dont on corrige le montant **corrige son écriture comptable**, elle
  n'en crée pas une seconde.

### Lot 3 · Le rendez-vous garage partagé

- Un créneau au calendrier par **passage au garage**, plus par intervention (remarque 43).
- L'heure du rendez-vous devient saisissable, préremplie à 8 h (38.A).
- Plusieurs véhicules dans un rendez-vous : une ligne au calendrier, une intervention par
  véhicule, chacune clôturée quand son garage a fini (38.C).
- Supprimer une intervention retire son véhicule du créneau, et n'efface le créneau que s'il
  ne reste personne.

## Ce qui reste hors de ce chantier

38.F, la fusion des types d'intervention et des postes facturables, part avec les grilles
tarifaires (A3) : c'est la même liste. 38.D est classé sans suite, vérifié le 01/08.
