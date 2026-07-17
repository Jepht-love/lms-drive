-- Corbeille des échéances financières : suppression LOGIQUE.
-- deleted_at IS NULL  → échéance active (listée, alertée)
-- deleted_at NOT NULL → échéance supprimée : masquée des listes et des alertes,
--                       mais conservée et RESTAURABLE depuis la corbeille.
--
-- Le code applique le filtre en mémoire (`!deleted_at`) pour rester tolérant si
-- cette migration n'est pas encore appliquée : rien ne casse, on retombe alors
-- sur une suppression classique.

alter table public.financial_due_dates
  add column if not exists deleted_at timestamptz;

create index if not exists financial_due_dates_deleted_at_idx
  on public.financial_due_dates (deleted_at);
