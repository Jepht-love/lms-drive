# Le socle FleetLive

Les consignes générales de travail sont dans `~/CLAUDE.md` : qui je suis, comment me parler, comment traiter l'information, le protocole avant d'écrire du code, les règles avant de livrer, le socle shadcn. **Ce fichier ne contient que ce qui est propre à ce projet.**

@AGENTS.md

> **Le nom du dépôt ment, et c'est assumé.** Il s'appelle `lms-drive` parce qu'il a commencé là, mais **depuis le 28/07/2026 il porte le socle FleetLive, déployé pour plusieurs clients** : LMS Drive et Smart Loc, d'autres ensuite. Renommer casserait les liens Vercel et GitHub en pleine stabilisation ; la décision est de garder le nom. Voir §4.

## 1. Ce que c'est

Logiciel de gestion de flotte automobile, développé pour le gérant d'une société de location de véhicules — un ami de Jeff, qui a fourni le cahier des charges. C'est un back-office qui remplace ce qui se faisait sur Notion et sur des fichiers Excel : le parc en temps réel, les réservations, le calendrier des associés et des salariés, les locations longue durée et avec option d'achat et leur suivi de paiements, la comptabilité, les clients, les contrats, les documents, les incidents, l'entretien et les états des lieux.

## 2. Le cahier des charges — la référence

- **`CAHIER-DES-CHARGES.md`** (racine du dépôt) — **la synthèse à lire**, rubrique par rubrique : objectif, informations attendues, champs à tracer, statuts, alertes, et la correspondance avec les dossiers de l'appli. C'est le point d'entrée.
- **`docs/LOGICIEL-LMS-DRIVE-CDC.docx`** — l'original du gérant, 542 lignes. **Il fait foi** en cas de doute.

**Avant de préparer ou de modifier un onglet, lire sa section dans `CAHIER-DES-CHARGES.md`.** La réponse au comportement attendu y est presque toujours. Une fonctionnalité qui n'y figure pas ne s'ajoute pas de sa propre initiative — sauf pour les cinq rubriques ajoutées après (voir plus bas), qui n'y sont pas décrites.

**Le principe qui traverse tout le cahier des charges : chaque rubrique doit alimenter les autres automatiquement.** C'est l'exigence répétée à chaque section, et ce qui fait la valeur du logiciel aux yeux du gérant : une saisie unique qui se propage partout. Un écran qui enregistre correctement mais ne met pas à jour les modules liés **ne répond pas au cahier des charges**, même s'il « fonctionne ».

Les **11 rubriques qu'il définit** : Tableau de bord · Comptabilité · Entretien & suivi véhicule · Calendrier · Départ & retour · Répertoire client · Fiche technique de chaque véhicule · Marketing · Infraction et sinistre · Document · Utilisation interne des véhicules — plus une section détaillée sur la mise à disposition inter-agences.

Deux règles fortes qu'il pose et qu'il ne faut pas enfreindre :

- **Le tableau de bord ne montre aucune donnée financière** — ni comptabilité, ni bénéfices, ni dépenses. C'est délibéré : la page d'accueil doit rester accessible à tous les collaborateurs. Y ajouter un indicateur d'argent est une faute, pas une amélioration.
- **Chaque information affichée doit être cliquable** et renvoyer vers l'onglet qui la détaille.

### Le périmètre a évolué depuis, avec l'accord du gérant

Cinq rubriques ont été ajoutées en cours de route — **Contrats, Partenariats, Équipe, E-mails, Paramètres** — des fonctionnalités de gestion demandées et validées par le gérant. Elles sont donc parfaitement légitimes : le tableau de suivi en compte 16 là où le cahier des charges en décrit 11, et c'est normal.

Deux choses à en retenir :

- **Ces cinq rubriques ne sont décrites dans aucun document.** Pour elles, la référence est le gérant lui-même, pas le cahier des charges. Ne pas conclure d'une absence dans le CDC qu'une fonctionnalité est hors périmètre.
- **La source de vérité de ce qui existe réellement est `lib/navigation/tabs.ts`** — 10 onglets dans le menu, plus les 4 modules réservés aux managers (compta, marketing, équipe, paramètres) qui n'y figurent pas.

## 3. Ce dépôt ne porte plus rien de commercial

Tout le logiciel livré aux clients est dans `app/(dashboard)/`.

**La vitrine commerciale n'est plus ici.** Elle vit dans son propre projet, `~/fleetlive`, refondu le 27/07/2026 (mode clair et sombre, grille tarifaire, FAQ, écrans de gestion de flotte). L'ancienne vitrine qui cohabitait dans ce dépôt — `app/fleetaxis/`, `components/fleetaxis/`, `lib/fleetaxis-i18n.ts`, 13 fichiers — a été **retirée le 27/07/2026 sur décision de Jeff** : elle était devenue une version périmée de la marque, accessible sur le domaine du logiciel sans qu'aucun lien n'y mène. Elle reste dans la corbeille et dans l'historique git si besoin.

**Conséquence à garder :** ne rien recréer de commercial ici. Une page vitrine, un tarif public, un formulaire de démonstration vont dans `~/fleetlive`. Et toujours **aucune fuite dans l'autre sens** : aucune donnée, aucun nom, aucun visuel du client LMS Drive côté FleetLive.

## 4. Un seul code, plusieurs clients — décidé le 28/07/2026

FleetLive détient la licence, chaque client n'en est que l'utilisateur. **Ce qui se partage entre clients, ce sont les fonctionnalités** : réservation, calendrier, flotte, déplacements, entretien, inspection, comptabilité, tableaux de bord et indicateurs. **Ce qui ne se partage jamais, ce sont les données.**

### La règle de séparation

| | Où ça vit |
|---|---|
| Le code, les écrans, les fonctionnalités | Ce dépôt, partagé par tous les clients |
| L'identité d'un client (nom, logo, couleurs, expéditeur, coordonnées, identifiant mobile) | La configuration client, lue au démarrage |
| Ses données (clients, véhicules, contrats, montants, tarifs, cachet) | **Sa propre base Supabase, une par client** |

**Aucune valeur propre à un client ne s'écrit dans le code.** Ni un nom, ni un SIRET, ni un tarif, ni une adresse e-mail. Elle va dans la configuration client ou en base. C'est la seule discipline qui fait tenir le modèle quand il y aura quatre clients, et c'est la première chose à vérifier avant d'ajouter une constante.

**Pas de multi-société dans une même base.** Un client, une base, un déploiement. Ce n'est pas une architecture multi-locataire : les tables ne portent pas de notion de société et ne doivent pas en porter.

### Comment les mises à jour circulent

- **LMS Drive vit sur la branche `main`.** Chaque autre client a **sa propre branche de production**, branchée sur son projet Vercel.
- **La bascule est automatique par défaut**, avec un gel possible et explicite quand un gérant est en démonstration ou en formation. Un gel se décide, il ne se subit pas.
- **Une correction de bug ou de sécurité part toujours chez tous les clients.** C'est ce que couvre le contrat d'assistance, ce n'est pas négociable.
- **Une nouvelle fonctionnalité arrive éteinte**, avec un interrupteur que le client allume quand il veut.
- **Une modification propre à un seul client est un interrupteur de configuration, jamais du code à part.** Si ça ne peut pas être un réglage, ça remonte à Jeff avant d'être écrit.

### Toute fonctionnalité doit se dupliquer simplement — règle du 29/07/2026

Amener une fonctionnalité chez un nouveau client ne doit demander **aucune ligne de code**. Créer un client, c'est créer sa base, remplir sa configuration et déployer. Rien d'autre.

**La question à se poser avant de considérer une fonctionnalité comme finie :** est-ce que je peux la livrer au client suivant sans ouvrir un fichier de code ? Si la réponse est non, elle n'est pas finie, et le travail restant appartient au socle, pas au client.

Deux écarts vérifiés le 29/07/2026, tous deux dans le chantier Smart Loc :

- **Les jours du week-end sont figés dans le code.** `WEEKEND_DAYS` (`lib/utils/index.ts`, ligne 97) vaut `[5, 6, 0]` avec un commentaire annonçant que c'est la seule ligne à modifier si le gérant change sa règle. Sans effet pour Smart Loc, qui a la même règle que LMS Drive, mais un troisième client au week-end différent obligerait à la changer pour tout le monde. **À descendre en réglage d'agence** (lot 1 du chantier Smart Loc).
- **`lib/seed/vehicles.ts` porte les 10 véhicules de LMS Drive en dur**, avec leurs tarifs et leurs kilomètres inclus. Il ne doit jamais servir à créer l'agence d'un autre client (lot 2).

**Ce qui se duplique déjà correctement, vérifié le 29/07 :** le forfait week-end (`vehicles.price_weekend_full`) et les kilomètres inclus sont portés par chaque véhicule en base. Les activer chez un nouveau client ne demande aucune modification technique.

**À construire, pas encore fait : l'onglet « Mises à jour ».** Chaque dimanche, le client y voit ce qui a changé, écrit en langage métier, et choisit d'appliquer maintenant ou de reporter d'une semaine. Il choisit **le moment, pas le contenu** : le contenu à la carte reviendrait à maintenir un logiciel différent par client. Chantier de 4 à 6 jours, placé après la livraison de Smart Loc.

### Deux familles de projets — ne pas les confondre

1. **Jumeau du socle** : même code, même périmètre, identité et base différentes. **Smart Loc**, et lui seul à ce jour. Le gérant a demandé exactement le logiciel de son confrère.
2. **Produit à part** : son propre dépôt, un autre besoin, aucun code partagé avec ici. **Jums Loc** (réservation en ligne par le client final, autre génération de shadcn) et **UNFPA RDC** (besoin différent de la location). **Ne jamais copier un composant entre ce dépôt et ceux-là**, ils ne s'écrivent pas pareil.

Le socle peut techniquement se réadapter à un autre secteur (masquer tarif et caution, renommer « location » en « mission »), mais **ce n'est le cas d'aucun client aujourd'hui**. Ne pas partir de cette hypothèse sans que Jeff l'ait dit.

### Ce que ça change au quotidien

Chaque bug corrigé ici est un bug que Smart Loc et les suivants n'auront jamais. C'est ce qui rend la stabilisation actuelle rentable bien au-delà du premier client, et ce qui justifie de corriger la cause de fond plutôt que le symptôme.

**Avant de modifier un écran, se demander pour quel client on le fait.** Une modification faite pour Smart Loc arrive chez LMS Drive, et l'inverse est vrai.

### Les clients, et où lire leur fiche

| Client | Fiche | Base |
|---|---|---|
| **LMS Drive** (1re licence) | dans ce fichier, §5 à §7 | projet `vtxoqybfqdauhblavvza` |
| **Smart Loc** (2e licence) | `~/smartloc/CLAUDE.md` | projet dédié, à créer |

**Avant de travailler pour un client, lire sa fiche.** Elle contient son identité, ses tarifs, son calendrier et ce qui reste à vérifier chez lui. Ne pas redemander ce qui y est écrit.

---

> **Les §5 à §7 sont la fiche du client LMS Drive**, pas des règles du socle. Elles restent ici parce que LMS Drive est le projet du quotidien jusqu'au 30/08/2026 et que le fichier doit se charger quand on travaille dans le dépôt. À sortir dans son propre dossier quand un troisième client rejoindra le socle.

## 5. Qui s'en sert — LMS Drive

- **Le gérant** — il commande le produit, il teste, et il remonte ses bugs par la rubrique SAV intégrée (1 à 2 par jour).
- **Les associés et les salariés** — le calendrier, les réservations et les états des lieux, au quotidien.
- Une bonne partie de l'usage se fait **sur téléphone et sur tablette**, sur le terrain.

**Quatre rôles** dans le code (`lib/roles.ts`) : `gerant`, `associe`, `employe`, `prestataire` — plus un super-utilisateur `is_admin` qui prime sur le rôle. **Les permissions se font onglet par onglet** via `profiles.allowed_tabs` : gérants et associés voient tout, un employé ne voit que ses onglets autorisés (vide = accès complet, par compatibilité). Compta, marketing, équipe et paramètres restent réservés aux managers et ne passent pas par `allowed_tabs`.

**Le niveau d'exigence sur mobile est celui des applications grand public récentes, pas celui d'un outil interne.** C'est l'image de Jeff qui se joue ici : c'est sa vitrine auprès de son premier client. Un écran qui déborde, un bouton qu'on n'atteint pas au pouce, un geste qui ne répond pas, une fenêtre qu'on ne peut pas fermer — bugs prioritaires, jamais des détails d'affichage. Vérifier le rendu en largeur téléphone **et** tablette avant de considérer un travail fini.

## 6. Où en est LMS Drive

- **Aujourd'hui : phase de test.** Toutes les rubriques existent, on stabilise. 20 à 40 corrections par jour.
- **Mi-août 2026 : déploiement terrain** avec de vraies données. **Septembre 2026 : opérationnel.** Le créneau de travail sur LMS Drive court jusqu'au 30 août.

### Le rythme réel : validation onglet par onglet

Le gérant teste quand il a le temps, et il y a un **point de retour tous les mardis après-midi**. On valide **un onglet à la fois**, au rythme d'un à deux par semaine. **4 validés** : Tableau de bord, Calendrier, Réservation, Répertoire client.

Ordre de priorité des suivants : fiche technique véhicule et entretien (le parc doit être carré d'abord), puis contrats et déplacements (le cœur départ/retour), puis incidents, puis comptabilité, puis partenariats, équipe, documents, e-mails, et enfin marketing et paramètres.

**Bon à savoir : « Suivi véhicule » vaut trois onglets d'un coup** — le gérant valide Entretien, Sinistres et Infractions en une seule séance, puisqu'ils sont réunis sur la même page.

La semaine type : du mercredi au lundi on corrige les retours du mardi **et** on prépare le prochain onglet pour qu'il soit testable. Ne jamais préparer plus de deux onglets d'avance — le gérant n'en teste qu'un par semaine, et un onglet impeccable vaut mieux que trois à moitié prêts.

### Préparer un onglet à faire tester

**Jeff saisit les données de démonstration à la main dans l'application** — véhicules, clients, réservations d'exemple. C'est un travail long qu'il refait à chaque onglet.

Conséquence directe : **son travail de préparation est fragile.** Une migration qui vide ou réinitialise une table, un script de nettoyage, un `delete` un peu large, et il perd des heures avant un point du mardi. Avant toute opération qui touche des données existantes, le dire clairement et attendre.

### Ce que le calendrier impose

- **La régression est l'ennemi numéro un.** Casser un écran qui fonctionnait coûte beaucoup plus cher que de laisser un défaut mineur. Avant de modifier un fichier partagé (`lib/`, un composant réutilisé), vérifier qui d'autre s'en sert.
- **Quand un bug est signalé, chercher si le même défaut existe ailleurs.** Un motif copié d'un écran à l'autre produit le même bug dans dix rubriques ; corriger la seule occurrence signalée en laisse neuf. **Pour les remontées du SAV, ce balayage revient à l'agent `chercheur-de-jumeaux`** : le lancer après correction, sans attendre que Jeff le demande. Il repasse ensuite vérifier que tout est réellement réglé. Ne pas le lancer sur un simple ajustement d'affichage demandé par Jeff.
- **Pas de refonte lourde d'ici septembre.** Si j'en repère une qui devient nécessaire, la signaler sans la lancer.

## 7. D'où viennent les corrections

Quatre sources, à traiter différemment :

1. **Les tests de Jeff à l'écran** — il parcourt l'appli avant de la confier au gérant. Le plus gros volume.
2. **Les remontées du gérant via le SAV** — 1 à 2 par jour, mais **les plus qualifiées** : ce sont de vrais usages réels. Priorité haute.
3. **Le point du mardi** — retours groupés de la séance de validation.
4. **react-doctor et les outils automatiques** — beaucoup de volume, souvent sans impact visible pour l'utilisateur. À confronter au code avant d'agir, et à ne pas confondre avec un vrai bug métier.

Un défaut vu par le gérant ou par Jeff à l'écran passe **toujours** devant une alerte d'outil.

### Le circuit d'une remontée du SAV

Quand Jeff demande de traiter le SAV, trois agents s'enchaînent — ils sont définis dans `~/.claude/agents/` et n'écrivent jamais dans ses fichiers de travail.

1. **`correcteur-sav`** lit la remontée et la capture jointe dans `/sav`, reproduit le défaut à l'écran, en trouve la cause, écrit la correction dans une copie isolée du dépôt et produit un fichier de correctif.
2. **`chercheur-de-jumeaux`** part **en même temps**, dès que la cause est connue : il balaye l'application à la recherche du même défaut ailleurs. Une seule passe de correction au lieu de deux.
3. **`relecteur-de-correctif`** juge la correction avant qu'elle n'arrive chez Jeff, avec pour consigne de refuser par défaut. C'est le seul contrôle qu'elle reçoit — il n'y a aucun test automatique.

**Rien ne s'applique tout seul.** Jeff lit le verdict et décide ; le correctif n'entre dans le projet que s'il le dit. Toute opération sur la base de données est affichée en entier et jamais exécutée par un agent.

Ne pas lancer ce circuit sur un simple ajustement d'affichage demandé par Jeff : il est fait pour les vrais défauts remontés du terrain.

## 8. Stack et déploiement

- **Next.js 16.2.7** (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui (voir §10 du CLAUDE.md général).
- **Supabase** pour la base, l'authentification et le stockage. **Un projet par client**, organisation `sas-financial-services` : `vtxoqybfqdauhblavvza` (LMS DRIVE, eu-central-1), celui de Smart Loc à créer. Accessible via l'outil Supabase, les migrations s'exécutent automatiquement après avoir affiché le SQL dans la réponse. **Toujours vérifier sur quel projet on écrit avant de lancer quoi que ce soit.**
- ⚠️ **L'organisation est sur le plan gratuit : aucune sauvegarde automatique, et 2 bases actives au maximum.** La base de production de LMS Drive est aujourd'hui sans filet. Signalé à Jeff le 28/07/2026, décision en attente. Le troisième client imposera le plan payant.
- Resend pour les e-mails, date-fns pour les dates.
- **Déploiement : Vercel, un projet par client.** `lms-drive` sur la branche `main`, `smartloc` sur sa propre branche de production.
- **Cette version de Next.js n'est pas celle que je crois connaître.** Avant d'écrire du code qui touche au routage, aux Server Actions, au cache ou aux paramètres de page, lire le guide concerné dans `node_modules/next/dist/docs/`.

### ⚠️ Le gérant utilise le site en direct, pas une application installée

Il ouvre l'adresse web depuis son téléphone (ou l'icône sur son écran d'accueil). Un dossier `ios/` existe avec une configuration Capacitor (`com.fleetlive.lmsdrive`), mais **l'application native n'est pas ce qu'il utilise**.

Conséquence : **tout ce qui est déployé arrive chez lui immédiatement.** Il n'y a aucun délai de validation, aucune version à approuver, aucun filet. Un déploiement non vérifié est un défaut livré directement au client. C'est pour ça que les captures d'écran avant livraison (§8 du CLAUDE.md général) ne sont pas une formalité.

### Chantier décidé, pas encore lancé : les tests automatiques

Il n'existe aujourd'hui **aucun test automatique** (`CARTOGRAPHIE.md` le constate : ni Playwright, ni Jest, ni Vitest, ni bibliothèque de validation des saisies). Décision prise avec Jeff : **des séries de tests automatiques sur tous les onglets**, pour détecter les bugs en amont au lieu de les découvrir au point du mardi ou sur le terrain.

Ce chantier ne se lance pas de sa propre initiative. Quand il démarrera, il suivra l'ordre de validation des onglets — un onglet couvert est un onglet qui ne régressera plus quand on touchera au code partagé.

## 9. Commandes

- `npm run dev` — lancer en local
- `npm run build` — doit passer avant d'annoncer qu'un travail est terminé
- `npm run lint`
- `npm run doctor` — passe react-doctor

## 10. Repères de code

- `app/(dashboard)/<rubrique>/` — un dossier par onglet du menu
- `lib/navigation/tabs.ts` — le menu et le filtrage des permissions. **Source de vérité des onglets réellement visibles.**
- `lib/roles.ts` — les quatre rôles et leurs libellés
- `lib/actions/` — les Server Actions (ce qui écrit en base)
- `lib/supabase/` — les clients Supabase
- `app/(dashboard)/sav/` — le canal par lequel le gérant remonte ses bugs. **C'est aussi un produit facturé** : FleetLive vend une assistance 24h/24 assurée par son équipe, et tout passe par cette rubrique. Elle doit être irréprochable — c'est la vitrine du service que le client paie.
- `supabase/migrations/` — 72 migrations numérotées `0XX_nom.sql`. Une nouvelle prend le numéro suivant. **Une migration construit la structure, elle ne charge jamais de données d'un client.** Plusieurs anciennes enfreignent cette règle (la 064 réécrit les tarifs des 10 véhicules de LMS Drive plaque par plaque) : elles ne doivent jamais partir sur la base d'un autre client. Le tri est le lot 2 du chantier Smart Loc.
- **Graphiques : `recharts` 3.8.1**, avec trois fichiers de référence — détail dans `~/.claude/rules/design-front.md`, qui se charge dès qu'on touche un composant.

### Les notes de reprise — règle du 29/07/2026

**Tout code écrit pour une fonctionnalité, une reprise d'existant ou un changement de structure porte ses notes**, destinées à un développeur qui reprendrait le projet sans Jeff. Règle complète dans le §7 du CLAUDE.md général. Ici, les deux endroits :

- **En tête du fichier**, en français : à quoi il sert, ce qu'il attend et ce qu'il produit s'il calcule, qui d'autre s'en sert, ce qu'il ne faut pas casser. Le style existe déjà dans le dépôt, `lib/utils/index.ts` en est le modèle à suivre.
- **`docs/technique/<rubrique>.md`** : une fiche par rubrique — les fichiers qui la composent, ses tables, ses Server Actions, ce qui la relie aux autres rubriques, ses pièges. Plus fine que `CARTOGRAPHIE.md`, qui reste l'inventaire global.

Pas de note sur les corrections quotidiennes ni sur un ajustement d'affichage. **Tout fichier rouvert pour une fonctionnalité repart avec son résumé** : pas de chantier de documentation séparé.

### Documents déjà écrits — les lire avant de refaire le travail

- **`CAHIER-DES-CHARGES.md`** — ce que le gérant attend, rubrique par rubrique (voir §2).
- **`CARTOGRAPHIE.md`** — inventaire vérifié du 25/07/2026 : 379 fichiers, 49 800 lignes, 80 pages, 103 Server Actions, 35 tables, et les constats d'architecture (pas de multi-client, aucun outil de test, aucune validation des saisies).
- `ARCHITECTURE_PLAN.md`, `AUDIT-GERANT-ANTICIPATION.md`, `MIGRATION.md`.
- `docs/` — l'original du cahier des charges, `STRATEGIE_BUGS_2026-07-20.md`, `STRATEGIE_BUG5_EDL.md`, et `design-refs/`.

## 11. Pièges connus

- **`calendar` et `calendrier` coexistent, et c'est voulu — ne pas supprimer `calendar`.** Le calendrier actuel est `/calendrier` (agenda et disponibilités), celui du menu. L'ancien `/calendar` a été vidé : il ne reste qu'un aiguillage vers `/calendrier`, pour que les anciens favoris et les vieilles notifications push ne tombent pas sur une page d'erreur. Et `/calendar/tasks` est bien vivant : c'est là que vivent les tâches, avec sept renvois depuis les notifications, les alertes et la fiche d'un salarié. *Vérifié le 26/07/2026.*
- **`maintenance` et `incidents` sont fusionnés dans `/suivi` — même schéma, ne rien supprimer.** La page « Suivi véhicule » réunit trois volets : Entretien, Sinistres, Infractions. `/maintenance` et `/incidents` ne sont plus que des aiguillages vers `/suivi`, conservés pour les liens et marque-pages existants. **Mais `/incidents/sinistres/new` et `/incidents/infractions/new` sont bien vivants** : les formulaires de création y vivent, liés depuis les sections de `/suivi`. *Vérifié le 26/07/2026.*
- **Le piège « FleetAxis » est éteint.** L'ancien nom apparaissait à 17 endroits visibles de la vitrine qui vivait ici ; cette vitrine a été retirée le 27/07/2026 (voir §3) et il ne reste **aucune mention de FleetAxis dans le code** — vérifié. La marque est **FleetLive**, confirmée par l'identifiant de l'app mobile `com.fleetlive.lmsdrive`. Si le sujet revient, il concerne le projet `~/fleetlive`, pas ce dépôt.
- **Les règles d'accès Supabase (RLS) ne sont pas automatiques.** Plusieurs migrations récentes n'existent que pour les activer après coup. Une nouvelle table sans ses règles est soit ouverte à tout le monde, soit invisible depuis l'appli.
- **Décision déjà tranchée, à ne pas re-proposer** : les `const { id } = await params` suivis de `const supabase = await createClient()` restent en l'état. Aucun des deux ne fait d'aller-retour réseau, il n'y a rien à gagner. Ce n'est pas un oubli.
- **Différé volontairement** : dans `lib/actions/reservations.ts` (autour de la ligne 469), une lecture précède une écriture sur la même réservation. Les paralléliser ferait gagner un aller-retour et risquerait un statut de location incohérent. À laisser tel quel.
- **Une heure mise en forme côté serveur doit passer par `lib/format/heureAgence.ts`.** Vercel tourne en temps universel : un `toLocaleTimeString` écrit directement dans une notification, un e-mail ou un PDF affiche deux heures de moins qu'en France l'été, une de moins l'hiver. Constaté le 27/07/2026 sur « Retour dans 1 h », qui annonçait 10:00 pour un retour réel à 12:00 — le rappel partait à la bonne heure, seul le texte était faux. Le repère est `BUSINESS_TZ` (`lib/calendar/constants.ts`). Dans un écran affiché par le navigateur, ce détour est inutile : le téléphone est déjà à l'heure française.
- **Le bloc « tarifs par défaut » de l'écran des paramètres ne pilote rien.** Les six champs de `agency_settings` (`extra_km_rate`, `late_hourly_rate`, `late_daily_rate`, `fuel_rate_per_liter`, `default_deposit`, `insurance_deductible`) sont enregistrés et réaffichés, mais **aucun autre fichier ne les lit** : vérifié le 28/07/2026, zéro utilisation hors de `settings/AgencySettingsForm.tsx`, `lib/contracts/agency.ts` et `lib/actions/agency.ts`. La facturation prend le prix inscrit **sur le véhicule** (`vehicles.extra_km_price`). Conséquence visible : l'écran affiche 1 € du kilomètre alors que les factures comptent 2 €. Le gérant peut modifier ces champs en croyant changer ses tarifs, sans aucun effet. **Défaut réel, non corrigé, qui touchera aussi Smart Loc.**
- **Le score de react-doctor se calcule sur le nombre de règles distinctes**, pas sur le nombre d'occurrences. Il ne bouge donc pas quand on vide une règle de ses cas. Ne pas en conclure que le travail n'a servi à rien.

## 12. graphify

Le graphe de connaissance du code est dans `graphify-out/`. Voir le CLAUDE.md général pour son mode d'emploi.
