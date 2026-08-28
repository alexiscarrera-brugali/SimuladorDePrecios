-- Correcciones manuales de costo y margen objetivo.
-- Registran el valor original importado y el valor corregido por un usuario,
-- para poder auditar quién ajustó cada dato y volver atrás si hace falta.

create table public.manual_corrections (
  id              uuid primary key default gen_random_uuid(),
  product_code    text not null,
  price_list_code text not null,
  field           text not null,
  original_value  text,
  corrected_value text,
  corrected_by    uuid not null references public.profiles (id),
  corrected_at    timestamptz not null default now(),
  constraint manual_corrections_field_check
    check (field in ('cost', 'ideal_percent')),
  constraint manual_corrections_unique
    unique (product_code, price_list_code, field)
);

create index manual_corrections_product_idx
  on public.manual_corrections (product_code, price_list_code);

create index manual_corrections_actor_idx
  on public.manual_corrections (corrected_by, corrected_at desc);

alter table public.manual_corrections enable row level security;

-- Lectura para usuarios activos autenticados.
-- Sin políticas de INSERT/UPDATE/DELETE: con RLS activo toda escritura vía JWT
-- de usuario queda denegada y el backend escribe con service-role.
create policy read_active_corrections on public.manual_corrections
  for select using (public.is_active_user());
