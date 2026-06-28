-- =============================================================================
-- 날짜별 학습 기록(캘린더). 학생이 날짜마다 목표를 적고 사진을 올리면,
-- 선생님이 승인 시 활성 포켓몬에 경험치/코인 지급 (기존 숙제와 동일한 보상 루프).
-- =============================================================================

create table public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  log_date      date not null,
  goal          text not null default '',
  photo_paths   text[] not null default '{}',            -- 버킷 homework-photos
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at  timestamptz not null default now(),
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  reject_reason text,
  xp_awarded    int not null default 0,
  coin_awarded  int not null default 0,
  unique (student_id, log_date)                            -- 하루 1개
);
create index idx_daily_logs_status on public.daily_logs(status);
create index idx_daily_logs_student_date on public.daily_logs(student_id, log_date);

-- 원장 source_type 에 daily_log 추가 (멱등 보장은 기존 UNIQUE 그대로 활용)
alter table public.xp_events drop constraint if exists xp_events_source_type_check;
alter table public.xp_events add constraint xp_events_source_type_check
  check (source_type in ('submission','bonus','battle','daily_log'));
alter table public.coin_events drop constraint if exists coin_events_source_type_check;
alter table public.coin_events add constraint coin_events_source_type_check
  check (source_type in ('submission','purchase','bonus','daily_log'));

-- 승인 시 보상 지급 (하루 기록 보상량은 아래 상수에서 조정)
create or replace function public.award_for_daily_log(p_log_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_log        public.daily_logs;
  v_pet        public.student_pokemon;
  v_xp         int := 50;   -- 하루 기록 승인 보상 (조정 가능)
  v_coin       int := 10;
  v_new_total  int;
  v_new_level  int;
  v_new_species uuid;
begin
  select * into v_log from public.daily_logs where id = p_log_id;
  if v_log.id is null or v_log.status <> 'approved' then
    return;
  end if;

  -- (1) 코인 — 멱등(coin_events UNIQUE)
  begin
    insert into public.coin_events (student_id, source_type, source_id, coin_delta)
    values (v_log.student_id, 'daily_log', v_log.id, v_coin);
    update public.profiles set coin_balance = coin_balance + v_coin where id = v_log.student_id;
    update public.daily_logs set coin_awarded = v_coin where id = v_log.id;
  exception when unique_violation then null;
  end;

  -- (2) 활성 포켓몬 경험치 — 멱등(xp_events UNIQUE)
  select * into v_pet from public.student_pokemon
    where student_id = v_log.student_id and is_active limit 1;
  if v_pet.id is not null then
    begin
      insert into public.xp_events (student_pokemon_id, source_type, source_id, xp_delta)
      values (v_pet.id, 'daily_log', v_log.id, v_xp);

      v_new_total := v_pet.xp + v_xp;
      v_new_level := public.level_for_xp(v_new_total);
      select species_id into v_new_species from public.evolution_stages
        where chain_id = v_pet.chain_id and min_level <= v_new_level
        order by stage_order desc limit 1;

      update public.student_pokemon
        set xp = v_new_total, level = v_new_level,
            current_species_id = coalesce(v_new_species, current_species_id),
            updated_at = now()
        where id = v_pet.id;
      update public.daily_logs set xp_awarded = v_xp where id = v_log.id;
    exception when unique_violation then null;
    end;
  end if;
end;
$$;

create or replace function public.handle_daily_log_award()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award_for_daily_log(new.id);
  return new;
end;
$$;

drop trigger if exists trg_award_on_daily_approve on public.daily_logs;
create trigger trg_award_on_daily_approve
  after update of status on public.daily_logs
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.handle_daily_log_award();

-- RLS
alter table public.daily_logs enable row level security;

create policy "daily read" on public.daily_logs for select
  using (student_id = auth.uid() or auth_role() = 'admin' or teaches_student(student_id));

create policy "daily student insert" on public.daily_logs for insert
  with check (student_id = auth.uid());

-- 학생은 아직 검사 전(또는 반려된) 기록만 수정 가능
create policy "daily student update" on public.daily_logs for update
  using (student_id = auth.uid() and status in ('pending', 'rejected'))
  with check (student_id = auth.uid());

create policy "daily staff review" on public.daily_logs for update
  using (auth_role() = 'admin' or teaches_student(student_id));
