-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 058 : réglages de notifications étendus
-- À exécuter dans le SQL Editor Supabase.
-- Ajoute un interrupteur par type de notification push, réglable par
-- utilisateur. Les 5 colonnes historiques (departure_alert, return_alert,
-- late_return_alert, new_reservation_alert, new_task_alert) existent déjà
-- (migration 048) — on complète le catalogue.
-- ═══════════════════════════════════════════════════════

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS contract_alert     BOOLEAN DEFAULT true,  -- Contrat à signer / clôturer
  ADD COLUMN IF NOT EXISTS pickup_late_alert  BOOLEAN DEFAULT true,  -- Récupération en retard (client pas venu)
  ADD COLUMN IF NOT EXISTS wash_alert         BOOLEAN DEFAULT true,  -- Lavage avant location
  ADD COLUMN IF NOT EXISTS ct_alert           BOOLEAN DEFAULT true,  -- Contrôle technique à échéance
  ADD COLUMN IF NOT EXISTS insurance_alert    BOOLEAN DEFAULT true,  -- Assurance à échéance
  ADD COLUMN IF NOT EXISTS service_alert      BOOLEAN DEFAULT true,  -- Révision / entretien
  ADD COLUMN IF NOT EXISTS sinistre_alert     BOOLEAN DEFAULT true,  -- Nouveau sinistre
  ADD COLUMN IF NOT EXISTS infraction_alert   BOOLEAN DEFAULT true,  -- Infraction non réglée
  ADD COLUMN IF NOT EXISTS document_alert     BOOLEAN DEFAULT true,  -- Document expiré
  ADD COLUMN IF NOT EXISTS task_late_alert    BOOLEAN DEFAULT true;  -- Tâche / RDV en retard
