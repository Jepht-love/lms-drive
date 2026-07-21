# BUG 5 — EDL « 6 vues précises » : stratégie détaillée

> Contrainte utilisateur (verbatim) : *« je veux pas le granuler sur le schéma 3D,
> juste les 6 plans de la nouvelle voiture avec le découpage de chaque pièce par
> sélection comme sur la version actuelle mais plus précise »*.
> → Pas de maillage 3D. On reste sur des **plans 2D à plat**, sélection **par pièce**,
> mais un tracé **plus fin et net**, et **6 vues**.

---

## 1. Diagnostic de l'existant

| Élément | État actuel | Fichier |
|---|---|---|
| Fond | **1 PNG raster** `vehicle-blueprint-v3.png` (1254×1254), flou au zoom | `public/edl/` |
| Zones | **40 ids uniques** (~50 polygones), **tracés à la main** en coord. absolues | `components/vehicle-schema/edl-zones.ts` |
| Vues | **5** : dessus · avant · arrière · profil gauche · profil droit | (baked dans le raster) |
| Rendu | `<image>` + polygones SVG superposés, tap → zoom `viewBox` animé → formulaire dommage | `VehicleMap2D.tsx` |
| Réutilisation | **Source unique** partagée app interactive **+ PDF contrat** | `edl-zones.ts` |
| Persistance | dommages = `inspections.damaged_zones = [{ id, severity, type, comment, photos }]` | DB |

## 2. Pourquoi « pas assez précise » (causes racines)

1. **Fond raster flou** → au zoom, l'image pixelise ; les polygones tracés main débordent
   ou laissent des trous (zones mortes non cliquables entre deux pièces).
2. **Découpage grossier** : une portière = 1 seul polygone. Pas de distinction fine
   (custode, montant, poignée, bas de vitre…).
3. **5 vues, pas 6** : il manque une vue (dessous, ou une 6ᵉ face à définir).
4. **Chevauchements / trous** : les zones ne forment pas une partition propre de la
   carrosserie → tap parfois « à côté ».

## 3. ⚠️ Contrainte dure : stabilité des `id`

Les dommages sont **stockés en base** par `zone.id` et **comparés départ↔retour**
(`lib/actions/invoices.ts:61` → `filter(z => !previousZoneIds.has(z.id))` ;
génération de facture des dommages sur cette base).

> **Conséquence** : on **ne renomme pas** et on **ne supprime pas** un `id` existant,
> sinon les EDL déjà signés sont orphelins et la comptaison/facturation casse.
> On peut **ajouter** des ids plus fins, à condition de fournir une **table d'alias**
> `LEGACY_ALIAS` (ancien id → nouvel id englobant) pour ré-afficher l'historique.

## 4. Cible proposée (respecte toutes les contraintes)

**Principe : passer du raster tracé-main à un schéma vectoriel net, une pièce = un
`<path>` SVG précis, 6 vues, ids stables, réutilisé dans le PDF.**

### ✅ Décisions verrouillées (2026-07-20)
- **Source** : **(B) calqué sur TA voiture** — vectorisation à partir des images que tu fournis.
- **Vues** : **5** (dessus · avant · arrière · gauche · droite). **Pas de 6ᵉ vue.**
- **Découpage** : **mêmes 40 pièces, mieux tracées** (ids conservés, aucun nouvel id).

### ⚙️ Réalité outillage (contrainte technique)
Aucun outil de vectorisation auto en local (potrace / autotrace / inkscape / imagemagick /
vtracer **tous absents**). Donc « photo → SVG propre » automatique **n'est pas possible ici**.
→ Deux façons viables de « vectoriser ta voiture » :
1. **Idéal** : tu fournis un **fichier vectoriel** des plans (SVG / PDF / AI) → j'extrais et
   nettoie directement les tracés + je détoure les pièces au pixel près.
2. **Réaliste** : tu fournis des **images line-art nettes haute résolution** (5 plans) → je les
   utilise en fond net et je **retrace les 40 pièces en `<path>` SVG précis** (la *sélection*
   devient vectorielle et exacte ; c'est ce qui compte pour la précision au tap).
   *(Des photos de la vraie voiture ne se transforment pas en plans propres — éviter.)*

### 4.2 Découpage par pièce
- Chaque pièce = **un `<path>` fermé précis** ; l'ensemble forme une **partition**
  (contours jointifs, ni trou ni chevauchement) → tap toujours juste.
- **Ids existants conservés** (les 40) — aucun renommage, aucun ajout (décision verrouillée).

### 4.3 Modèle de données (évolution douce de `edl-zones.ts`)
```ts
export const EDL_VIEWS = [
  { id: 'dessus',   label: 'Dessus',        viewBox: '…' },
  { id: 'avant',    label: 'Face avant',    viewBox: '…' },
  { id: 'arriere',  label: 'Face arrière',  viewBox: '…' },
  { id: 'gauche',   label: 'Profil gauche', viewBox: '…' },
  { id: 'droite',   label: 'Profil droit',  viewBox: '…' },
  { id: 'dessous',  label: 'Dessous',       viewBox: '…' }, // 6ᵉ vue — à confirmer
] as const

export type Zone2D = {
  id: string; label: string;
  view: EdlViewId;        // ← nouveau : rattache la pièce à sa vue
  d: string;              // ← nouveau : path SVG précis (remplace points[])
  // points?/shape? conservés en fallback pour compat pendant la migration
}
export const LEGACY_ALIAS: Record<string, string> = { /* ancien → nouvel id */ }
```
- `zoneBox()` continue de marcher (bounding box d'un path).
- `VehicleMap2D` : rendu par vue (onglets/sélecteur de vue) + `<path d=…>` au lieu de
  `<polygon points=…>`. Le zoom/tap/formulaire/badges D/R **restent identiques**.
- **PDF contrat** : consomme la même source → aucune divergence.

## 5. Migration & compatibilité
- Les EDL existants (ids actuels) s'affichent tels quels (ids conservés).
- Si on ajoute des ids fins : `LEGACY_ALIAS` reprojette un ancien dommage sur la
  nouvelle pièce englobante pour l'affichage comparatif.
- Aucune migration SQL destructive. Bump `EDL_SRC`/version d'asset au déploiement.

## 6. Ce qu'il me faut de toi pour démarrer (bloquant)

Décisions faites (§4). Reste **le matériel de référence de ta voiture** :
- **De préférence** : un **fichier vectoriel** des 5 plans (SVG / PDF / AI / EPS).
- **Sinon** : des **images line-art nettes** (idéalement les 5 vues séparées, haute
  résolution, fond blanc, traits nets — pas des photos).
- Précise la **marque/modèle** (calibrage des proportions).

Sans ce matériel, l'étape 2 (produire le SVG) ne peut pas démarrer.

## 7. Plan d'exécution (après validation)
1. Geler la liste des vues + pièces + ids (conserver les 40, mapper les alias).
2. Produire le SVG 6 vues (gabarit générique **ou** vectorisation de tes images).
3. Détourer chaque pièce en `<path>` jointif (partition), ids stables.
4. Adapter `edl-zones.ts` (EDL_VIEWS + `d` + LEGACY_ALIAS) — source unique.
5. Adapter `VehicleMap2D` (sélecteur de vue + `<path>`), garder zoom/formulaire/PDF.
6. Vérifier le rendu PDF contrat + un EDL départ→retour de bout en bout.
7. Bump SW, déployer, re-test device.
