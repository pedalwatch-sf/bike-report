create policy "anyone can upload submission images"
  on storage.objects for insert
  with check (bucket_id = 'submission-images');

create policy "anyone can view submission images"
  on storage.objects for select
  using (bucket_id = 'submission-images');
