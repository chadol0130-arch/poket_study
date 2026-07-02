-- =============================================================================
-- 스케일: 1만 명 대비 핵심 성능팩
--   A. 누락 인덱스 (랭킹/대시보드/검사현황 풀스캔 방지)
--   B. RLS initplan 최적화 — auth.uid()/auth_role() 를 (select ...) 로 래핑해
--      행마다 재평가되던 것을 쿼리당 1회로 (의미 동일, Supabase 공식 권고 패턴).
--      행 의존 헬퍼(teaches_class(col) 등)는 래핑 불가라 그대로 둔다.
--   C. 관리자 집계 RPC — 분석/질문 통계를 행 전체 로드 대신 SQL 집계로.
--   D. 보안 수정: guard_profile_columns 가 SECURITY DEFINER 라 current_user 가
--      함수 소유자(postgres)로 바뀌어 'authenticated' 검사가 항상 거짓 → 가드 무력화.
--      INVOKER 로 바꿔 원래 의도(학생의 role/coin 셀프 수정 차단)대로 동작시킨다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. 인덱스
-- -----------------------------------------------------------------------------
create index if not exists idx_xp_events_pokemon_time   on public.xp_events(student_pokemon_id, created_at);
create index if not exists idx_submissions_student      on public.submissions(student_id, submitted_at desc);
create index if not exists idx_question_answers_student on public.question_answers(student_id, answered_at);
create index if not exists idx_enrollments_student      on public.enrollments(student_id, status);
create index if not exists idx_coin_events_student      on public.coin_events(student_id, created_at);
create index if not exists idx_assignments_class        on public.homework_assignments(class_id, due_at);

-- -----------------------------------------------------------------------------
-- B. RLS initplan 재작성 — 원본(0001/0004/0005/0006/0012/0014)과 조건 의미 동일,
--    래핑만 추가. drop 후 재생성.
-- -----------------------------------------------------------------------------

-- profiles (0001) ---------------------------------------------------------------
drop policy if exists "profiles self/staff read" on public.profiles;
create policy "profiles self/staff read" on public.profiles for select
  using (id = (select auth.uid()) or (select auth_role()) in ('admin','teacher'));
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles for all
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- enrollments (0001) ------------------------------------------------------------
drop policy if exists "enrollments read" on public.enrollments;
create policy "enrollments read" on public.enrollments for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin' or teaches_class(class_id));
drop policy if exists "enrollments staff write" on public.enrollments;
create policy "enrollments staff write" on public.enrollments for all
  using ((select auth_role()) = 'admin' or teaches_class(class_id))
  with check ((select auth_role()) = 'admin' or teaches_class(class_id));

-- student_pokemon (0001) --------------------------------------------------------
drop policy if exists "pet read" on public.student_pokemon;
create policy "pet read" on public.student_pokemon for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin' or teaches_student(student_id));
drop policy if exists "pet admin write" on public.student_pokemon;
create policy "pet admin write" on public.student_pokemon for all
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- submissions (0001) ------------------------------------------------------------
drop policy if exists "submissions read" on public.submissions;
create policy "submissions read" on public.submissions for select
  using (
    student_id = (select auth.uid())
    or (select auth_role()) = 'admin'
    or exists (select 1 from public.homework_assignments a
               where a.id = assignment_id and teaches_class(a.class_id))
  );
drop policy if exists "submissions student insert" on public.submissions;
create policy "submissions student insert" on public.submissions for insert
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.homework_assignments a
      join public.enrollments e on e.class_id = a.class_id
      where a.id = assignment_id and e.student_id = (select auth.uid()) and e.status = 'active'
    )
  );
drop policy if exists "submissions student update pending" on public.submissions;
create policy "submissions student update pending" on public.submissions for update
  using (student_id = (select auth.uid()) and status = 'pending')
  with check (student_id = (select auth.uid()));
drop policy if exists "submissions staff review" on public.submissions;
create policy "submissions staff review" on public.submissions for update
  using (
    (select auth_role()) = 'admin'
    or exists (select 1 from public.homework_assignments a
               where a.id = assignment_id and teaches_class(a.class_id))
  );

-- xp_events / coin_events (0001) ------------------------------------------------
drop policy if exists "xp_events read" on public.xp_events;
create policy "xp_events read" on public.xp_events for select
  using (
    (select auth_role()) = 'admin'
    or exists (select 1 from public.student_pokemon sp
               where sp.id = student_pokemon_id and sp.student_id = (select auth.uid()))
  );
drop policy if exists "coin_events read" on public.coin_events;
create policy "coin_events read" on public.coin_events for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');

-- daily_logs (0004) ---------------------------------------------------------------
drop policy if exists "daily read" on public.daily_logs;
create policy "daily read" on public.daily_logs for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin' or teaches_student(student_id));
drop policy if exists "daily student insert" on public.daily_logs;
create policy "daily student insert" on public.daily_logs for insert
  with check (student_id = (select auth.uid()));
drop policy if exists "daily student update" on public.daily_logs;
create policy "daily student update" on public.daily_logs for update
  using (student_id = (select auth.uid()) and status in ('pending', 'rejected'))
  with check (student_id = (select auth.uid()));
drop policy if exists "daily staff review" on public.daily_logs;
create policy "daily staff review" on public.daily_logs for update
  using ((select auth_role()) = 'admin' or teaches_student(student_id));

-- questions / targets / answers (0005) --------------------------------------------
drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions for select
  using (
    (select auth_role()) = 'admin'
    or exists (select 1 from public.question_targets t
               where t.question_id = id and t.student_id = (select auth.uid()))
  );
drop policy if exists "questions admin write" on public.questions;
create policy "questions admin write" on public.questions for all
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');
drop policy if exists "targets read" on public.question_targets;
create policy "targets read" on public.question_targets for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');
drop policy if exists "targets admin write" on public.question_targets;
create policy "targets admin write" on public.question_targets for all
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');
drop policy if exists "answers read" on public.question_answers;
create policy "answers read" on public.question_answers for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');

-- streak_checkins (0006) -----------------------------------------------------------
drop policy if exists "checkins read" on public.streak_checkins;
create policy "checkins read" on public.streak_checkins for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');

-- notifications (0012) --------------------------------------------------------------
drop policy if exists "notif read own" on public.notifications;
create policy "notif read own" on public.notifications for select
  using (user_id = (select auth.uid()));
drop policy if exists "notif update own" on public.notifications;
create policy "notif update own" on public.notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- feedback (0014) --------------------------------------------------------------------
drop policy if exists "feedback admin read" on public.feedback;
create policy "feedback admin read" on public.feedback for select
  using ((select auth_role()) = 'admin');
drop policy if exists "feedback admin manage" on public.feedback;
create policy "feedback admin manage" on public.feedback for update
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- -----------------------------------------------------------------------------
-- C. 관리자 집계 RPC — 행 전체를 앱으로 끌어오지 않고 DB 에서 집계.
--    SECURITY INVOKER: service-role(서버 페이지)로 호출하면 전체 집계,
--    일반 사용자가 호출해도 RLS 범위 밖 데이터는 새지 않는다.
-- -----------------------------------------------------------------------------

create or replace function public.admin_analytics()
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_today       date := (now() at time zone 'Asia/Seoul')::date;
  v_day7        date := v_today - 6;                                     -- 오늘 포함 7일
  v_start7      timestamptz := (v_day7::timestamp at time zone 'Asia/Seoul');
  v_start_today timestamptz := (v_today::timestamp at time zone 'Asia/Seoul');
  v_students int; v_teachers int; v_classes int;
  v_dau int; v_wau int;
  v_sub_a int; v_sub_r int; v_sub_p int; v_log_a int; v_log_r int;
  v_qt bigint; v_qa bigint;
  v_avg_streak numeric; v_max_streak int;
  v_top jsonb; v_by_day jsonb;
begin
  select count(*) into v_students from profiles where role = 'student';
  select count(*) into v_teachers from profiles where role = 'teacher';
  select count(*) into v_classes  from classes;

  -- 활성 사용자: 제출/일일기록/질문답변/출석 중 하나라도 한 학생
  select count(distinct sid) into v_wau from (
    select student_id as sid from submissions      where submitted_at >= v_start7
    union all
    select student_id        from daily_logs       where log_date     >= v_day7
    union all
    select student_id        from question_answers where answered_at  >= v_start7
    union all
    select student_id        from streak_checkins  where checkin_date >= v_day7
  ) w;
  select count(distinct sid) into v_dau from (
    select student_id as sid from submissions      where submitted_at >= v_start_today
    union all
    select student_id        from daily_logs       where log_date     >= v_today
    union all
    select student_id        from question_answers where answered_at  >= v_start_today
    union all
    select student_id        from streak_checkins  where checkin_date >= v_today
  ) d;

  select count(*) filter (where status = 'approved'),
         count(*) filter (where status = 'rejected'),
         count(*) filter (where status = 'pending')
    into v_sub_a, v_sub_r, v_sub_p from submissions;
  select count(*) filter (where status = 'approved'),
         count(*) filter (where status = 'rejected')
    into v_log_a, v_log_r from daily_logs;

  select count(*) into v_qt from question_targets;
  select count(*) into v_qa from question_answers;

  select coalesce(round(avg(current_streak)::numeric, 1), 0), coalesce(max(current_streak), 0)
    into v_avg_streak, v_max_streak from profiles where role = 'student';

  select coalesce(jsonb_agg(jsonb_build_object('species_id', species_id, 'n', n) order by n desc), '[]'::jsonb)
    into v_top
  from (
    select current_species_id as species_id, count(*) as n
    from student_pokemon group by current_species_id
    order by n desc limit 5
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object('d', d::text, 'n', n) order by d), '[]'::jsonb)
    into v_by_day
  from (
    select gs::date as d,
      (select count(*) from submissions su
        where su.submitted_at >= v_start7
          and (su.submitted_at at time zone 'Asia/Seoul')::date = gs::date)
      + (select count(*) from daily_logs dl where dl.log_date = gs::date) as n
    from generate_series(v_day7::timestamp, v_today::timestamp, interval '1 day') gs
  ) x;

  return jsonb_build_object(
    'students', v_students, 'teachers', v_teachers, 'classes', v_classes,
    'dau', v_dau, 'wau', v_wau,
    'sub_approved', v_sub_a, 'sub_rejected', v_sub_r, 'sub_pending', v_sub_p,
    'log_approved', v_log_a, 'log_rejected', v_log_r,
    'q_targets', v_qt, 'q_answers', v_qa,
    'avg_streak', v_avg_streak, 'max_streak', v_max_streak,
    'top_species', v_top, 'by_day', v_by_day
  );
end;
$$;

-- 질문 목록의 발송/응답 수 — 질문×학생 행 전체 로드 대신 집계로.
create or replace function public.admin_question_stats()
returns table (question_id uuid, target_count bigint, answer_count bigint)
language sql stable set search_path = public as $$
  select q.id,
         (select count(*) from public.question_targets t where t.question_id = q.id),
         (select count(*) from public.question_answers a where a.question_id = q.id)
  from public.questions q;
$$;

-- -----------------------------------------------------------------------------
-- D. 보안 수정: profiles 셀프 role/coin 변경 가드 복구 (0011 재정의, INVOKER)
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and coalesce(auth_role(), '') <> 'admin' then
    new.role := old.role;
    new.coin_balance := old.coin_balance;
  end if;
  return new;
end;
$$;
