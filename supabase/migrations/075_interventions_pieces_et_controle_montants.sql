-- 075 — Le détail d'une intervention, et le contrôle de ses montants
--
-- À quoi sert cette migration : lot 2 du chantier « suivi complet d'une
-- intervention » (docs/PLAN-A2-INTERVENTIONS.md). Trois choses jusque-là
-- impossibles :
--   1. dire CE QUI a été remplacé, pièce par pièce, avec son prix ;
--   2. séparer le prix des pièces de celui de la main d'œuvre ;
--   3. empêcher qu'un montant déjà saisi soit corrigé en silence.
--
-- Elle est purement additive : aucune colonne supprimée, aucune donnée réécrite.
--
-- Le contrôle des montants, voulu par Jeff contre les faux justificatifs :
-- au-delà d'un écart de 20 % ou de 20 € (le plus PETIT des deux, donc le
-- déclenchement le plus tôt), corriger un montant ouvre une demande. Rien ne
-- bouge tant qu'un AUTRE gérant ou associé n'a pas répondu, et personne ne
-- valide sa propre demande. L'interrupteur d'agence est éteint par défaut :
-- chez un client où personne d'autre ne peut valider, la correction passe seule
-- et reste tracée.

-- ── Les pièces remplacées ────────────────────────────────────────────────────
-- Une ligne par pièce, et non un texte libre : c'est ce qui permettra plus tard
-- de comparer deux garages sur la même pièce (choix de Jeff, 02/08/2026).
CREATE TABLE IF NOT EXISTS maintenance_parts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  label          text NOT NULL,
  quantity       numeric NOT NULL DEFAULT 1,
  unit_price     numeric NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_parts_record ON maintenance_parts(maintenance_id);

ALTER TABLE maintenance_records
  -- Le prix de la main d'œuvre, à côté du prix des pièces. Leur somme explique
  -- le montant total ; elle ne le remplace pas, parce qu'une réparation de
  -- plusieurs dégâts tient son total du règlement, dégât par dégât.
  ADD COLUMN IF NOT EXISTS labor_cost numeric;

-- ── Les demandes de correction de montant ────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_amount_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  requested_by   uuid NOT NULL REFERENCES profiles(id),
  old_amount     numeric NOT NULL,
  new_amount     numeric NOT NULL,
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'en_attente',
  reviewed_by    uuid REFERENCES profiles(id),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz DEFAULT NOW()
);

ALTER TABLE maintenance_amount_requests
  DROP CONSTRAINT IF EXISTS maintenance_amount_requests_status_check;
ALTER TABLE maintenance_amount_requests
  ADD CONSTRAINT maintenance_amount_requests_status_check
  CHECK (status IN ('en_attente', 'validee', 'refusee'));

CREATE INDEX IF NOT EXISTS idx_amount_requests_record ON maintenance_amount_requests(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_amount_requests_status ON maintenance_amount_requests(status);

-- ── L'interrupteur d'agence ──────────────────────────────────────────────────
-- Éteint par défaut : allumer le contrôle est une décision du client, pas un
-- comportement imposé.
ALTER TABLE agency_settings
  ADD COLUMN IF NOT EXISTS require_amount_validation boolean NOT NULL DEFAULT false;

-- ── Règles d'accès ───────────────────────────────────────────────────────────
-- Mêmes règles que les interventions elles-mêmes : tout utilisateur authentifié
-- lit et écrit, le filtrage fin se fait dans les Server Actions (qui vérifient
-- le rôle avant de valider une demande). Sans ces règles, les deux tables
-- seraient invisibles depuis l'application.
ALTER TABLE maintenance_parts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_amount_requests  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maintenance_parts_all ON maintenance_parts;
CREATE POLICY maintenance_parts_all ON maintenance_parts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS maintenance_amount_requests_all ON maintenance_amount_requests;
CREATE POLICY maintenance_amount_requests_all ON maintenance_amount_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
