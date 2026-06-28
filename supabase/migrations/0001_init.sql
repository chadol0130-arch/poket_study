-- =============================================================================
-- 포켓몬 숙제 트래커 — 초기 스키마
-- 학생이 숙제를 제출 → 선생님이 승인 → 활성 포켓몬에 경험치/코인 지급 →
-- 레벨업/진화, 코인으로 상점에서 새 포켓몬 구입/수집.
--
-- 보안 원칙:
--   * 모든 테이블 RLS 활성화 (deny-by-default).
--   * 경험치/레벨/코인 변경 같은 "신뢰가 필요한" 변형은 SECURITY DEFINER 함수만 수행.
--     클라이언트에는 해당 UPDATE 정책을 주지 않는다.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. 신원 / 역할
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'student' check (role in ('admin','teacher','student')),
  full_name     text not null default '',
  display_name  text not null default '',
  coin_balance  int  not null default 0 check (coin_balance >= 0),
  created_at    timestamptz not null default now()
);
comment on table public.profiles is 'auth.users 1:1 프로필 + 역할 + 코인 잔액';

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  academy_id  uuid,                                   -- 멀티 학원 확장용(현재 nullable)
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.class_teachers (
  class_id    uuid not null references public.classes(id) on delete cascade,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (class_id, teacher_id)
);

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'active' check (status in ('active','inactive')),
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- -----------------------------------------------------------------------------
-- 2. 포켓몬 카탈로그 (소유자 업로드)
-- -----------------------------------------------------------------------------

create table public.pokemon_species (
  id              uuid primary key default gen_random_uuid(),
  pokedex_number  int unique not null,
  name            text not null,
  name_ko         text not null default '',
  type1           text,
  type2           text,
  base_stats      jsonb not null default '{}'::jsonb,  -- 배틀용(추후)
  created_at      timestamptz not null default now()
);

create table public.evolution_chains (
  id    uuid primary key default gen_random_uuid(),
  name  text not null
);

-- 진화 단계: 레벨 -> 진화 종 매핑의 핵심. 주어진 레벨에서 현재 종은
-- min_level <= level 인 행 중 stage_order 가 가장 큰 행이다.
create table public.evolution_stages (
  id          uuid primary key default gen_random_uuid(),
  chain_id    uuid not null references public.evolution_chains(id) on delete cascade,
  species_id  uuid not null references public.pokemon_species(id) on delete cascade,
  stage_order int  not null,            -- 1 = 기본
  min_level   int  not null default 1,
  unique (chain_id, stage_order)
);

create table public.sprites (
  id            uuid primary key default gen_random_uuid(),
  species_id    uuid not null references public.pokemon_species(id) on delete cascade,
  variant       text not null default 'default' check (variant in ('default','shiny','back','front')),
  storage_path  text not null,          -- 버킷 pokemon-sprites 내 경로
  unique (species_id, variant)
);

-- -----------------------------------------------------------------------------
-- 3. 코인 경제: 스타터 후보 / 상점
-- -----------------------------------------------------------------------------

-- 학생이 온보딩에서 고를 수 있는 스타터 후보 (admin 구성)
create table public.starter_options (
  id            uuid primary key default gen_random_uuid(),
  species_id    uuid not null references public.pokemon_species(id) on delete cascade,
  chain_id      uuid not null references public.evolution_chains(id) on delete cascade,
  display_order int  not null default 0,
  is_active     boolean not null default true,
  unique (species_id)
);

-- 상점에서 코인으로 살 수 있는 포켓몬 (admin 구성)
create table public.shop_listings (
  id                uuid primary key default gen_random_uuid(),
  species_id        uuid not null references public.pokemon_species(id) on delete cascade,
  chain_id          uuid not null references public.evolution_chains(id) on delete cascade,
  price             int  not null check (price >= 0),
  is_active         boolean not null default true,
  display_order     int  not null default 0,
  min_level_to_buy  int  not null default 0,
  created_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. 소유 포켓몬 (한 학생이 여러 마리 수집, 대표 1마리만 활성)
-- -----------------------------------------------------------------------------

create table public.student_pokemon (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.profiles(id) on delete cascade,
  chain_id            uuid not null references public.evolution_chains(id),
  current_species_id  uuid not null references public.pokemon_species(id),
  nickname            text,
  level               int not null default 1 check (level >= 1),
  xp                  int not null default 0 check (xp >= 0),   -- 누적 총 경험치
  is_active           boolean not null default false,
  acquired_via        text not null default 'starter' check (acquired_via in ('starter','purchase','gift')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 대표(활성) 포켓몬은 학생당 최대 1마리
create unique index uniq_active_pet on public.student_pokemon(student_id) where is_active;
create index idx_student_pokemon_student on public.student_pokemon(student_id);

-- -----------------------------------------------------------------------------
-- 5. 숙제
-- -----------------------------------------------------------------------------

create table public.homework_assignments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  title       text not null,
  description text not null default '',
  due_at      timestamptz,
  xp_reward   int not null default 50 check (xp_reward >= 0),
  coin_reward int not null default 10 check (coin_reward >= 0),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.homework_assignments(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  photo_paths    text[] not null default '{}',          -- 버킷 homework-photos 내 경로
  note           text not null default '',
  submitted_at   timestamptz not null default now(),
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  reject_reason  text,
  xp_awarded     int not null default 0,
  coin_awarded   int not null default 0,
  unique (assignment_id, student_id)                     -- 과제당 1제출(재제출은 갱신)
);
create index idx_submissions_status on public.submissions(status);

-- -----------------------------------------------------------------------------
-- 6. 원장(append-only) — 멱등 보장 + 감사
-- -----------------------------------------------------------------------------

create table public.xp_events (
  id                 uuid primary key default gen_random_uuid(),
  student_pokemon_id uuid not null references public.student_pokemon(id) on delete cascade,
  source_type        text not null check (source_type in ('submission','bonus','battle')),
  source_id          uuid not null,
  xp_delta           int not null,
  created_at         timestamptz not null default now(),
  unique (source_type, source_id)                        -- 동일 출처 중복 지급 방지
);

create table public.coin_events (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  source_type  text not null check (source_type in ('submission','purchase','bonus')),
  source_id    uuid not null,
  coin_delta   int not null,                             -- + 획득 / - 사용
  created_at   timestamptz not null default now(),
  unique (source_type, source_id)
);

-- =============================================================================
-- 함수 / 트리거
-- =============================================================================

-- auth.users insert 시 profiles 자동 생성 (기본 역할 student, 메타데이터 우선)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 역할/권한 헬퍼 (RLS 정책에서 재사용)
create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.teaches_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.class_teachers
    where class_id = p_class_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.teaches_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.enrollments e
    join public.class_teachers ct on ct.class_id = e.class_id
    where e.student_id = p_student_id
      and ct.teacher_id = auth.uid()
      and e.status = 'active'
  );
$$;

-- 경험치 곡선: 누적 총 경험치 -> 레벨. xp_to_reach(L) = base * (L-1)^exponent
create or replace function public.level_for_xp(p_total_xp int)
returns int language plpgsql immutable as $$
declare
  v_level int := 1;
  v_base  int := 100;
  v_exp   numeric := 1.5;
  v_max   int := 100;
begin
  if p_total_xp <= 0 then
    return 1;
  end if;
  while v_level < v_max loop
    -- 레벨 v_level -> v_level+1 로 가는 데 필요한 누적 경험치
    exit when p_total_xp < (v_base * power(v_level, v_exp));
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- 승인된 제출에 대한 경험치/코인 지급 (멱등, 트랜잭션)
create or replace function public.award_for_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sub        public.submissions;
  v_assignment public.homework_assignments;
  v_pet        public.student_pokemon;
  v_xp         int;
  v_coin       int;
  v_new_total  int;
  v_new_level  int;
  v_new_species uuid;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if v_sub.id is null or v_sub.status <> 'approved' then
    return;
  end if;

  select * into v_assignment from public.homework_assignments where id = v_sub.assignment_id;
  v_xp   := coalesce(v_assignment.xp_reward, 0);
  v_coin := coalesce(v_assignment.coin_reward, 0);

  -- (1) 코인 지급 — coin_events UNIQUE(source_type, source_id) 로 멱등
  begin
    insert into public.coin_events (student_id, source_type, source_id, coin_delta)
    values (v_sub.student_id, 'submission', v_sub.id, v_coin);

    update public.profiles set coin_balance = coin_balance + v_coin where id = v_sub.student_id;
    update public.submissions set coin_awarded = v_coin where id = v_sub.id;
  exception when unique_violation then
    null;  -- 이미 지급됨
  end;

  -- (2) 활성 포켓몬에 경험치 지급 — xp_events UNIQUE 로 멱등
  select * into v_pet from public.student_pokemon
    where student_id = v_sub.student_id and is_active limit 1;

  if v_pet.id is not null and v_xp > 0 then
    begin
      insert into public.xp_events (student_pokemon_id, source_type, source_id, xp_delta)
      values (v_pet.id, 'submission', v_sub.id, v_xp);

      v_new_total := v_pet.xp + v_xp;
      v_new_level := public.level_for_xp(v_new_total);

      select species_id into v_new_species from public.evolution_stages
        where chain_id = v_pet.chain_id and min_level <= v_new_level
        order by stage_order desc limit 1;

      update public.student_pokemon
        set xp = v_new_total,
            level = v_new_level,
            current_species_id = coalesce(v_new_species, current_species_id),
            updated_at = now()
        where id = v_pet.id;

      update public.submissions set xp_awarded = v_xp where id = v_sub.id;
    exception when unique_violation then
      null;  -- 이미 지급됨
    end;
  end if;
end;
$$;

-- status 가 approved 로 전이될 때 지급 함수 호출
create or replace function public.handle_submission_award()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award_for_submission(new.id);
  return new;
end;
$$;

drop trigger if exists trg_award_on_approve on public.submissions;
create trigger trg_award_on_approve
  after update of status on public.submissions
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.handle_submission_award();

-- 스타터 선택 (1회만)
create or replace function public.choose_starter(p_species_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_chain uuid;
  v_id    uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select chain_id into v_chain from public.starter_options
    where species_id = p_species_id and is_active limit 1;
  if v_chain is null then raise exception 'invalid starter'; end if;

  if exists (select 1 from public.student_pokemon where student_id = v_uid) then
    raise exception 'starter already chosen';
  end if;

  insert into public.student_pokemon
    (student_id, chain_id, current_species_id, level, xp, is_active, acquired_via)
  values
    (v_uid, v_chain, p_species_id, 1, 0, true, 'starter')
  returning id into v_id;

  return v_id;
end;
$$;

-- 상점 구입 (잔액 검증 + 코인 차감 + 새 포켓몬 생성, 트랜잭션)
create or replace function public.purchase_pokemon(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_listing  public.shop_listings;
  v_balance  int;
  v_purchase uuid := gen_random_uuid();
  v_id       uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_listing from public.shop_listings where id = p_listing_id and is_active;
  if v_listing.id is null then raise exception 'listing not available'; end if;

  -- 행 잠금으로 동시 구입 이중 차감 방지
  select coin_balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < v_listing.price then raise exception 'insufficient coins'; end if;

  insert into public.coin_events (student_id, source_type, source_id, coin_delta)
  values (v_uid, 'purchase', v_purchase, -v_listing.price);

  update public.profiles set coin_balance = coin_balance - v_listing.price where id = v_uid;

  insert into public.student_pokemon
    (student_id, chain_id, current_species_id, level, xp, is_active, acquired_via)
  values
    (v_uid, v_listing.chain_id, v_listing.species_id, 1, 0, false, 'purchase')
  returning id into v_id;

  return v_id;
end;
$$;

-- 대표(활성) 포켓몬 전환
create or replace function public.set_active_pokemon(p_sp_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.student_pokemon where id = p_sp_id and student_id = v_uid) then
    raise exception 'not your pokemon';
  end if;

  update public.student_pokemon set is_active = false where student_id = v_uid and is_active;
  update public.student_pokemon set is_active = true  where id = p_sp_id;
end;
$$;

-- =============================================================================
-- RLS 정책
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.classes             enable row level security;
alter table public.class_teachers      enable row level security;
alter table public.enrollments         enable row level security;
alter table public.pokemon_species     enable row level security;
alter table public.evolution_chains    enable row level security;
alter table public.evolution_stages    enable row level security;
alter table public.sprites             enable row level security;
alter table public.starter_options     enable row level security;
alter table public.shop_listings       enable row level security;
alter table public.student_pokemon     enable row level security;
alter table public.homework_assignments enable row level security;
alter table public.submissions         enable row level security;
alter table public.xp_events           enable row level security;
alter table public.coin_events         enable row level security;

-- profiles --------------------------------------------------------------------
create policy "profiles self/staff read" on public.profiles for select
  using (id = auth.uid() or auth_role() in ('admin','teacher'));
create policy "profiles self update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all" on public.profiles for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- classes ---------------------------------------------------------------------
create policy "classes staff read" on public.classes for select
  using (
    auth_role() in ('admin','teacher')
    or exists (select 1 from public.enrollments e where e.class_id = id and e.student_id = auth.uid())
  );
create policy "classes staff write" on public.classes for all
  using (auth_role() = 'admin' or teaches_class(id))
  with check (auth_role() in ('admin','teacher'));

-- class_teachers --------------------------------------------------------------
create policy "class_teachers staff read" on public.class_teachers for select
  using (auth_role() in ('admin','teacher'));
create policy "class_teachers admin write" on public.class_teachers for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- enrollments -----------------------------------------------------------------
create policy "enrollments read" on public.enrollments for select
  using (student_id = auth.uid() or auth_role() = 'admin' or teaches_class(class_id));
create policy "enrollments staff write" on public.enrollments for all
  using (auth_role() = 'admin' or teaches_class(class_id))
  with check (auth_role() = 'admin' or teaches_class(class_id));

-- 카탈로그: 인증 사용자 읽기, admin 쓰기 ------------------------------------------
create policy "species read" on public.pokemon_species for select using (auth.uid() is not null);
create policy "species admin write" on public.pokemon_species for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "chains read" on public.evolution_chains for select using (auth.uid() is not null);
create policy "chains admin write" on public.evolution_chains for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "stages read" on public.evolution_stages for select using (auth.uid() is not null);
create policy "stages admin write" on public.evolution_stages for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "sprites read" on public.sprites for select using (auth.uid() is not null);
create policy "sprites admin write" on public.sprites for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "starters read" on public.starter_options for select using (auth.uid() is not null);
create policy "starters admin write" on public.starter_options for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "shop read" on public.shop_listings for select using (auth.uid() is not null);
create policy "shop admin write" on public.shop_listings for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- student_pokemon: 본인/담당교사/admin 읽기. 쓰기는 함수(SECURITY DEFINER)만 + admin --
create policy "pet read" on public.student_pokemon for select
  using (student_id = auth.uid() or auth_role() = 'admin' or teaches_student(student_id));
create policy "pet admin write" on public.student_pokemon for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- homework_assignments --------------------------------------------------------
create policy "assignments read" on public.homework_assignments for select
  using (
    auth_role() = 'admin'
    or teaches_class(class_id)
    or exists (select 1 from public.enrollments e
               where e.class_id = class_id and e.student_id = auth.uid() and e.status = 'active')
  );
create policy "assignments staff write" on public.homework_assignments for all
  using (auth_role() = 'admin' or teaches_class(class_id))
  with check (auth_role() = 'admin' or teaches_class(class_id));

-- submissions -----------------------------------------------------------------
create policy "submissions read" on public.submissions for select
  using (
    student_id = auth.uid()
    or auth_role() = 'admin'
    or exists (select 1 from public.homework_assignments a
               where a.id = assignment_id and teaches_class(a.class_id))
  );
create policy "submissions student insert" on public.submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.homework_assignments a
      join public.enrollments e on e.class_id = a.class_id
      where a.id = assignment_id and e.student_id = auth.uid() and e.status = 'active'
    )
  );
create policy "submissions student update pending" on public.submissions for update
  using (student_id = auth.uid() and status = 'pending')
  with check (student_id = auth.uid());
create policy "submissions staff review" on public.submissions for update
  using (
    auth_role() = 'admin'
    or exists (select 1 from public.homework_assignments a
               where a.id = assignment_id and teaches_class(a.class_id))
  );

-- xp_events / coin_events: 읽기만(본인/admin), 쓰기는 함수만 ----------------------
create policy "xp_events read" on public.xp_events for select
  using (
    auth_role() = 'admin'
    or exists (select 1 from public.student_pokemon sp
               where sp.id = student_pokemon_id and sp.student_id = auth.uid())
  );
create policy "coin_events read" on public.coin_events for select
  using (student_id = auth.uid() or auth_role() = 'admin');
