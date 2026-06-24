-- Migration 037 — Heure de l'infraction
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- infraction_date (DATE) ne suffit pas à déterminer avec certitude le
-- conducteur responsable quand un véhicule change de main plusieurs fois le
-- même jour (ex. retour le matin, repart l'après-midi avec un autre client).
-- Colonne nullable et ajoutée à part (pas de fusion en TIMESTAMPTZ) pour ne
-- pas toucher aux lignes existantes ni au format de infraction_date déjà en
-- usage partout (findDriverAtDate, affichage, tri).

ALTER TABLE infractions ADD COLUMN IF NOT EXISTS infraction_time TIME;
