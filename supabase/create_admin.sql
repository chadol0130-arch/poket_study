-- =============================================================================
-- 첫 관리자 만들기 (가장 쉬운 방법)
--
-- 사용법:
--   1) Supabase 대시보드 → Authentication → Users → "Add user" 로 본인 계정을
--      이메일/비밀번호로 먼저 만든다. (Auto Confirm User 체크)
--   2) 아래 'CHANGE_ME@example.com' 를 그 이메일로 바꾼 뒤,
--      SQL Editor 에 이 파일 내용을 붙여넣고 실행한다.
--
-- 결과: 해당 사용자의 역할이 'admin' 으로 바뀐다. (여러 번 실행해도 안전)
-- =============================================================================

do $$
declare
  v_count int;
begin
  update public.profiles
  set role = 'admin'
  where id in (
    select id from auth.users where email = 'CHANGE_ME@example.com'
  );
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice '⚠️ 일치하는 사용자가 없습니다. 먼저 Authentication에서 그 이메일로 계정을 만들었는지, 이메일 오타가 없는지 확인하세요.';
  else
    raise notice '✅ %명을 관리자로 지정했습니다.', v_count;
  end if;
end $$;

-- 확인용: 관리자 목록 출력
select p.id, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';


-- -----------------------------------------------------------------------------
-- (대안) 대시보드 UI 없이 SQL 만으로 관리자 계정을 통째로 만들고 싶을 때.
-- 아래 블록의 주석을 풀고 이메일/비밀번호/이름을 바꿔 실행하세요.
-- handle_new_user 트리거가 profiles 를 자동 생성합니다.
-- -----------------------------------------------------------------------------
-- do $$
-- declare
--   v_email text := 'CHANGE_ME@example.com';
--   v_pass  text := 'CHANGE_ME_password';
--   v_name  text := '관리자';
--   uid uuid := gen_random_uuid();
-- begin
--   if exists (select 1 from auth.users where email = v_email) then
--     raise notice '이미 존재하는 이메일입니다. 위쪽 update 문으로 role 만 바꾸세요.';
--     return;
--   end if;
--   insert into auth.users (
--     instance_id, id, aud, role, email, encrypted_password,
--     email_confirmed_at, created_at, updated_at,
--     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
--   ) values (
--     '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
--     v_email, crypt(v_pass, gen_salt('bf')), now(), now(), now(),
--     '{"provider":"email","providers":["email"]}'::jsonb,
--     jsonb_build_object('full_name', v_name, 'display_name', v_name, 'role', 'admin'),
--     false, false
--   );
--   insert into auth.identities (
--     id, user_id, identity_data, provider, provider_id,
--     last_sign_in_at, created_at, updated_at
--   ) values (
--     gen_random_uuid(), uid,
--     jsonb_build_object('sub', uid::text, 'email', v_email),
--     'email', uid::text, now(), now(), now()
--   );
-- end $$;
