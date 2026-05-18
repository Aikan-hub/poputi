-- Ride status & driver_id migration (idempotent)
-- Run in Supabase SQL editor.

-- 1) Add driver_id (vk_id of driver) and ensure status column exists with new default.
alter table public.rides add column if not exists driver_id text;

do $$
begin
  -- ensure status column exists
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rides' and column_name = 'status'
  ) then
    alter table public.rides add column status text;
  end if;
end;
$$;

-- 2) Normalize status values to the new set.
update public.rides set status = 'searching' where status is null or trim(status) = '' or status = 'open';
update public.rides set status = 'accepted' where status = 'in_progress';
-- keep existing when already in target set
update public.rides set status = 'completed' where status = 'completed';
update public.rides set status = 'cancelled' where status = 'cancelled';

-- 3) Apply defaults and comments.
alter table public.rides alter column status set default 'searching';
comment on column public.rides.status is 'searching | accepted | in_transit | completed | cancelled';
comment on column public.rides.driver_id is 'vk_id (id123…) водителя';

-- Optional: if you want a simple constraint, uncomment next line
-- alter table public.rides add constraint rides_status_check check (status in ('searching','accepted','in_transit','completed','cancelled'));
