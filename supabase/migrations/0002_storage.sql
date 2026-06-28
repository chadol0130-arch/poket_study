-- =============================================================================
-- 스토리지 버킷 + 정책
--   homework-photos : 비공개. 학생은 본인 폴더만, 교사는 담당 학생 사진 읽기.
--   pokemon-sprites : 공개 읽기. admin 만 업로드.
--
-- homework-photos 경로 규칙: {student_id}/{submission_id}/{filename}
--   → 첫 번째 폴더 = 학생 uid (storage.foldername(name))[1]
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('homework-photos', 'homework-photos', false),
  ('pokemon-sprites', 'pokemon-sprites', true)
on conflict (id) do nothing;

-- homework-photos -------------------------------------------------------------
create policy "hw student insert own folder" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'homework-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "hw student read own folder" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'homework-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "hw staff read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'homework-photos'
    and (
      public.auth_role() = 'admin'
      or public.teaches_student( ((storage.foldername(name))[1])::uuid )
    )
  );

create policy "hw student delete own folder" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'homework-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- pokemon-sprites -------------------------------------------------------------
create policy "sprites public read" on storage.objects for select
  using (bucket_id = 'pokemon-sprites');

create policy "sprites admin write" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pokemon-sprites' and public.auth_role() = 'admin');

create policy "sprites admin update" on storage.objects for update
  to authenticated
  using (bucket_id = 'pokemon-sprites' and public.auth_role() = 'admin');

create policy "sprites admin delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'pokemon-sprites' and public.auth_role() = 'admin');
