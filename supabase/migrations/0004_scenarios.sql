-- Escenarios de what-if de cartera: una regla de repricing aplicada a un
-- conjunto de productos, con su resultado por producto y el agregado. Permite
-- auditar quién simuló qué, cuándo y contra qué datos, y comparar contra el
-- original. La escritura es exclusiva del backend (service-role).

create table public.scenarios (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null references public.profiles (id),
  price_list_code text not null,
  query_date      date not null,
  rule_kind       text not null,
  rule_value      numeric,
  note            text,
  aggregate       jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint scenarios_rule_kind_check
    check (rule_kind in ('to_target', 'price_delta_pct', 'cost_shock_pct'))
);
create index scenarios_actor_idx on public.scenarios (actor_id, created_at desc);

create table public.scenario_items (
  id             uuid primary key default gen_random_uuid(),
  scenario_id    uuid not null references public.scenarios (id) on delete cascade,
  product_code   text not null,
  branch_code    text not null,
  before_payload jsonb not null,
  after_payload  jsonb not null
);
create index scenario_items_scenario_idx on public.scenario_items (scenario_id);

alter table public.scenarios enable row level security;
alter table public.scenario_items enable row level security;

-- Lectura: el actor ve los suyos; admin ve todos.
create policy read_own_scenarios on public.scenarios
  for select using (actor_id = auth.uid() or public.current_role() = 'admin_importer');

create policy read_scenario_items on public.scenario_items
  for select using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_id
        and (s.actor_id = auth.uid() or public.current_role() = 'admin_importer')
    )
  );

-- Sin políticas de INSERT/UPDATE/DELETE para clientes: con RLS activo toda
-- escritura vía JWT de usuario queda denegada; el backend escribe con service-role.
