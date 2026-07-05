-- =============================================================================
-- 중복 보유 방지: 같은 진화라인(chain)의 포켓몬은 상점에서 다시 살 수 없다.
-- (야생 중복 포획 방지는 앱 서버 로직에서 처리 — 야생 출현 자체가 미보유 라인으로 제한됨)
-- purchase_pokemon(0001) 재정의: 잔액 검사 앞에 보유 라인 검사 추가. 나머지 동일.
-- =============================================================================

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

  -- 중복 보유 방지: 같은 진화라인 보유 시 구매 불가
  if exists (
    select 1 from public.student_pokemon
    where student_id = v_uid and chain_id = v_listing.chain_id
  ) then
    raise exception 'already owned';
  end if;

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
