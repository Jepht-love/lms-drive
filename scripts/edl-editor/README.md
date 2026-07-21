# Éditeur de zones EDL (dev-only)

Outil de **recalage manuel des polygones** des zones du véhicule (état des lieux).
Sert à corriger les tracés de `components/vehicle-schema/edl-zones.ts` quand ils ne
collent pas au line-art. **Ne modifie aucun runtime** : il lit les données et
réexporte le fichier au format identique.

## Utilisation

```bash
npm run edl:editor        # génère edl-editor.local.html à la racine
npm run edl:editor:open   # génère puis l'ouvre dans le navigateur
```

Puis, dans le navigateur (fichier local, aucun serveur) :

1. **Colonne de gauche** — choisis une vue (Dessus / Face avant / Arrière / Profil G / Profil D), puis clique une zone. Les zones signalées imprécises ont un **point orange**.
2. **Recaler** la zone bleue sélectionnée :
   - glisser une **pastille bleue** = déplacer un point ;
   - clic sur une **pastille blanche d'arête** = insérer un point (puis le glisser) ;
   - sélectionner un point (devient rouge) + **Suppr** = le retirer ;
   - **molette** = zoom · **glisser le fond** = déplacer la vue · **Ctrl/⌘+Z** = annuler.
3. **Exporter edl-zones.ts** → **Télécharger** → remplace
   `components/vehicle-schema/edl-zones.ts` par le fichier obtenu.

Seules les coordonnées des zones modifiées changent ; ids, libellés, ordre,
commentaires et **cercles jantes/pneus** (lecture seule) restent identiques.

## Fichiers

- `template.html` — le gabarit de l'éditeur (HTML/CSS/JS natif, avec des jetons `__…__`).
- `generate.mjs` — injecte le line-art (data URI), les polygones actuels et le texte
  source dans le gabarit, produit `edl-editor.local.html`.

Le fichier généré `edl-editor.local.html` est **git-ignoré** (≈460 Ko, contient le
line-art encodé) : il se régénère à la demande et reflète toujours l'état courant de
`edl-zones.ts`.
