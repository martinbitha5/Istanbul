-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 08. Realtime et Storage
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- REALTIME
--
-- On ne publie que les tables réellement écoutées. Publier tout le schéma
-- ferait transiter le catalogue entier à chaque modification de prix.
-- ===========================================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_status_history;
alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.notifications;

-- REPLICA IDENTITY FULL : sans cela, les payloads UPDATE ne contiennent que
-- la clé primaire et le filtre `restaurant_id=eq.X` ne matcherait jamais.
alter table public.orders               replica identity full;
alter table public.deliveries           replica identity full;
alter table public.order_status_history replica identity full;

-- ===========================================================================
-- STORAGE
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images',  'product-images',  true,  5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars',         'avatars',         true,  2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('delivery-proofs', 'delivery-proofs', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- --- product-images : lecture publique, écriture staff ---------------------
create policy "product_images_read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product_images_write" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.fn_is_staff());

create policy "product_images_update" on storage.objects
  for update using (bucket_id = 'product-images' and public.fn_is_staff());

create policy "product_images_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.fn_is_staff());

-- --- avatars : lecture publique, écriture par le propriétaire --------------
-- Convention de chemin : avatars/<profile_id>/<fichier>
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_write_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- delivery-proofs : privé ----------------------------------------------
-- Convention de chemin : delivery-proofs/<order_id>/<fichier>
create policy "delivery_proofs_write_driver" on storage.objects
  for insert with check (
    bucket_id = 'delivery-proofs'
    and public.fn_current_driver_id() is not null
  );

create policy "delivery_proofs_read" on storage.objects
  for select using (
    bucket_id = 'delivery-proofs'
    and (
      public.fn_is_staff()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and (
            o.customer_id = auth.uid()
            or exists (
              select 1 from public.deliveries d
              where d.order_id = o.id and d.driver_id = public.fn_current_driver_id()
            )
          )
      )
    )
  );

-- ===========================================================================
-- Purge planifiée des positions GPS (7 jours de rétention)
-- Nécessite l'extension pg_cron, activable depuis le dashboard Supabase.
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'purge-driver-locations',
      '0 3 * * *',
      $cron$ select public.fn_purge_driver_locations(); $cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron non disponible, purge des positions à planifier manuellement.';
end;
$$;
