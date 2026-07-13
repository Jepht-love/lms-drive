# Audit d'anticipation — LMS Drive vu par le gérant

> **But.** Transformer les feedbacks déjà donnés par le gérant en **grille de
> lecture**, puis passer *toute* l'application au crible avec *sa* logique pour
> trouver — et traiter en avance — ce qu'il relèvera sur les onglets qu'il n'a
> pas encore audités.
>
> Statut : **audit en cours** · dernière mise à jour le 11/07/2026.
> Priorités : **P0** = il le dira dès qu'il ouvre l'onglet · **P1** = très
> probable · **P2** = probable · **P3** = raffinement.

---

## 1. La grille de lecture du gérant (9 axes récurrents)

Extraits de l'ensemble de ses feedbacks (dashboard, calendrier, réservations,
clients, compta, disponibilités) :

1. **États métier complets** — chaque situation réelle doit avoir un statut.
   *(ex. immobilisé → fourrière + non restitué + déplacement pro).* Il repère
   tout de suite un cas terrain sans état correspondant.
2. **Rien ne tombe entre les mailles** — tout apparaît de façon cohérente sur
   **dashboard ↔ calendrier ↔ alertes**, avec le **statut visible sans cliquer**.
   Un élément non traité dont l'heure est passée **part automatiquement en
   alerte**.
3. **Tourné vers l'avant** — les obligations futures sont remontées et
   priorisées (réservations à venir, échéances, alertes avant tâches du jour).
4. **Recherche intelligente partout** — recherche instantanée « type Google »
   qui réagit **dès la 1ʳᵉ lettre/chiffre**, sur *chaque* liste.
5. **Le logiciel force la complétude / bloque** — dossier incomplet ⇒ location
   impossible. Le logiciel *empêche* l'erreur, il ne fait pas que l'enregistrer.
6. **Segmentation & contexte visible** — filtres utiles, notes internes
   affichées, tri par pertinence métier.
7. **Communication client depuis l'app** — e-mails déclenchés (choix du moyen de
   paiement, relance, pièce manquante…).
8. **Précision d'affichage** — libellés exacts, **unités** (heure *et* jour sur
   les durées), formats de date, **vue par défaut** pertinente.
9. **Cohérence de nommage & ergonomie** — mêmes termes partout, cibles tactiles,
   états vides utiles.

---

## 2. Déjà couvert (ne PAS re-traiter)

- **Dashboard** : « Réservé » au-dessus de « Tâches du jour » ✓ · retours &
  récupérations en retard escaladés en haut, rouge ✓ · immobilisés incluant
  fourrière / non restitué / déplacement pro ✓ · semaine listant départs /
  retours / RDV / interventions avec « qui s'en charge » ✓.
- **Statuts véhicule** : `fourriere`, `non_restitue`, `deplacement_pro` présents
  (libellés + couleurs) ✓.
- **Clients** : segments Tous / VIP / Note interne / Blacklisté ✓ · alerte
  « dossier incomplet » ✓.
- **Comptabilité** : barre de recherche transactions/dépenses ✓.
- **Recherche intelligente** : composant `SmartSearch` (ouverture dès la 1ʳᵉ
  lettre, debounce 180 ms, anti-course réseau) câblé sur **clients, véhicules,
  réservations, contrats** ✓.

---

## 3. Constats transversaux (touchent plusieurs onglets)

### T1 — Recherche intelligente à généraliser · **P1**
`SmartSearch` est *exactement* ce qu'il a demandé, mais limité à 4 scopes.
**Sans recherche du tout** : Incidents (infractions & sinistres), Entretien,
Déplacements, Partenariats, Marketing, Équipe, Emails, Alertes.
→ **Anticipation** : dès qu'il voit la recherche instantanée marcher sur Clients,
il la voudra partout. Étendre `/api/search` + `SmartSearch` (nouveaux scopes) ou
poser une recherche locale instantanée sur chaque liste.

### T2 — Escalade automatique « heure dépassée → alerte » · **couvert à 90 %**
Sa règle (feedback dashboard) : *une tâche/échéance non traitée dont l'heure est
passée part en alerte*. Après lecture de `lib/utils/alerts.ts` (`fetchAllAlerts`),
le moteur est **bien plus complet qu'anticipé** — 11 escalades : contrats à
signer, retours en retard, CT/assurance/révision/km, tâches en retard, lavage
avant location, infractions > 30 j, sinistres, documents expirés, départs
imminents (< 1 h), échéances financières, récupérations en retard.
→ **Ne reste qu'1 trou réel** (détaillé plus bas) : **retour partenaire en
retard** (T2-a). Tout le reste escalade déjà.
→ **T2-b (email en échec) : parqué.** Normal en l'état — Resend en mode démo (pas
de domaine, pas d'hébergement actif) fait échouer *tous* les envois ; escalader
maintenant = flot de faux positifs. À réactiver **quand l'email sera en service**.

### T3 — Statut visible sans cliquer, partout · **P1**
Sur chaque liste, la pastille de statut doit être lisible d'un coup d'œil (comme
il l'a exigé pour les tâches). À contrôler onglet par onglet.

### T4 — Durées : afficher heure + jour · **P2**
Feedback réservations (« 24/72/168 → rajouter l'heure au jour »). Vérifier tout
affichage de durée dans l'app (contrats, factures, historiques).

---

## 4. Audit par onglet (pas encore relus par le gérant)

> _Sections remplies au fur et à mesure de la lecture du code._

### 🔴 BUG confirmé — lien alerte « Sinistre » → 404 · **P1**
La route réelle est `incidents/sinistres/[id]`. Aucune route `incidents/accidents`
n'existe. Tout le code pointe correctement vers `/incidents/sinistres/${id}`,
**sauf 2 liens d'alerte** — précisément ceux que le gérant cliquera :
- `app/(dashboard)/page.tsx:63` → puce dashboard `href: '/incidents/accidents'`
- `lib/utils/alerts.ts:265` → alerte `/incidents/accidents/${acc.id}`
→ clic sur « Sinistre en cours » = page 404. **Correctif : 2 lignes, zéro DB.**
C'est exactement le type de « je clique, ça marche pas » qu'il remonte aussitôt.

---

### ENTRETIEN (`/maintenance`)
- ✅ Tri par sévérité, dépassés en tête (tourné vers l'avant) · en-tête
  « X véhicules à traiter » · badges overdue/urgent/soon · dernière intervention
  + coût. Escalade révision/km **déjà** dans les alertes ✓.
- ⚠️ **Pas de barre de recherche** (T1) — il voudra filtrer par plaque/marque. **P1**
- ⚠️ **Pas de « qui s'en charge »** : l'entretien ne montre pas d'assigné alors
  qu'il suit l'assignation partout ailleurs (tâches, départs, retours). **P2**
- 💡 Filtre rapide « à traiter / à jour » (pastilles), comme Contrats. **P2**

### CONTRATS (`/contracts`)
- ✅ **`SmartSearch` déjà câblé** ✓ · pastilles statut + compteurs (brouillon /
  à signer / signé / clôturé) ✓ · en-tête « X à signer » ✓ · drapeau
  « ✓ Email envoyé » ✓ · date **+ heure** ✓ · contrats non signés escaladent ✓.
- 👍 Onglet **modèle** : rien à anticiper de majeur. RAS.

### INCIDENTS — infractions (`/incidents/infractions`)
- ✅ Réservé gérant/associé · pastilles statut + filtre véhicule · montant visible
  · escalade « infraction non réglée > 30 j » **déjà** en alerte ✓ · l'email
  `avis_infraction` existe (refacturation conducteur possible) ✓.
- ⚠️ **Pas de recherche** (T1) — plaque / client / type. **P1**
- 💡 Suivi du **recouvrement** : bouton « refacturée au client » + montant
  récupéré, pour ne pas perdre l'argent de l'amende. **P2**

### INCIDENTS — sinistres (`/incidents/sinistres`)
- ✅ Réservé gérant/associé · pastilles statut + filtre véhicule · **coût
  réparation + caution retenue visibles** (bonne visibilité argent) ✓ · escalade
  « sinistre en cours » **déjà** en alerte ✓ (mais lien 404, voir bug P1 ci-dessus).
- ⚠️ **Pas de recherche** (T1). **P1**
- 💡 Suivi assureur (n° sinistre / expert / indemnisation) — probablement sur la
  fiche détail ; à confirmer. **P3**

### DEPLACEMENTS (`/internal-trips`)
- ✅ Compteurs planifiés / en cours (tourné vers l'avant) ✓ · gérant coordonne,
  employé ne voit que les siens ✓ · statut `deplacement_pro` déjà géré côté flotte.
- ⚠️ **Pas de recherche** (T1) — moins critique (surface de coordination). **P2**
- 💡 Un déplacement `en_cours` dont l'heure de fin est dépassée n'escalade pas.
  Mineur (véhicule interne, pas client). **P3**

### PARTENARIATS (`/partnerships`)
- ✅ Onglets Sortants / Entrants · pastille statut · **marge / écart au tarif
  visible** (bonne visibilité argent) ✓ · km-retour & « chez partenaire » livrés.
- 🔴 **T2-a — retour partenaire en retard n'escalade PAS.** Une opération dont
  `end_date_expected` est dépassée (notre véhicule pas revenu du partenaire, ou
  le nôtre pas rendu) **n'apparaît nulle part en alerte** — exactement le « rien
  ne tombe entre les mailles » qu'il applique aux retours clients. **P2**
- ⚠️ Pas de recherche (T1). **P2** · dates sans heure (T4, multi-jours → mineur).

### EQUIPE (`/equipe`)
- ✅ Réservé gérant/associé · rôle, téléphone, **nb de tâches actives par membre**
  (badge orange = charge de travail) ✓ · actifs / inactifs séparés.
- 👍 Petit effectif : pas de recherche = acceptable. **P3** (au besoin plus tard).
- 💡 `hire_date` est chargé mais non affiché sur la carte. Cosmétique. **P3**

### DOCUMENTS (`/documents`)
- ✅ **Recherche déjà présente** ✓ · documents expirés/< 30 j escaladent déjà en
  alerte ✓. RAS majeur (à re-parcourir si besoin).

### EMAILS (`/emails`)
- ✅ Journal des envois (contrat, restitution, facture, avis infraction) · **échecs
  en rouge** ✓ · expéditeur + contenu décrit · l'axe « communication client »
  est donc réellement outillé.
- ⏸️ **T2-b — email en échec → alerte : PARQUÉ (normal en l'état).** Resend est en
  mode démo (pas de domaine, pas d'hébergement actif) → *tous* les envois
  échouent ; escalader `status = 'echec'` maintenant = faux positifs en masse.
  **À réactiver le jour où l'email passe en service.** Pas un trou de conception.
- ⚠️ Pas de recherche (retrouver « tous les emails du client X »). **P2**

### PARAMETRES (`/settings`)
- Réglages agence + **journal d'audit** (déjà avec recherche) — surface gérant,
  peu exposée au feedback terrain. À re-parcourir si besoin. RAS anticipé.

### MARKETING (`/marketing`)
- Campagnes / analytics — hors du flux opérationnel quotidien du gérant. Recherche
  absente mais faible priorité. **P3**

### ALERTES (`/alerts`) — le hub d'escalade
- ✅ Moteur `fetchAllAlerts` **très complet** (11 types, cf. T2) · groupes
  Urgents / Importants / Infos · sync calendrier à chaque visite.
- ⚠️ **Deux systèmes parallèles** : `/alerts` (calculé, `fetchAllAlerts`) **vs**
  `NotificationsList` + table `notifications` (push cron). Modèles différents →
  vérifier qu'ils ne se contredisent pas / ne font pas doublon. **P3**
- 💡 `AlertIcon` n'a pas d'icône pour `infraction / sinistre / document / echeance
  / recuperation_retard` → triangle générique par défaut. Cosmétique. **P3**

### INSPECTIONS / EDL (`/inspections`)
- Flux départ / arrivée + IA (`arrival`, `departure`, `ia-arrival`, `ia-departure`).
  Chantier EDL propre, distinct du périmètre « feedback gérant » de ce lot.
  À auditer séparément si demandé. Hors périmètre ici.

---

## 5. Synthèse — à traiter en avance (priorisé)

| # | Point | Axe | Prio | DB ? |
|---|-------|-----|------|------|
| 1 | **Lien alerte Sinistre → 404** (`/incidents/accidents` → `/incidents/sinistres`) | 2 | **P1** | non |
| 2 | **Recherche intelligente** sur Entretien, Infractions, Sinistres, Déplacements, Partenariats | 4 | **P1** | non |
| 3 | **T2-a** retour partenaire en retard → alerte | 2 | P2 | non* |
| 5 | Entretien : afficher l'assigné « qui s'en charge » | 6 | P2 | à voir |
| 6 | Infractions : suivi recouvrement / refacturation client | 7 | P2 | oui |
| 7 | Réconcilier les 2 systèmes d'alertes (`fetchAllAlerts` vs `notifications`) | 2 | P3 | non |
| 8 | Icônes d'alerte manquantes (cosmétique) | 9 | P3 | non |
| — | ~~T2-b email en échec → alerte~~ | 2/7 | **parqué** | — |

\* escalade purement calculée dans `fetchAllAlerts` (lecture de la table
existante `inter_agency_rentals`) — **aucune migration**.
**Parqué :** T2-b (email en échec) — normal tant que Resend est en démo / pas
d'hébergement actif ; à réactiver à la mise en service de l'email.

**Ordre de traitement proposé :** lot A = #1 + #2 (P1, zéro DB, fort impact,
sûr) → lot B = #3 (escalade partenaire, zéro DB) → lot C = #5 + #6 (nécessitent
peut-être du SQL manuel). Déploiement gated (permission + bump SW).
