-- =============================================================================
-- 행동 추적: 학생 화면 이동(page_view)을 퍼스트파티로 기록하고 관리자가 집계 열람.
--   * 수집: 학생 레이아웃의 BehaviorTracker 가 본인 행만 insert (RLS with check)
--   * 열람: admin 전용 select + admin_behavior_analytics() 집계 RPC
--   * 외부 전송 없음(미성년 개인정보 보호 원칙 — DB 안에서만)
-- 보존(선택): 90일 지난 로그 정리를 자동화하려면 Extensions 에서 pg_cron 켠 뒤:
--   select cron.schedule('trim-app-events', '0 4 * * *',
--     $$ delete from public.app_events where created_at < now() - interval '90 days' $$);
-- =============================================================================

create table public.app_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  event      text not null default 'page_view',
  path       text not null,                 -- 동적 id 는 클라이언트에서 ':id' 로 정규화됨
  session_id uuid not null,                 -- 탭 세션(sessionStorage) — 이탈/세션 길이 계산용
  created_at timestamptz not null default now()
);
create index idx_app_events_time    on public.app_events(created_at desc);
create index idx_app_events_user    on public.app_events(user_id, created_at desc);
create index idx_app_events_session on public.app_events(session_id, created_at);

alter table public.app_events enable row level security;
-- 본인 행만 기록 가능(위조 불가), 열람은 admin 만. update/delete 정책 없음.
create policy "events insert own" on public.app_events for insert
  with check (user_id = (select auth.uid()));
create policy "events admin read" on public.app_events for select
  using ((select auth_role()) = 'admin');

-- 행동 집계 (SECURITY INVOKER — 서버의 service-role 로 호출, admin_analytics(0015) 패턴)
create or replace function public.admin_behavior_analytics(p_days int default 7)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, coalesce(p_days, 7)));
  v_summary jsonb; v_by_screen jsonb; v_exits jsonb; v_heatmap jsonb; v_dau jsonb;
  v_f1 int; v_f2 int; v_f3 int;
begin
  -- 요약: 세션 수 / 평균 세션 길이(초) / 세션당 화면 수 / 활성 학생
  select jsonb_build_object(
    'sessions', count(*),
    'avg_secs', coalesce(round(avg(dur)), 0),
    'avg_pages', coalesce(round(avg(pages)::numeric, 1), 0),
    'students', (select count(distinct user_id) from app_events where created_at >= v_from)
  )
  into v_summary
  from (
    select session_id,
           extract(epoch from max(created_at) - min(created_at)) as dur,
           count(*) as pages
    from app_events where created_at >= v_from
    group by session_id
  ) s;

  -- 화면별 조회 Top 12 (조회수 + 고유 학생)
  select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', views, 'users', users)
                            order by views desc), '[]'::jsonb)
  into v_by_screen
  from (
    select path, count(*) as views, count(distinct user_id) as users
    from app_events where created_at >= v_from
    group by path order by count(*) desc limit 12
  ) t;

  -- 이탈 화면: 각 세션의 마지막 화면 집계 (그 화면 총 조회 대비 %)
  select coalesce(jsonb_agg(jsonb_build_object(
           'path', path, 'exits', exits, 'views', views,
           'exit_pct', case when views > 0 then round(exits * 100.0 / views) else 0 end)
         order by exits desc), '[]'::jsonb)
  into v_exits
  from (
    select l.path, count(*) as exits,
      (select count(*) from app_events v where v.path = l.path and v.created_at >= v_from) as views
    from (
      select distinct on (session_id) session_id, path
      from app_events where created_at >= v_from
      order by session_id, created_at desc
    ) l
    group by l.path order by count(*) desc limit 8
  ) e;

  -- 퍼널(고유 학생): 앱 방문 → 숙제 화면 → 실제 제출(도메인 테이블 기준)
  select count(distinct user_id) into v_f1 from app_events where created_at >= v_from;
  select count(distinct user_id) into v_f2 from app_events
    where created_at >= v_from and (path like '/homework%' or path like '/assignments%');
  select count(distinct sid) into v_f3 from (
    select student_id as sid from submissions where submitted_at >= v_from
    union
    select student_id from daily_logs where submitted_at >= v_from
  ) x;

  -- 요일×시간 히트맵 (KST)
  select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hh, 'n', n)), '[]'::jsonb)
  into v_heatmap
  from (
    select extract(dow  from (created_at at time zone 'Asia/Seoul'))::int as dow,
           extract(hour from (created_at at time zone 'Asia/Seoul'))::int as hh,
           count(*) as n
    from app_events where created_at >= v_from
    group by 1, 2
  ) h;

  -- 일별 활성 학생(KST)
  select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]'::jsonb)
  into v_dau
  from (
    select ((created_at at time zone 'Asia/Seoul')::date)::text as d,
           count(distinct user_id) as n
    from app_events where created_at >= v_from
    group by 1
  ) dd;

  return jsonb_build_object(
    'summary', v_summary,
    'by_screen', v_by_screen,
    'exits', v_exits,
    'funnel', jsonb_build_array(
      jsonb_build_object('label', '앱 방문', 'n', v_f1),
      jsonb_build_object('label', '숙제 화면', 'n', v_f2),
      jsonb_build_object('label', '숙제 제출', 'n', v_f3)
    ),
    'heatmap', v_heatmap,
    'dau_trend', v_dau,
    'days', p_days
  );
end;
$$;
