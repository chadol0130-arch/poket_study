-- =============================================================================
-- 자동 리마인더: 마감 임박(미제출) 숙제 / 스트릭 끊김 직전 학생에게 인앱 알림.
-- 하루 1번 호출(아래 pg_cron 또는 수동). 같은 날 중복 발송 방지.
-- 알림 자체는 0012 의 notifications 사용. (인앱 배지로 다음 접속 시 확인)
-- =============================================================================

create or replace function public.generate_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_count int;
begin
  with eligible as (
    select p.id,
           exists (
             select 1 from public.homework_assignments a
             where a.due_at is not null
               and a.due_at between now() and now() + interval '2 days'
               and a.class_id in (
                 select e.class_id from public.enrollments e
                 where e.student_id = p.id and e.status = 'active'
               )
               and not exists (
                 select 1 from public.submissions s
                 where s.assignment_id = a.id and s.student_id = p.id and s.status = 'approved'
               )
           ) as due_soon,
           (p.current_streak > 0 and coalesce(p.last_checkin_date, date '1970-01-01') < v_today) as streak_risk
    from public.profiles p
    where p.role = 'student'
  )
  insert into public.notifications (user_id, kind, title, body, href)
  select e.id, 'reminder', '오늘의 할 일 ⏰',
         case
           when e.due_soon and e.streak_risk then '마감 임박 숙제가 있어요. 출석체크도 잊지 마세요!'
           when e.due_soon then '마감이 다가오는 숙제가 있어요. 지금 제출해요!'
           else '오늘 출석체크하면 스트릭이 이어져요! 🔥'
         end,
         case when e.due_soon then '/homework/schedule' else '/dashboard' end
  from eligible e
  where (e.due_soon or e.streak_risk)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = e.id and n.kind = 'reminder'
        and (n.created_at at time zone 'Asia/Seoul')::date = v_today
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- pg_cron 으로 매일 발송하려면(선택): Supabase Dashboard → Database → Extensions 에서
-- pg_cron 활성화 후 아래 1줄 실행. (UTC 기준 — 08:00 UTC = 한국 17:00)
--   select cron.schedule('daily-reminders', '0 8 * * *', $$ select public.generate_reminders(); $$);
-- 테스트: select public.generate_reminders();
