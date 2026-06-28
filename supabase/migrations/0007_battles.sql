-- =============================================================================
-- 포켓몬 배틀: 시험 보스전 + 야생 조우. 진짜 기술 선택 턴제(레벨로 기술 해금,
-- 타입 상성·위력). 승리 시 경험치+코인+포획. 배틀 계산/보상은 서버(서비스롤)가 수행.
-- =============================================================================

-- 기술 / 타입 상성 / 종별 학습세트 (관리자가 임포트)
create table public.moves (
  move_key   text primary key,
  name_ko    text not null default '',
  power      int  not null default 0,
  move_type  text not null default 'normal',
  category   int  not null default 2,        -- 0 물리 / 1 특수 / 2 변화
  accuracy   int  not null default 100
);

create table public.type_relations (
  type        text primary key,
  weaknesses  text[] not null default '{}',  -- 이 타입을 공격할 때 효과가 굉장한 공격 타입들
  resistances text[] not null default '{}',
  immunities  text[] not null default '{}'
);

create table public.species_moves (
  id            uuid primary key default gen_random_uuid(),
  species_id    uuid not null references public.pokemon_species(id) on delete cascade,
  move_key      text not null,
  level_learned int  not null default 1,
  unique (species_id, move_key)
);
create index idx_species_moves_species on public.species_moves(species_id);

-- 조우(보스/야생) 정의. 보스는 날짜+대상 지정.
create table public.battle_encounters (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'boss' check (kind in ('boss','wild')),
  species_id    uuid not null references public.pokemon_species(id),
  level         int  not null default 5,
  title         text not null default '',
  encounter_date date,
  audience      text not null default 'all' check (audience in ('all','class')),
  class_id      uuid references public.classes(id) on delete cascade,
  reward_xp     int  not null default 100,
  reward_coin   int  not null default 30,
  catchable     boolean not null default true,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.encounter_targets (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.battle_encounters(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  unique (encounter_id, student_id)
);
create index idx_encounter_targets_student on public.encounter_targets(student_id);

-- 배틀 인스턴스 (서버 권위 상태)
create table public.battles (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles(id) on delete cascade,
  encounter_id       uuid references public.battle_encounters(id) on delete set null,
  kind               text not null default 'wild' check (kind in ('boss','wild')),
  enemy_species_id   uuid not null references public.pokemon_species(id),
  enemy_level        int not null,
  student_pokemon_id uuid references public.student_pokemon(id) on delete set null,
  state              jsonb not null default '{}'::jsonb,
  status             text not null default 'ongoing' check (status in ('ongoing','won','lost')),
  reward_xp          int not null default 0,
  reward_coin        int not null default 0,
  caught_species_id  uuid references public.pokemon_species(id),
  created_at         timestamptz not null default now(),
  finished_at        timestamptz
);
create index idx_battles_student on public.battles(student_id);

-- coin_events 에 battle 추가 (xp_events 는 이미 battle 포함)
alter table public.coin_events drop constraint if exists coin_events_source_type_check;
alter table public.coin_events add constraint coin_events_source_type_check
  check (source_type in ('submission','purchase','bonus','daily_log','question','checkin','battle'));

-- RLS
alter table public.moves              enable row level security;
alter table public.type_relations     enable row level security;
alter table public.species_moves      enable row level security;
alter table public.battle_encounters  enable row level security;
alter table public.encounter_targets  enable row level security;
alter table public.battles            enable row level security;

-- 배틀 기초 데이터: 인증 사용자 읽기, admin 쓰기
create policy "moves read" on public.moves for select using (auth.uid() is not null);
create policy "moves admin write" on public.moves for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "types read" on public.type_relations for select using (auth.uid() is not null);
create policy "types admin write" on public.type_relations for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "species_moves read" on public.species_moves for select using (auth.uid() is not null);
create policy "species_moves admin write" on public.species_moves for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- 조우: 대상 학생 또는 admin 읽기 / admin 쓰기
create policy "encounters read" on public.battle_encounters for select
  using (
    auth_role() = 'admin'
    or exists (select 1 from public.encounter_targets t
               where t.encounter_id = id and t.student_id = auth.uid())
  );
create policy "encounters admin write" on public.battle_encounters for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "enc_targets read" on public.encounter_targets for select
  using (student_id = auth.uid() or auth_role() = 'admin');
create policy "enc_targets admin write" on public.encounter_targets for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- 배틀: 본인/admin 읽기. 쓰기는 서버(service-role)만 → 클라 정책 없음.
create policy "battles read" on public.battles for select
  using (student_id = auth.uid() or auth_role() = 'admin');
