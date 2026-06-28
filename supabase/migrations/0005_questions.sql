-- =============================================================================
-- 포켓몬 "!" 질문 — 관리자가 학생에게 질문을 보내면, 학생의 활성 포켓몬에 "!"가 뜨고
-- 답하면 즉시 경험치 지급. 답변은 쌓여 관리자가 학생 니즈를 분석한다.
-- 질문 형식: 주관식(open) / 객관식(choice), 대상: 전체/반/개별(생성 시 학생별 행으로 펼침).
-- =============================================================================

create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references public.profiles(id),
  body        text not null,
  kind        text not null default 'open' check (kind in ('open','choice')),
  options     text[] not null default '{}',        -- 객관식 선택지(주관식은 빈 배열)
  xp_reward   int not null default 20 check (xp_reward >= 0),
  audience    text not null default 'students' check (audience in ('all','class','students')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 누가 이 질문을 받는가 (전체/반/개별 모두 학생별 행으로 펼쳐 저장)
create table public.question_targets (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  unique (question_id, student_id)
);
create index idx_question_targets_student on public.question_targets(student_id);

create table public.question_answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  answer_text  text not null default '',
  choice_index int,                                 -- 객관식 선택 인덱스(주관식은 null)
  answered_at  timestamptz not null default now(),
  xp_awarded   int not null default 0,
  unique (question_id, student_id)                  -- 질문당 1회 답변
);

-- 원장 source_type 에 question 추가
alter table public.xp_events drop constraint if exists xp_events_source_type_check;
alter table public.xp_events add constraint xp_events_source_type_check
  check (source_type in ('submission','bonus','battle','daily_log','question'));

-- 답변 + 즉시 경험치 지급 (트랜잭션·멱등). 학생 본인(auth.uid())이 호출.
create or replace function public.answer_question(
  p_question_id uuid,
  p_answer text,
  p_choice_index int
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  v_q          public.questions;
  v_answer_id  uuid;
  v_pet        public.student_pokemon;
  v_new_total  int;
  v_new_level  int;
  v_new_species uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_q from public.questions where id = p_question_id and is_active;
  if v_q.id is null then raise exception 'question not available'; end if;

  -- 대상 학생인지 확인
  if not exists (
    select 1 from public.question_targets
    where question_id = p_question_id and student_id = v_uid
  ) then
    raise exception 'not a target of this question';
  end if;

  -- 답변 저장 (이미 답했으면 멱등 종료)
  begin
    insert into public.question_answers (question_id, student_id, answer_text, choice_index, xp_awarded)
    values (p_question_id, v_uid, coalesce(p_answer, ''), p_choice_index, v_q.xp_reward)
    returning id into v_answer_id;
  exception when unique_violation then
    return;  -- 이미 답함
  end;

  -- 경험치 지급 (활성 포켓몬). source_id = answer id 라 학생별로 고유 → 전역 unique 충돌 없음.
  select * into v_pet from public.student_pokemon
    where student_id = v_uid and is_active limit 1;
  if v_pet.id is not null and v_q.xp_reward > 0 then
    insert into public.xp_events (student_pokemon_id, source_type, source_id, xp_delta)
    values (v_pet.id, 'question', v_answer_id, v_q.xp_reward);

    v_new_total := v_pet.xp + v_q.xp_reward;
    v_new_level := public.level_for_xp(v_new_total);
    select species_id into v_new_species from public.evolution_stages
      where chain_id = v_pet.chain_id and min_level <= v_new_level
      order by stage_order desc limit 1;

    update public.student_pokemon
      set xp = v_new_total, level = v_new_level,
          current_species_id = coalesce(v_new_species, current_species_id),
          updated_at = now()
      where id = v_pet.id;
  end if;
end;
$$;

-- RLS
alter table public.questions         enable row level security;
alter table public.question_targets  enable row level security;
alter table public.question_answers  enable row level security;

-- 질문: 대상 학생 또는 admin 읽기 / admin 만 쓰기
create policy "questions read" on public.questions for select
  using (
    auth_role() = 'admin'
    or exists (select 1 from public.question_targets t
               where t.question_id = id and t.student_id = auth.uid())
  );
create policy "questions admin write" on public.questions for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- 대상: 본인 또는 admin 읽기 / admin 만 쓰기
create policy "targets read" on public.question_targets for select
  using (student_id = auth.uid() or auth_role() = 'admin');
create policy "targets admin write" on public.question_targets for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- 답변: 본인 또는 admin 읽기. 쓰기는 RPC(answer_question)만 → 클라이언트 insert 정책 없음.
create policy "answers read" on public.question_answers for select
  using (student_id = auth.uid() or auth_role() = 'admin');
