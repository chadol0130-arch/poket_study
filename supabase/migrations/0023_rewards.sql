-- =============================================================================
-- 장기 동기 + 아이디어 루프:
--   1) 도전과제 보상 — 달성한 티어마다 코인 수령 (achievements 페이지의 6개 트랙)
--   2) 건의 채택 보상 — 관리자가 건의를 '채택'하면 학생에게 코인 100 + 알림
-- 둘 다 coin_events 'bonus' 원장 + UNIQUE 로 중복 지급 차단 (0021 패턴).
-- =============================================================================

-- 1) 도전과제 보상 수령 기록
create table public.achievement_claims (
  id         uuid not null unique default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  track      text not null,
  goal       int  not null,
  coin       int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (student_id, track, goal)
);

alter table public.achievement_claims enable row level security;
create policy "achievement claims read own" on public.achievement_claims for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');
-- 쓰기는 claim_achievement RPC(SECURITY DEFINER)만.

-- 달성 확인 + 코인 지급. 학생 본인이 호출. 티어 정의는 achievements 페이지와 1:1.
create or replace function public.claim_achievement(p_track text, p_goal int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_goals  int[];
  v_tier   int;   -- 몇 번째 티어인지 (1부터)
  v_metric int;
  v_coin   int;
  v_claim_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- 트랙별 티어 목록 (app/(student)/achievements/page.tsx 와 동일해야 함)
  v_goals := case p_track
    when 'streak'  then array[3,7,14,30]
    when 'passes'  then array[1,10,30,50,100]
    when 'collect' then array[1,3,5,10,20]
    when 'level'   then array[10,16,32,50]
    when 'wins'    then array[1,5,10,25]
    when 'answers' then array[1,10,30,60]
    else null end;
  if v_goals is null then raise exception 'unknown track'; end if;

  select i into v_tier from unnest(v_goals) with ordinality as t(g, i) where g = p_goal;
  if v_tier is null then raise exception 'unknown goal'; end if;

  -- 지표 계산 (페이지와 동일 기준)
  v_metric := case p_track
    when 'streak'  then (select coalesce(longest_streak, 0) from public.profiles where id = v_uid)
    when 'passes'  then (select count(*) from public.submissions
                          where student_id = v_uid and status = 'approved')
                   + (select count(*) from public.daily_logs
                          where student_id = v_uid and status = 'approved')
    when 'collect' then (select count(*) from public.student_pokemon where student_id = v_uid)
    when 'level'   then (select coalesce(max(level), 1) from public.student_pokemon
                          where student_id = v_uid)
    when 'wins'    then (select count(*) from public.battles
                          where student_id = v_uid and status = 'won')
    when 'answers' then (select count(*) from public.question_answers where student_id = v_uid)
    end;

  if v_metric < p_goal then
    return jsonb_build_object('error', '아직 달성하지 못했어요!');
  end if;

  v_coin := (array[15,30,50,80,120])[v_tier];

  -- 티어당 1회 멱등 (PK 충돌 = 이미 받음)
  begin
    insert into public.achievement_claims (student_id, track, goal, coin)
    values (v_uid, p_track, p_goal, v_coin)
    returning id into v_claim_id;
  exception when unique_violation then
    return jsonb_build_object('already', true);
  end;

  insert into public.coin_events (student_id, source_type, source_id, coin_delta)
  values (v_uid, 'bonus', v_claim_id, v_coin);
  update public.profiles set coin_balance = coin_balance + v_coin where id = v_uid;

  return jsonb_build_object('already', false, 'coin', v_coin);
end;
$$;
grant execute on function public.claim_achievement(text, int) to authenticated;

-- 2) 건의 채택 — 상태에 'accepted' 추가 + 채택 RPC
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check
  check (status in ('open','in_progress','resolved','wontfix','accepted'));

create or replace function public.accept_feedback(p_feedback_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fb   public.feedback;
  v_coin int := 100;
begin
  if auth_role() <> 'admin' then raise exception 'admin only'; end if;

  -- CAS: 아직 채택 안 된 건만 채택으로 전환 (동시 클릭에도 1회만)
  update public.feedback
    set status = 'accepted', updated_at = now()
    where id = p_feedback_id and status <> 'accepted'
    returning * into v_fb;
  if v_fb.id is null then
    return jsonb_build_object('already', true);
  end if;

  -- 원장 UNIQUE 가 최후의 이중지급 방지선: 채택→해제→재채택해도 코인은 1번만.
  begin
    insert into public.coin_events (student_id, source_type, source_id, coin_delta)
    values (v_fb.student_id, 'bonus', v_fb.id, v_coin);
  exception when unique_violation then
    return jsonb_build_object('already', true);   -- 상태는 accepted 로 남고 보상만 생략
  end;
  update public.profiles set coin_balance = coin_balance + v_coin where id = v_fb.student_id;

  insert into public.notifications (user_id, kind, title, body, href)
  values (v_fb.student_id, 'feedback', '아이디어 채택! 💡',
          '네 건의가 채택돼서 코인 100개를 받았어! 계속 좋은 생각 알려줘.', '/feedback');

  return jsonb_build_object('already', false, 'coin', v_coin);
end;
$$;
grant execute on function public.accept_feedback(uuid) to authenticated;
