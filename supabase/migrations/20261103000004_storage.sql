-- THE SEVEN CLUB · arquivos
-- media: imagens visíveis às integrantes (avatares, posts, empresas, projetos, eventos)
-- private: fotos de check-in, legíveis só pela dona via URL assinada
-- Cada integrante grava só na própria pasta: <uid>/<arquivo>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 8388608, array['image/webp', 'image/jpeg', 'image/png']),
  ('private', 'private', false, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_member());

create policy media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy private_own on storage.objects for all to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'private' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);
