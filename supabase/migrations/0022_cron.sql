-- =============================================================================
-- 자동 실행 스케줄(pg_cron) 연결.
--   * daily-reminders: 매일 KST 17:00 — 마감 임박 미제출·스트릭 위험 학생에게
--     인앱 알림 발송 (0013 의 generate_reminders — 지금까지 수동 호출만 가능했음)
--   * trim-app-events: 매일 KST 04:00 — 90일 지난 행동 로그(0020 app_events) 정리
-- 사전 준비: Supabase Dashboard → Database → Extensions 에서 pg_cron 켜기
-- (아래 create extension 이 대신 켜 주기도 하지만, 실패하면 Extensions 에서 켠 뒤 재실행)
-- =============================================================================

create extension if not exists pg_cron;

do $$
begin
  -- 재실행해도 안전하게: 같은 이름의 잡이 있으면 지우고 다시 등록
  if exists (select 1 from cron.job where jobname = 'daily-reminders') then
    perform cron.unschedule('daily-reminders');
  end if;
  perform cron.schedule('daily-reminders', '0 8 * * *',   -- UTC 08:00 = KST 17:00
    'select public.generate_reminders();');

  if exists (select 1 from cron.job where jobname = 'trim-app-events') then
    perform cron.unschedule('trim-app-events');
  end if;
  perform cron.schedule('trim-app-events', '0 19 * * *',  -- UTC 19:00 = KST 04:00
    'delete from public.app_events where created_at < now() - interval ''90 days''');
end $$;

-- 확인: select jobname, schedule from cron.job;
-- 수동 테스트: select public.generate_reminders();
