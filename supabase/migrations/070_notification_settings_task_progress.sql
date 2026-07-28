-- 070 — Interrupteur dédié à l'avancement des tâches
--
-- Pourquoi : quand quelqu'un démarre ou termine une tâche du calendrier, la
-- notification partait sous le type « departure_alert » (Départ du jour). Deux
-- conséquences : un gérant qui coupait « Départ du jour » perdait aussi le suivi
-- des tâches, et l'intitulé affiché était « Départ confirmé » pour un lavage.
--
-- Décision de Jeff du 28/07/2026 : la diffusion à toute l'équipe est VOULUE,
-- elle évite que deux personnes se retrouvent sur la même tâche. Seuls le type
-- et le libellé changent.

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS task_progress_alert BOOLEAN DEFAULT true;

COMMENT ON COLUMN notification_settings.task_progress_alert IS
  'Recevoir les avancements de tâches de l''équipe (démarrée, terminée, reportée, annulée).';
