-- 072 — Interrupteur des rappels d'échéances
--
-- Pourquoi : le rappel d'échéances est le SEUL envoi de l'application qui ignore
-- les réglages personnels. Il envoyait directement aux abonnements des gérants et
-- associés, sans vérifier ni le type d'alerte ni la plage horaire de réception.
-- Personne ne pouvait donc les couper, alors que ce sont les plus nombreux :
-- 64 échéances de loyer véhicule en base au 28/07/2026.
--
-- Va de pair avec le passage à un résumé HEBDOMADAIRE (décision de Jeff du
-- 28/07/2026) : une notification le lundi matin au lieu d'un rappel par échéance
-- à J-7, J-5, J-3, J-1, le jour J, puis tous les deux jours pendant trois
-- semaines. Sur 66 échéances, ce calendrier produisait des dizaines de messages
-- par semaine.

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS due_date_alert BOOLEAN DEFAULT true;

COMMENT ON COLUMN notification_settings.due_date_alert IS
  'Recevoir le résumé hebdomadaire des échéances (loyers véhicules et créances client).';
