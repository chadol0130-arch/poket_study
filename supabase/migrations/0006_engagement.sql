-- =============================================================================
-- 인게이지먼트: 연속 출석(스트릭) + 데일리 미션 + 주간 랭킹.
-- 사용시간·재방문을 늘려 더 많은 데이터를 모으는 것이 목적. 하루 경계는 Asia/Seoul.
-- =============================================================================

-- 스트릭 상태(캐시) 컬럼
alter table public.profiles add column if not exists current_streak  int  not null default 0;
alter table public.profiles add column if not exists longest_streak  int  not null default 0;
alter table public.profiles add column if not exists last_checkin_date date;

-- 출석 기록 (하루 1행)
create table public.streak_checkins (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null,
  created_at  timestamptz not null default now(),
  unique (student_id, checkin_date)
);
create index idx_streak_checkins_student on public.streak_checkins(student_id);

-- 원장 source_type 에 checkin 추가
alter table public.xp_events drop constraint if exists xp_events_source_type_check;
alter table public.xp_events add constraint xp_events_source_type_check
  check (source_type in ('submission','bonus','battle','daily_log','question','checkin'));
alter table public.coin_events drop constraint if exists coin_events_source_type_check;
alter table public.coin_events add constraint coin_events_source_type_check
  check (source_type in ('submission','purchase','bonus','daily_log','question','checkin'));

-- 출석 체크인: 스트릭 갱신 + 보상(즉시). 학생 본인(auth.uid())이 호출.
create or replace function public.daily_checkin()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'Asia/Seoul')::date;
  v_prof   public.profiles;
  v_checkin_id uuid;
  v_streak int;
  v_xp     int := 10;
  v_coin   int;
  v_pet    public.student_pokemon;
  v_new_total int; v_new_level int; v_new_species uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_prof from public.profiles where id = v_uid;

  -- 이미 오늘 체크인했으면 멱등 종료
  if v_prof.last_checkin_date = v_today then
    return jsonb_build_object('already', true, 'streak', v_prof.current_streak);
  end if;

  -- 스트릭 계산
  if v_prof.last_checkin_date = v_today - 1 then
    v_streak := v_prof.current_streak + 1;
  else
    v_streak := 1;
  end if;
  v_coin := 5 + least(v_streak, 10);   -- 스트릭 보너스

  -- 출석 기록 (동시성 안전)
  begin
    insert into public.streak_checkins (student_id, checkin_date)
    values (v_uid, v_today)
    returning id into v_checkin_id;
  exception when unique_violation then
    return jsonb_build_object('already', true, 'streak', v_prof.current_streak);
  end;

  -- profiles 갱신 (코인은 아래에서 함께)
  update public.profiles
    set current_streak = v_streak,
        longest_streak = greatest(longest_streak, v_streak),
        last_checkin_date = v_today
    where id = v_uid;

  -- 코인 지급
  insert into public.coin_events (student_id, source_type, source_id, coin_delta)
  values (v_uid, 'checkin', v_checkin_id, v_coin);
  update public.profiles set coin_balance = coin_balance + v_coin where id = v_uid;

  -- 활성 포켓몬 경험치
  select * into v_pet from public.student_pokemon
    where student_id = v_uid and is_active limit 1;
  if v_pet.id is not null then
    insert into public.xp_events (student_pokemon_id, source_type, source_id, xp_delta)
    values (v_pet.id, 'checkin', v_checkin_id, v_xp);
    v_new_total := v_pet.xp + v_xp;
    v_new_level := public.level_for_xp(v_new_total);
    select species_id into v_new_species from public.evolution_stages
      where chain_id = v_pet.chain_id and min_level <= v_new_level
      order by stage_order desc limit 1;
    update public.student_pokemon
      set xp = v_new_total, level = v_new_level,
          current_species_id = coalesce(v_new_species, current_species_id), updated_at = now()
      where id = v_pet.id;
  end if;

  return jsonb_build_object('already', false, 'streak', v_streak, 'xp', v_xp, 'coin', v_coin);
end;
$$;

-- 주간 랭킹: 호출자의 같은 반 학생들을 이번 주(KST 월요일~) 획득 경험치로 정렬.
-- SECURITY DEFINER 로 집계값만 반환(원본 xp_events 노출 안 함).
create or replace function public.weekly_leaderboard()
returns table (student_id uuid, display_name text, weekly_xp bigint, level int, is_me boolean)
language sql security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  week as (
    select ((date_trunc('week', (now() at time zone 'Asia/Seoul')))
            at time zone 'Asia/Seoul') as start_ts
  ),
  classmates as (
    select distinct e2.student_id
    from public.enrollments e1
    join public.enrollments e2 on e2.class_id = e1.class_id and e2.status = 'active'
    where e1.student_id = (select uid from me) and e1.status = 'active'
  ),
  wxp as (
    select sp.student_id, coalesce(sum(xe.xp_delta), 0) as weekly_xp
    from classmates c
    join public.student_pokemon sp on sp.student_id = c.student_id
    left join public.xp_events xe
      on xe.student_pokemon_id = sp.id and xe.created_at >= (select start_ts from week)
    group by sp.student_id
  ),
  lvl as (
    select student_id, max(level) as level
    from public.student_pokemon group by student_id
  )
  select p.id, p.display_name,
         coalesce(wxp.weekly_xp, 0) as weekly_xp,
         coalesce(lvl.level, 1) as level,
         (p.id = (select uid from me)) as is_me
  from classmates c
  join public.profiles p on p.id = c.student_id
  left join wxp on wxp.student_id = c.student_id
  left join lvl on lvl.student_id = c.student_id
  order by weekly_xp desc, level desc, p.display_name asc;
$$;

-- RLS
alter table public.streak_checkins enable row level security;
create policy "checkins read" on public.streak_checkins for select
  using (student_id = auth.uid() or auth_role() = 'admin');
-- 쓰기는 daily_checkin RPC(SECURITY DEFINER)만.
