-- The previous upload UI accepted GIF. Keep owner read/removal access so
-- existing GIF avatars can be removed; new uploads remain limited to JPG/PNG/WebP.
alter policy "Owners read avatar files" on storage.objects
  using (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp|gif)$'));
alter policy "Owners remove avatar files" on storage.objects
  using (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp|gif)$'));
