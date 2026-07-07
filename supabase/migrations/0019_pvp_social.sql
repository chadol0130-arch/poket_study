-- =============================================================================
-- PvP 소셜: 승수 랭킹 RPC + 관전 모드(같은 반 조회 허용)
--   * 전적·랭킹은 기존 pvp_battles 데이터 집계(스키마 무변경)
--   * 관전 = 조회 RLS 를 "challenger 와 같은 반"까지 확대 → 기존 Realtime 구독이
--     그대로 생중계가 됨. 조작(턴/기권)은 서버 액션의 참가자 검증이 계속 차단.
-- =============================================================================

-- PvP 승수 랭킹 (반 친구, 전체 기간) — weekly_leaderboard(0006) classmates 패턴 재사용
create or replace function public.pvp_leaderboard()
returns table (student_id uuid, display_name text, wins bigint, losses bigint, is_me boolean)
language sql security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  classmates as (
    select distinct e2.student_id
    from public.enrollments e1
    join public.enrollments e2 on e2.class_id = e1.class_id and e2.status = 'active'
    where e1.student_id = (select uid from me) and e1.status = 'active'
  ),
  stats as (
    select c.student_id,
      count(*) filter (
        where (b.status = 'won_challenger' and b.challenger_id = c.student_id)
           or (b.status = 'won_opponent'  and b.opponent_id  = c.student_id)
      ) as wins,
      count(*) filter (
        where (b.status = 'won_challenger' and b.opponent_id  = c.student_id)
           or (b.status = 'won_opponent'  and b.challenger_id = c.student_id)
      ) as losses
    from classmates c
    left join public.pvp_battles b
      on (b.challenger_id = c.student_id or b.opponent_id = c.student_id)
     and b.status in ('won_challenger','won_opponent')
    group by c.student_id
  )
  select p.id as student_id,
         p.display_name,
         coalesce(s.wins, 0)   as wins,
         coalesce(s.losses, 0) as losses,
         (p.id = (select uid from me)) as is_me
  from classmates c
  join public.profiles p on p.id = c.student_id
  left join stats s on s.student_id = c.student_id
  order by wins desc, losses asc, p.display_name asc;
$$;

-- 관전: challenger 와 같은 반 학생도 조회 가능 (Realtime 도 RLS 를 따라 관전자에게 전달)
drop policy if exists "pvp read own" on public.pvp_battles;
create policy "pvp read own" on public.pvp_battles for select
  using (
    challenger_id = (select auth.uid())
    or opponent_id = (select auth.uid())
    or (select auth_role()) = 'admin'
    or exists (
      select 1
      from public.enrollments e1
      join public.enrollments e2
        on e2.class_id = e1.class_id and e2.status = 'active'
      where e1.student_id = (select auth.uid())
        and e1.status = 'active'
        and e2.student_id = pvp_battles.challenger_id
    )
  );
