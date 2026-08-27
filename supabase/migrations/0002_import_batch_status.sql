alter table public.import_batches
  alter column status set default 'processing';

alter table public.import_batches
  drop constraint if exists import_batches_status_check;

alter table public.import_batches
  add constraint import_batches_status_check
  check (status in ('processing', 'committed', 'failed'));
