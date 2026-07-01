-- =============================================================================
-- 문의·건의함 — 학생이 버그/건의/질문을 남기면 관리자가 읽고 정리한다(개선 루프의 공급원).
-- 단방향(관리자 답변·학생 알림 없음). 제출 시 소액 보상(하루 1회). 문의 자체는 무제한 저장.
-- 설계상 "질문 기능(0005)"의 역방향: 학생→관리자. answer_question 지급 로직 재사용.
-- =============================================================================

create table public.feedback (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  category     text not null default 'etc' check (category in ('bug','idea','question','etc')),
  body         text not null,
  status       text not null default 'open' check (status in ('open','in_progress','resolved','wontfix')),
  admin_note   text not null default '',            -- 관리자 내부 메모(학생 비노출)
  xp_awarded   int  not null default 0,
  coin_awarded int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_feedback_student on public.feedback(student_id);
create index idx_feedback_status  on public.feedback(status, created_at desc);

-- 원장 source_type 에 feedback 추가
alter table public.xp_events drop constraint if exists xp_events_source_type_check;
alter table public.xp_events add constraint xp_events_source_type_check
  check (source_type in ('submission','bonus','battle','daily_log','question','checkin','feedback'));
alter table public.coin_events drop constraint if exists coin_events_source_type_check;
alter table public.coin_events add constraint coin_events_source_type_check
  check (source_type in ('submission','purchase','bonus','daily_log','question','checkin','battle','feedback'));

-- 문의 제출 + 소액 보상(하루 1회). 학생 본인(auth.uid())이 호출.
-- 문의는 항상 저장(데이터 최우선), 보상은 그날 처음 1건만.
create or replace function public.submit_feedback(
  p_category text,
  p_body text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid            uuid := auth.uid();
  v_today          date := (now() at time zone 'Asia/Seoul')::date;
  v_body           text := btrim(coalesce(p_body, ''));
  v_category       text := coalesce(nullif(p_category, ''), 'etc');
  v_fb_id          uuid;
  v_rewarded_today int;
  v_xp             int := 15;
  v_coin           int := 5;
  v_award          boolean := false;
  v_pet            public.student_pokemon;
  v_new_total int; v_new_level int; v_new_species uuid;
  v_leveled boolean := false; v_evolved boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if auth_role() <> 'student' then raise exception 'only students can submit feedback'; end if;
  if v_body = '' then raise exception 'empty body'; end if;
  if v_category not in ('bug','idea','question','etc') then v_category := 'etc'; end if;

  -- 문의 저장 (항상)
  insert into public.feedback (student_id, category, body)
  values (v_uid, v_category, v_body)
  returning id into v_fb_id;

  -- 오늘(KST) 이미 보상받은 문의가 있으면 보상 없음(도배 방지). 방금 저장한 건은 0/0이라 안 세짐.
  select count(*) into v_rewarded_today
  from public.feedback
  where student_id = v_uid
    and (xp_awarded > 0 or coin_awarded > 0)
    and (created_at at time zone 'Asia/Seoul')::date = v_today;

  if v_rewarded_today = 0 then
    v_award := true;

    -- 코인 지급 (활성펫 없어도 코인은 지급)
    insert into public.coin_events (student_id, source_type, source_id, coin_delta)
    values (v_uid, 'feedback', v_fb_id, v_coin);
    update public.profiles set coin_balance = coin_balance + v_coin where id = v_uid;

    -- 활성 포켓몬 경험치 (없으면 XP 스킵)
    select * into v_pet from public.student_pokemon
      where student_id = v_uid and is_active limit 1;
    if v_pet.id is not null then
      insert into public.xp_events (student_pokemon_id, source_type, source_id, xp_delta)
      values (v_pet.id, 'feedback', v_fb_id, v_xp);
      v_new_total := v_pet.xp + v_xp;
      v_new_level := public.level_for_xp(v_new_total);
      select species_id into v_new_species from public.evolution_stages
        where chain_id = v_pet.chain_id and min_level <= v_new_level
        order by stage_order desc limit 1;
      v_leveled := v_new_level > v_pet.level;
      v_evolved := v_new_species is not null and v_new_species <> v_pet.current_species_id;
      update public.student_pokemon
        set xp = v_new_total, level = v_new_level,
            current_species_id = coalesce(v_new_species, current_species_id), updated_at = now()
        where id = v_pet.id;
    else
      v_xp := 0;
    end if;

    update public.feedback set xp_awarded = v_xp, coin_awarded = v_coin, updated_at = now()
      where id = v_fb_id;
  end if;

  return jsonb_build_object(
    'id', v_fb_id,
    'awarded', v_award,
    'xp', case when v_award then v_xp else 0 end,
    'coin', case when v_award then v_coin else 0 end,
    'leveled_up', v_leveled,
    'evolved', v_evolved
  );
end;
$$;

-- 학생 본인 문의 목록(관리자 메모 제외). 0009 my_pending_questions 패턴.
create or replace function public.my_feedback()
returns table (
  id uuid, category text, body text, status text,
  xp_awarded int, coin_awarded int, created_at timestamptz
)
language sql security definer set search_path = public as $$
  select id, category, body, status, xp_awarded, coin_awarded, created_at
  from public.feedback
  where student_id = auth.uid()
  order by created_at desc;
$$;

-- RLS: 직접 select/update 는 admin 만. 학생 제출=submit_feedback, 조회=my_feedback (둘 다 SECURITY DEFINER).
-- → 학생은 admin_note 를 절대 못 읽는다(테이블 직접 접근 정책 없음).
alter table public.feedback enable row level security;
create policy "feedback admin read" on public.feedback for select
  using (auth_role() = 'admin');
create policy "feedback admin manage" on public.feedback for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
