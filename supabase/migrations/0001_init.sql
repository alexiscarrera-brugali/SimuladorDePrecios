-- ============================================================
-- Brugali · Costos y precios — esquema inicial y seguridad (RLS)
-- Stack: Supabase (Postgres + Auth). Precisión NUMERIC(20,8).
-- Modelo de acceso: los clientes (navegador/JWT de usuario) solo LEEN
-- según RLS; toda ESCRITURA pasa por el backend con service-role
-- (que omite RLS) previa verificación de rol. service-role nunca va
-- al navegador.
-- ============================================================

-- ---- Perfiles y roles --------------------------------------

create type public.app_role as enum ('admin_importer', 'functional', 'tester');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       public.app_role not null default 'tester',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de aplicación por usuario de Supabase Auth.';

-- Rol del solicitante (para políticas RLS).
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

-- Alta automática de perfil al crear un usuario de Auth (rol mínimo).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Datos de negocio --------------------------------------

create table public.import_batches (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  sha256      text not null,
  status      text not null default 'committed',
  imported_by uuid references public.profiles (id),
  imported_at timestamptz not null default now(),
  summary     jsonb not null default '{}'::jsonb
);
create index import_batches_status_idx on public.import_batches (status, imported_at desc);

create table public.raw_records (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.import_batches (id) on delete cascade,
  sheet_name text not null,
  source_row integer not null,
  payload    jsonb not null
);
create index raw_records_batch_idx on public.raw_records (batch_id);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  description text
);

create table public.price_lists (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  description text not null
);

create table public.price_facts (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.import_batches (id) on delete cascade,
  branch_code     text not null,
  price_list_code text not null,
  product_code    text not null,
  valid_from      date not null,
  value           numeric(20, 8),
  source_status   text not null default 'unknown',
  source_row      integer not null
);
create index price_facts_lookup_idx
  on public.price_facts (batch_id, price_list_code, product_code, valid_from);

create table public.cost_facts (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.import_batches (id) on delete cascade,
  branch_code   text not null,
  product_code  text not null,
  description   text,
  valid_from    date not null,
  value         numeric(20, 8),
  source_status text not null default 'unknown',
  source_row    integer not null
);
create index cost_facts_lookup_idx
  on public.cost_facts (batch_id, product_code, valid_from);

create table public.theoretical_margins (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.import_batches (id) on delete cascade,
  price_list_name text not null,
  product_code    text not null,
  percentage      numeric(20, 8),
  is_ambiguous    boolean not null default false,
  source_row      integer not null
);
create index theoretical_margins_lookup_idx
  on public.theoretical_margins (batch_id, price_list_name, product_code);

create table public.quality_issues (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.import_batches (id) on delete cascade,
  issue_type   text not null,
  severity     text not null,
  sheet_name   text not null,
  business_key text not null,
  explanation  text not null,
  source_rows  jsonb not null default '[]'::jsonb,
  values       jsonb not null default '[]'::jsonb
);
create index quality_issues_batch_idx on public.quality_issues (batch_id, severity);

create table public.simulation_events (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null references public.profiles (id),
  product_code    text not null,
  price_list_code text not null,
  query_date      date not null,
  input_payload   jsonb not null,
  result_payload  jsonb not null,
  created_at      timestamptz not null default now()
);
create index simulation_events_actor_idx on public.simulation_events (actor_id, created_at desc);

create table public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id),
  action      text not null,
  entity_type text not null,
  entity_id   text,
  occurred_at timestamptz not null default now(),
  details     jsonb not null default '{}'::jsonb
);
create index audit_events_action_idx on public.audit_events (action, occurred_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.import_batches      enable row level security;
alter table public.raw_records         enable row level security;
alter table public.products            enable row level security;
alter table public.price_lists         enable row level security;
alter table public.price_facts         enable row level security;
alter table public.cost_facts          enable row level security;
alter table public.theoretical_margins enable row level security;
alter table public.quality_issues      enable row level security;
alter table public.simulation_events   enable row level security;
alter table public.audit_events        enable row level security;

-- Perfiles: cada quien ve el suyo; admin ve todos. Sin escritura de cliente.
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin_importer');

-- Tablas de referencia y datos: lectura para usuarios activos autenticados.
-- (La escritura ocurre solo con service-role desde el backend.)
create policy read_active_products on public.products
  for select using (public.is_active_user());
create policy read_active_price_lists on public.price_lists
  for select using (public.is_active_user());
create policy read_active_price_facts on public.price_facts
  for select using (public.is_active_user());
create policy read_active_cost_facts on public.cost_facts
  for select using (public.is_active_user());
create policy read_active_margins on public.theoretical_margins
  for select using (public.is_active_user());
create policy read_active_batches on public.import_batches
  for select using (public.is_active_user());
create policy read_active_raw on public.raw_records
  for select using (public.is_active_user());
create policy read_active_issues on public.quality_issues
  for select using (public.is_active_user());

-- Simulaciones: el actor ve las suyas; admin ve todas.
create policy read_own_simulations on public.simulation_events
  for select using (actor_id = auth.uid() or public.current_role() = 'admin_importer');

-- Auditoría: solo administradores consultan.
create policy read_audit_admin on public.audit_events
  for select using (public.current_role() = 'admin_importer');

-- Nota: no se definen políticas de INSERT/UPDATE/DELETE para clientes.
-- Con RLS activo y sin política permisiva, toda escritura vía JWT de
-- usuario queda denegada; el backend escribe con service-role.
