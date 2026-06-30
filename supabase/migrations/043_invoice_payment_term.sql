-- Migration 043 — Durée de règlement des factures + lien vers les échéances
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- payment_term_days : nombre de jours accordés au client pour régler, modifiable
-- avant envoi (comme les lignes de la facture). due_date : figée au moment de
-- l'envoi (sendInvoice), pas recalculée après si le délai change pour d'autres
-- factures. invoice_id sur financial_due_dates : pour qu'une échéance créée
-- automatiquement à l'envoi d'une facture remonte jusqu'à elle (et qu'on évite
-- d'en créer une deuxième si sendInvoice était appelé une seconde fois).

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_term_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE financial_due_dates ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
