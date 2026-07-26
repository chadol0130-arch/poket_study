-- =============================================================================
-- 참여 독려 2탄: 일일 보상 루프.
--   1) 미션 3/3 보너스 상자 — 출석+제출+질문답변을 모두 하면 랜덤 코인(+가끔 아이템)
--   2) 스트릭 보호권(STREAKFREEZE) — 하루 놓쳐도 자동 사용되어 연속 출석 유지
--   3) 컴백 보상 — 3일 이상 쉬다 돌아온 학생에게 복귀 보너스 코인
-- coin_events 의 'bonus' source_type(0001 부터 예약만 되어 있던 것)을 처음 사용한다.
-- =============================================================================

-- 1) 아이템 종류에 'charm'(자동 사용 소지품) 추가 + 스트릭 보호권 시드
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('ball','potion','charm'));

insert into public.items (item_key, name_ko, description, kind, price, effect, display_order)
values ('STREAKFREEZE', '스트릭 보호권',
        '하루 출석을 놓쳐도 연속 출석이 끊기지 않게 지켜준다. 위험할 때 자동으로 사용된다.',
        'charm', 50, 1, 5)
on conflict (item_key) do nothing;

-- 2) 미션 보너스 수령 기록 (하루 1회 멱등의 기준)
create table public.mission_claims (
  id         uuid not null unique default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  claim_date date not null,
  coin       int  not null default 0,
  item_key   text references public.items(item_key),
  created_at timestamptz not null default now(),
  primary key (student_id, claim_date)
);

alter table public.mission_claims enable row level security;
create policy "mission claims read own" on public.mission_claims for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');
-- 쓰기는 claim_mission_bonus RPC(SECURITY DEFINER)만.

-- 3) 미션 3/3 보너스 상자 — 학생 본인이 호출
create or replace function public.claim_mission_bonus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_start timestamptz := (((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul');
  v_checkin  boolean;
  v_submit   boolean;
  v_question boolean;
  v_coin     int;
  v_item     text := null;
  v_item_name text := null;
  v_claim_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- 미션 검증 (KST 오늘 기준)
  v_checkin := exists (select 1 from public.streak_checkins
                       where student_id = v_uid and checkin_date = v_today);
  -- 대시보드 미션 표시와 같은 기준: 제출물은 오늘 제출, 일일기록은 오늘 날짜 기록
  v_submit  := exists (select 1 from public.submissions
                       where student_id = v_uid and submitted_at >= v_start)
            or exists (select 1 from public.daily_logs
                       where student_id = v_uid and log_date = v_today);
  -- 질문 미션: 오늘 답했거나, 답할 질문 자체가 없으면(질문이 안 온 날 손해 방지) 완료로 인정
  v_question := exists (select 1 from public.question_answers
                        where student_id = v_uid and answered_at >= v_start)
             or not exists (
                  select 1 from public.question_targets t
                  join public.questions q on q.id = t.question_id
                  where t.student_id = v_uid and q.is_active
                    and not exists (select 1 from public.question_answers a
                                    where a.question_id = q.id and a.student_id = v_uid));

  if not (v_checkin and v_submit and v_question) then
    return jsonb_build_object('error', '아직 미션을 다 못 끝냈어요!');
  end if;

  -- 보상 결정: 코인 10~30 + 25% 확률 아이템 1개
  v_coin := 10 + floor(random() * 21)::int;
  if random() < 0.25 then
    v_item := (array['POKEBALL','POTION'])[1 + floor(random() * 2)::int];
    select name_ko into v_item_name from public.items where item_key = v_item;
  end if;

  -- 하루 1회 멱등 (PK 충돌 = 이미 받음)
  begin
    insert into public.mission_claims (student_id, claim_date, coin, item_key)
    values (v_uid, v_today, v_coin, v_item)
    returning id into v_claim_id;
  exception when unique_violation then
    return jsonb_build_object('already', true);
  end;

  insert into public.coin_events (student_id, source_type, source_id, coin_delta)
  values (v_uid, 'bonus', v_claim_id, v_coin);
  update public.profiles set coin_balance = coin_balance + v_coin where id = v_uid;

  if v_item is not null then
    insert into public.student_items (student_id, item_key, qty)
    values (v_uid, v_item, 1)
    on conflict (student_id, item_key) do update set qty = public.student_items.qty + 1;
  end if;

  return jsonb_build_object('already', false, 'coin', v_coin,
                            'item_key', v_item, 'item_name', v_item_name);
end;
$$;
grant execute on function public.claim_mission_bonus() to authenticated;

-- 4) daily_checkin 재정의 (0006 로직 유지 + 스트릭 보호권 자동 사용 + 컴백 보상)
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
  v_freeze   boolean := false;
  v_comeback boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_prof from public.profiles where id = v_uid;

  -- 이미 오늘 체크인했으면 멱등 종료
  if v_prof.last_checkin_date = v_today then
    return jsonb_build_object('already', true, 'streak', v_prof.current_streak);
  end if;

  -- 출석 기록을 먼저 넣는다(동시성 게이트) — 이후 보호권 소비/보상이 중복되지 않게.
  begin
    insert into public.streak_checkins (student_id, checkin_date)
    values (v_uid, v_today)
    returning id into v_checkin_id;
  exception when unique_violation then
    return jsonb_build_object('already', true, 'streak', v_prof.current_streak);
  end;

  -- 스트릭 계산: 어제 출석 → +1 / 하루 놓침 + 보호권 보유 → 자동 사용하고 +1 / 그 외 → 1
  if v_prof.last_checkin_date = v_today - 1 then
    v_streak := v_prof.current_streak + 1;
  elsif v_prof.last_checkin_date = v_today - 2 then
    update public.student_items set qty = qty - 1
      where student_id = v_uid and item_key = 'STREAKFREEZE' and qty >= 1;
    if found then
      v_streak := v_prof.current_streak + 1;
      v_freeze := true;
    else
      v_streak := 1;
    end if;
  else
    v_streak := 1;
  end if;
  v_coin := 5 + least(v_streak, 10);   -- 스트릭 보너스

  -- 컴백 보상: 3일 이상 쉬다 돌아옴 (신규 학생 제외)
  if v_prof.last_checkin_date is not null and v_prof.last_checkin_date <= v_today - 4 then
    v_comeback := true;
  end if;

  update public.profiles
    set current_streak = v_streak,
        longest_streak = greatest(longest_streak, v_streak),
        last_checkin_date = v_today
    where id = v_uid;

  -- 코인 지급 (+ 컴백 보너스 30)
  insert into public.coin_events (student_id, source_type, source_id, coin_delta)
  values (v_uid, 'checkin', v_checkin_id, v_coin);
  if v_comeback then
    insert into public.coin_events (student_id, source_type, source_id, coin_delta)
    values (v_uid, 'bonus', v_checkin_id, 30);
  end if;
  update public.profiles
    set coin_balance = coin_balance + v_coin + (case when v_comeback then 30 else 0 end)
    where id = v_uid;

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

  return jsonb_build_object('already', false, 'streak', v_streak, 'xp', v_xp, 'coin', v_coin,
                            'freeze_used', v_freeze, 'comeback', v_comeback);
end;
$$;
