-- Origen de cada precio vigente: 'import' (viene de la planilla) o 'manual'
-- (establecido desde una simulación como lista vigente). Permite distinguir los
-- precios publicados a mano, badgearlos en la UI y revertirlos (restablecer).
-- Los precios manuales se guardan como una vigencia nueva con la fecha del día;
-- el resolvedor de vigencia los toma como el precio vigente y el anterior queda
-- en el histórico.

alter table public.price_facts
  add column if not exists origin text not null default 'import';

alter table public.price_facts
  drop constraint if exists price_facts_origin_check;

alter table public.price_facts
  add constraint price_facts_origin_check check (origin in ('import', 'manual'));

create index if not exists price_facts_origin_idx
  on public.price_facts (batch_id, price_list_code, product_code, origin);
