# Navigation (menu et bandeau)

Refonte du 08/08/2026 (remarque #19). La barre d'onglets du bas a été retirée ; la
navigation passe par un hamburger en haut à gauche qui ouvre un volet coulissant.

## Ce que fait la rubrique

- **Bandeau du haut** : hamburger à gauche, logo centré, date à droite.
- **Volet de navigation** : glisse depuis la gauche (moitié d'écran, fond noir), porte
  les six entrées Accueil, Véhicules, Réservations, Calendrier, Alertes (avec badge),
  Menu, chacune icône à gauche et texte à droite. Se ferme au clic sur une entrée, sur
  la croix, sur le voile, et au changement de page.
- Le « ? » d'assistance reste en bas à **gauche** (le coin est libre depuis le retrait
  de la barre du bas), au-dessus de la zone sécurisée.

## Fichiers

- `components/layout/MenuButton.tsx` : le hamburger + le volet + les six entrées et leur
  filtrage par permissions. Client (état d'ouverture, badge d'alertes, page active).
- `components/layout/PageHeader.tsx` : le bandeau, reçoit `allowedTabs` et le passe au
  volet.
- `app/(dashboard)/layout.tsx` : grille passée de trois rangées à deux (bandeau + contenu),
  `BottomNav` retiré.
- `components/sav/SavButton.tsx` : le « ? », recalé à `16px + zone sécurisée` (la réserve
  des 60px de l'ancienne barre a disparu).
- `components/calendar/CalendarBottomBar.tsx` : boutons flottants recalés (retrait du
  `60px +`).

## Filtrage par permissions

Identique à l'ancienne barre du bas : `allowedTabs` null ou vide = accès complet ; sinon
une entrée n'apparaît que si sa clé est autorisée (les entrées Alertes et Menu, sans clé,
sont toujours visibles). Source de vérité des onglets : `lib/navigation/tabs.ts`.

## Pièges

- `components/layout/BottomNav.tsx` n'est plus rendu (conservé au cas où). Si on le
  supprime un jour, vérifier qu'aucun favori ne dépend de son comportement.
- `app/globals.css` porte encore la règle `body[data-drawer-open] [data-bottom-nav]` : sans
  effet depuis le retrait de la barre, inoffensive. Le `data-drawer-open` reste utilisé par
  `components/Drawer.tsx` (fenêtre centrée) pour d'autres écrans.
- L'ancienne barre verticale `components/layout/Sidebar.tsx` (code mort) a été supprimée.

## Reste à faire (grappe refonte accueil)

Onglet « Départ » (#20), rubrique « En cours » + pop-up (#21/#22). Voir
`docs/PLAN-REMARQUES.md` (arbitrages du 08/08).
