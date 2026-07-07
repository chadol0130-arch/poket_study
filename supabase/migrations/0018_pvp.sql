-- =============================================================================
-- 학생 1:1 실시간 대전 (PvP)
--   * 같은 반 친구에게 도전장 → 수락 시 교대 턴제 실시간 배틀 (Supabase Realtime 구독)
--   * 하루 도전 3회·같은 상대 1회, 보상 = XP만(승 20/패 5) — 앱 서버 액션이 검증·집행
--   * 쓰기는 전부 service-role(서버 액션), 클라이언트는 본인 참가 배틀 읽기만
-- =============================================================================

create table public.pvp_battles (
  id                    uuid primary key default gen_random_uuid(),
  challenger_id         uuid not null references public.profiles(id) on delete cascade,
  opponent_id           uuid not null references public.profiles(id) on delete cascade,
  challenger_pokemon_id uuid references public.student_pokemon(id) on delete set null,
  opponent_pokemon_id   uuid references public.student_pokemon(id) on delete set null,
  status       text not null default 'pending'
                 check (status in ('pending','active','declined','won_challenger','won_opponent')),
  current_turn text check (current_turn in ('challenger','opponent')),
  turn_no      int  not null default 0,                 -- 낙관적 동시성(CAS) 키
  state        jsonb not null default '{}'::jsonb,      -- {challenger, opponent, playerNames, log[]}
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz not null default now()       -- 턴 타임아웃 판정 기준
);
create index idx_pvp_challenger on public.pvp_battles(challenger_id, created_at desc);
create index idx_pvp_opponent   on public.pvp_battles(opponent_id, created_at desc);

-- 한 쌍(방향 무관)당 열린 대결(pending/active)은 1개만 — 동시 도전 경합의 DB 백스톱
create unique index uniq_pvp_open_pair on public.pvp_battles
  (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id))
  where status in ('pending','active');

-- RLS: 참가자·admin 읽기만. 쓰기 정책 없음 → service-role(서버 액션) 전용.
alter table public.pvp_battles enable row level security;
create policy "pvp read own" on public.pvp_battles for select
  using (
    challenger_id = (select auth.uid())
    or opponent_id = (select auth.uid())
    or (select auth_role()) = 'admin'
  );

-- 실시간 구독 활성화 (postgres_changes — RLS 를 준수해 참가자에게만 전달됨)
alter publication supabase_realtime add table public.pvp_battles;

-- 원장 source_type 에 pvp 추가 (보상 멱등은 status 원자 플립이 보장)
alter table public.xp_events drop constraint if exists xp_events_source_type_check;
alter table public.xp_events add constraint xp_events_source_type_check
  check (source_type in ('submission','bonus','battle','daily_log','question','checkin','feedback','pvp'));
