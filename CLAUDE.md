# LMS Drive

Les consignes générales de travail sont dans `~/CLAUDE.md` — qui je suis, comment me parler, comment traiter l'information, le protocole avant d'écrire du code, les règles avant de livrer, le socle shadcn. **Ce fichier ne contient que ce qui est propre à ce projet.**

@AGENTS.md

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

## 3. Ce dépôt ne porte plus qu'une chose : LMS Drive

Tout le logiciel livré au premier client est dans `app/(dashboard)/`.

**La vitrine commerciale n'est plus ici.** Elle vit dans son propre projet, `~/fleetlive`, refondu le 27/07/2026 (mode clair et sombre, grille tarifaire, FAQ, écrans de gestion de flotte). L'ancienne vitrine qui cohabitait dans ce dépôt — `app/fleetaxis/`, `components/fleetaxis/`, `lib/fleetaxis-i18n.ts`, 13 fichiers — a été **retirée le 27/07/2026 sur décision de Jeff** : elle était devenue une version périmée de la marque, accessible sur le domaine du logiciel sans qu'aucun lien n'y mène. Elle reste dans la corbeille et dans l'historique git si besoin.

**Conséquence à garder :** ne rien recréer de commercial ici. Une page vitrine, un tarif public, un formulaire de démonstration vont dans `~/fleetlive`. Et toujours **aucune fuite dans l'autre sens** : aucune donnée, aucun nom, aucun visuel du client LMS Drive côté FleetLive.

## 4. Le socle sert à équiper d'autres clients — et c'est voulu

FleetLive détient la licence, LMS Drive n'en est que l'utilisateur. **Ce qui se transpose d'un client à l'autre, ce sont les fonctionnalités** — réservation, calendrier, flotte, déplacements, entretien, inspection, comptabilité, tableaux de bord et indicateurs. Les données du client ne se transposent pas : on n'en veut pas.

Le modèle n'est **pas** de faire cohabiter plusieurs sociétés dans une même base. C'est de **repartir du socle et de le réadapter** : masquer ce qui ne sert pas (tarif jour, caution, contrat de location, dommages facturables pour une flotte qui n'est pas louée), renommer le vocabulaire (« location » devient « mission »), ajouter ce qui manque au secteur. Ne pas proposer d'architecture multi-société.

**Ce que ça change au quotidien :** chaque bug corrigé ici est un bug que Smartlocation, Jumloc75 et les suivants n'auront jamais, puisqu'ils partiront du socle assaini. C'est ce qui rend la stabilisation actuelle rentable bien au-delà du premier client, et ce qui justifie de corriger la cause de fond plutôt que le symptôme.

Un réflexe à garder : **ce qui est propre à LMS Drive doit rester identifiable et remplaçable** (nom de société, SIRET, logo, tarifs, mentions de contrat).

## 5. Qui s'en sert

- **Le gérant** — il commande le produit, il teste, et il remonte ses bugs par la rubrique SAV intégrée (1 à 2 par jour).
- **Les associés et les salariés** — le calendrier, les réservations et les états des lieux, au quotidien.
- Une bonne partie de l'usage se fait **sur téléphone et sur tablette**, sur le terrain.

**Quatre rôles** dans le code (`lib/roles.ts`) : `gerant`, `associe`, `employe`, `prestataire` — plus un super-utilisateur `is_admin` qui prime sur le rôle. **Les permissions se font onglet par onglet** via `profiles.allowed_tabs` : gérants et associés voient tout, un employé ne voit que ses onglets autorisés (vide = accès complet, par compatibilité). Compta, marketing, équipe et paramètres restent réservés aux managers et ne passent pas par `allowed_tabs`.

**Le niveau d'exigence sur mobile est celui des applications grand public récentes, pas celui d'un outil interne.** C'est l'image de Jeff qui se joue ici : c'est sa vitrine auprès de son premier client. Un écran qui déborde, un bouton qu'on n'atteint pas au pouce, un geste qui ne répond pas, une fenêtre qu'on ne peut pas fermer — bugs prioritaires, jamais des détails d'affichage. Vérifier le rendu en largeur téléphone **et** tablette avant de considérer un travail fini.

## 6. Où en est le projet

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
- **Supabase** pour la base, l'authentification et le stockage. Projet `vtxoqybfqdauhblavvza` (LMS DRIVE, eu-central-1), accessible via l'outil Supabase — les migrations s'exécutent automatiquement, après avoir affiché le SQL dans la réponse.
- Resend pour les e-mails, date-fns pour les dates.
- **Déploiement : Vercel**, projet `lms-drive`.
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
- `supabase/migrations/` — 65 migrations numérotées `0XX_nom.sql`. Une nouvelle prend le numéro suivant.
- **Graphiques : `recharts` 3.8.1**, avec trois fichiers de référence — détail dans `~/.claude/rules/design-front.md`, qui se charge dès qu'on touche un composant.

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
- **Le score de react-doctor se calcule sur le nombre de règles distinctes**, pas sur le nombre d'occurrences. Il ne bouge donc pas quand on vide une règle de ses cas. Ne pas en conclure que le travail n'a servi à rien.

## 12. graphify

Le graphe de connaissance du code est dans `graphify-out/`. Voir le CLAUDE.md général pour son mode d'emploi.
