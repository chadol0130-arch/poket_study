-- =============================================================================
-- 보안: 학생이 자기 profiles 행을 직접 수정해 role/coin_balance 를 바꾸는
-- 권한 상승을 차단. (화면엔 버튼 없지만 API 로는 가능했음)
--
-- 원리: PostgREST 일반 요청은 DB 롤이 'authenticated'/'anon'. 보상·구매 RPC 는
-- SECURITY DEFINER(소유자=postgres)라 current_user 가 'authenticated' 가 아니고,
-- 서비스롤/관리자도 예외. 따라서 "current_user 가 authenticated/anon 이고 관리자가
-- 아닌" 직접 수정에서만 민감 컬럼(role, coin_balance)을 이전 값으로 되돌린다.
-- (display_name 등 일반 컬럼 수정은 그대로 허용)
-- =============================================================================

create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and coalesce(auth_role(), '') <> 'admin' then
    new.role := old.role;
    new.coin_balance := old.coin_balance;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile_columns();
