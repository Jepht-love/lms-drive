-- ─── Les frais de restitution, modifiables par le gérant ─────────────────────
--
-- Ce qui existait avant : les 27 postes du tableau des frais (rayure 500 €,
-- pare-brise 5 000 €, nettoyage 100 €…) étaient écrits en dur dans
-- lib/contracts/legal-articles.ts, en deux versions — sportif et citadine.
-- Impossible d'y toucher sans développeur, et impossible de livrer le logiciel
-- à un autre client sans réécrire son contrat.
--
-- ⚠️ CETTE MIGRATION NE CHARGE AUCUNE DONNÉE. La table naît vide, exprès :
-- les 27 postes restent le « contrat type » écrit dans le code, et tant qu'une
-- catégorie n'a rien ici, le contrat imprime exactement ce qu'il imprimait
-- avant. Aucun montant ne change le jour de la livraison. Le gérant remplit sa
-- liste quand il veut, par le bouton « Reprendre le contrat type » de l'écran
-- des grilles tarifaires.
--
-- Deux listes seulement : `sportif` et `standard` (tout le reste du parc).
-- C'est la découpe du contrat papier, choisie par Jeff le 03/08/2026.

create table if not exists public.restitution_fees (
  id           uuid primary key default gen_random_uuid(),

  -- La catégorie de véhicule à laquelle la ligne s'applique.
  scope        text not null check (scope in ('sportif', 'standard')),

  -- L'ordre d'impression au contrat. Deux lignes peuvent partager une position
  -- le temps d'un glisser-déposer : c'est `id` qui départage, pas une contrainte.
  position     integer not null default 0,

  label        text not null,

  -- Le montant. NULL quand le contrat renvoie à un devis : c'est ce NULL qui
  -- fait qu'une facture de restitution arrive avec une ligne vide, à compléter,
  -- plutôt qu'avec un zéro qui passerait inaperçu.
  amount       numeric(10, 2),

  -- Ce qui s'imprime après le montant : « par heure de retard », « ou sur devis
  -- si le montant est supérieur ». Seul, il remplace le montant (« Sur devis + 30 % »).
  note         text,

  -- La clé qui relie ce poste au constat de dommage de l'état des lieux
  -- (rayure_legere, vitrage_casse, pneu_anormal…). Renseignée uniquement sur les
  -- postes que components/vehicle-schema/inspection-types.ts sait reconnaître.
  -- Retirer un tel poste prive le dommage correspondant de son tarif automatique :
  -- l'écran prévient avant.
  damage_key   text,

  -- `franchise` ou `retard` : le poste est PILOTÉ PAR LA GRILLE TARIFAIRE du
  -- véhicule et ne se saisit pas ici. Sans cette marque, le gérant écrirait
  -- 15 000 € de franchise pendant que la grille de la Smart Fortwo dit 6 000 €,
  -- et le contrat imprimerait deux chiffres contradictoires.
  source       text check (source in ('franchise', 'retard')),

  -- La corbeille. Un poste retiré n'est jamais effacé : il descend dans le bloc
  -- « Postes retirés » de l'écran et remonte d'un clic.
  deleted_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists restitution_fees_scope_idx
  on public.restitution_fees (scope, position)
  where deleted_at is null;

alter table public.restitution_fees enable row level security;

-- Lecture pour tout utilisateur connecté : le contrat, son aperçu et l'état des
-- lieux en ont besoin, et ils tournent avec le compte de l'agent sur le terrain.
drop policy if exists "restitution_fees_select" on public.restitution_fees;
create policy "restitution_fees_select" on public.restitution_fees
  for select to authenticated using (true);

-- Écriture réservée au gérant et à l'administrateur, comme les grilles tarifaires.
drop policy if exists "restitution_fees_write" on public.restitution_fees;
create policy "restitution_fees_write" on public.restitution_fees
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.is_admin or p.role = 'gerant')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.is_admin or p.role = 'gerant')
    )
  );
