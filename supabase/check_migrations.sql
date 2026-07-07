-- =============================================================================
-- 마이그레이션 적용 상태 점검 (읽기 전용 — 아무것도 바꾸지 않습니다)
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- "❌ 실행 필요" 로 나온 것만 supabase/migrations/ 의 **번호 순서대로** 실행하면 됩니다.
-- (에러가 나면 그 Run 전체가 취소되니, 앞 번호부터 차례대로!)
-- =============================================================================

select name as "마이그레이션", case when ok then '✅ 적용됨' else '❌ 실행 필요' end as "상태" from (
  select '0001~0003 기본(테이블·스토리지·아이콘)' as name,
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='profiles') as ok
  union all select '0004 일일 학습기록(캘린더)',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='daily_logs')
  union all select '0005 포켓몬 "!" 질문',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='questions')
  union all select '0006 스트릭·주간랭킹',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='streak_checkins')
  union all select '0007 배틀(보스·야생)',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='battles')
  union all select '0008·0010 기술 상세·효과',
         exists(select 1 from information_schema.columns where table_schema='public' and table_name='moves' and column_name='function_code')
  union all select '0009 질문 읽기 안정화',
         exists(select 1 from pg_proc where proname='my_pending_questions')
  union all select '0011 프로필 보안가드',
         exists(select 1 from pg_proc where proname='guard_profile_columns')
  union all select '0012 인앱 알림(🔔)',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='notifications')
  union all select '0013 자동 리마인더',
         exists(select 1 from pg_proc where proname='generate_reminders')
  union all select '0014 문의·건의함(💌)',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='feedback')
  union all select '0015 성능팩·보안가드 복구',
         exists(select 1 from pg_proc where proname='admin_analytics')
  union all select '0016 도구(몬스터볼·상처약)·배틀 메뉴',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='items')
  union all select '0017 중복 보유 방지',
         exists(select 1 from pg_proc where proname='purchase_pokemon' and pg_get_functiondef(oid) like '%already owned%')
  union all select '0018 친구 1:1 대결(PvP)',
         exists(select 1 from information_schema.tables  where table_schema='public' and table_name='pvp_battles')
) s;
