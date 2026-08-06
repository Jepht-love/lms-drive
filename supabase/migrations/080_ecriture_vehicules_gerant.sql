-- 080 — L'écriture des véhicules revient au gérant (et au super-admin)
--
-- À quoi sert cette migration : deux choses d'un seul geste, décidées le
-- 06/08/2026.
--
--   1. RÉPARER un défaut de socle. La règle « vehicles_write_managers »
--      (migration 002) s'appuyait sur get_user_role(), qui ne lit QUE
--      profiles.role et IGNORE is_admin (migration 001). Le compte
--      super-administrateur (le concepteur) ne pouvait donc NI créer un
--      véhicule, NI attacher une voiture à une grille, NI corriger un prix
--      depuis l'écran des grilles — ces deux dernières actions écrivent dans
--      « vehicles », donc tombaient sur le même verrou. L'appli laissait
--      cliquer, la base refusait en silence.
--
--   2. RÉSERVER l'écriture des véhicules au GÉRANT, plus à l'associé. Décision
--      de Jeff : le contrôle des PRIX ne doit rester qu'entre les mains du
--      gérant (« laisse la main au gérant, pas aux autres »). Comme le prix est
--      porté par la fiche du véhicule, laisser l'associé écrire « vehicles » le
--      laissait modifier un prix par le formulaire. On retire donc l'associé de
--      l'écriture des véhicules en attendant le système fin d'attributions par
--      profil (« le reste, on verra plus tard »).
--
-- ⚠️ CONSÉQUENCE À CONNAÎTRE : un associé ne peut plus ajouter ni modifier un
-- véhicule (pas seulement son prix) tant que le contrôle fin par profil n'est
-- pas construit. La lecture reste ouverte à tous (règle « vehicles_read_all »),
-- seul l'écriture est concernée.
--
-- ⚠️ Le même schéma « *_write_managers » existe sur clients, reservations, etc.
-- Elles ne sont PAS touchées ici. Le helper is_admin_user() ci-dessous est
-- réutilisable pour les faire évoluer plus tard sans le réécrire.

-- Le compte connecté est-il super-administrateur ? SECURITY DEFINER pour lire
-- profiles sans être bloqué par ses propres règles d'accès, exactement comme
-- get_user_role() (migration 001). STABLE : le résultat ne change pas dans une
-- même requête.
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- L'écriture des véhicules : le gérant, ou le super-administrateur. Plus
-- l'associé. USING (lignes visibles à modifier/supprimer) ET WITH CHECK (lignes
-- insérées ou modifiées) : les deux, pour couvrir l'INSERT autant que
-- l'UPDATE/DELETE.
DROP POLICY IF EXISTS "vehicles_write_managers" ON vehicles;
CREATE POLICY "vehicles_write_managers" ON vehicles FOR ALL
  USING (get_user_role() = 'gerant' OR is_admin_user())
  WITH CHECK (get_user_role() = 'gerant' OR is_admin_user());
