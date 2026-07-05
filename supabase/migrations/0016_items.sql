-- =============================================================================
-- 아이템(도구): 몬스터볼·상처약 상점 판매 + 배틀 중 사용.
--   * 야생 포획 방식 변경: 쓰러뜨리면 보상만, 잡으려면 배틀 중 볼 투척(HP 낮을수록 확률↑).
--     보스는 기존대로 클리어 시 자동 포획.
--   * 도망치기 지원: battles.status 에 'fled' 추가.
-- 이름·설명은 어나더레드(items.dat + messages_kor_core.dat) 원문, 가격·효과는 코인 경제에
-- 맞게 튜닝(관리자가 items 테이블에서 수정 가능).
-- =============================================================================

-- 도구 카탈로그
create table public.items (
  item_key      text primary key,
  name_ko       text not null,
  description   text not null default '',
  kind          text not null check (kind in ('ball','potion')),
  price         int  not null check (price >= 0),
  effect        int  not null default 0,   -- ball = 기본 포획 확률(%), potion = 회복 HP
  display_order int  not null default 0,
  is_active     boolean not null default true
);

insert into public.items (item_key, name_ko, description, kind, price, effect, display_order) values
  ('POKEBALL',    '몬스터볼',   '야생 포켓몬에게 던져서 잡기 위한 볼. 캡슐식으로 되어 있다.',        'ball',   30, 40, 1),
  ('GREATBALL',   '수퍼볼',     '몬스터볼보다 포켓몬이 더 잘 잡히는 성능이 좋은 볼.',                 'ball',   60, 60, 2),
  ('POTION',      '상처약',     '스프레이식의 상처약. 포켓몬 1마리의 HP를 20만큼 회복한다.',          'potion', 20, 20, 3),
  ('SUPERPOTION', '좋은상처약', '스프레이식의 상처약. 포켓몬 1마리의 HP를 50만큼 회복한다.',          'potion', 50, 50, 4);

-- 학생 인벤토리 (수량)
create table public.student_items (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_key   text not null references public.items(item_key) on delete cascade,
  qty        int  not null default 0 check (qty >= 0),
  unique (student_id, item_key)
);
create index idx_student_items_student on public.student_items(student_id);

-- 도구 구매 (purchase_pokemon(0001) 미러 — FOR UPDATE 잠금 + coin_events 원장)
create or replace function public.purchase_item(p_item_key text, p_qty int default 1)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_item     public.items;
  v_balance  int;
  v_total    int;
  v_purchase uuid := gen_random_uuid();
  v_qty      int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_qty < 1 or p_qty > 99 then raise exception 'invalid quantity'; end if;

  select * into v_item from public.items where item_key = p_item_key and is_active;
  if v_item.item_key is null then raise exception 'item not available'; end if;
  v_total := v_item.price * p_qty;

  -- 행 잠금으로 동시 구입 이중 차감 방지
  select coin_balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < v_total then raise exception 'insufficient coins'; end if;

  insert into public.coin_events (student_id, source_type, source_id, coin_delta)
  values (v_uid, 'purchase', v_purchase, -v_total);

  update public.profiles set coin_balance = coin_balance - v_total where id = v_uid;

  insert into public.student_items (student_id, item_key, qty)
  values (v_uid, p_item_key, p_qty)
  on conflict (student_id, item_key) do update set qty = public.student_items.qty + p_qty
  returning qty into v_qty;

  return v_qty;
end;
$$;

-- 배틀 중 도구 1개 소모 (원자적 차감 — 서버 액션이 service-role 로 호출)
create or replace function public.consume_item(p_student uuid, p_item_key text)
returns int language plpgsql security definer set search_path = public as $$
declare v_qty int;
begin
  update public.student_items set qty = qty - 1
    where student_id = p_student and item_key = p_item_key and qty >= 1
    returning qty into v_qty;
  if v_qty is null then return -1; end if;   -- 보유 없음
  return v_qty;
end;
$$;

-- 도망치기: battles.status 에 'fled' 추가
alter table public.battles drop constraint if exists battles_status_check;
alter table public.battles add constraint battles_status_check
  check (status in ('ongoing','won','lost','fled'));

-- RLS
alter table public.items         enable row level security;
alter table public.student_items enable row level security;

-- 카탈로그: 인증 읽기 / admin 쓰기 (0001 species 패턴 + 0015 initplan 래핑)
create policy "items read" on public.items for select
  using ((select auth.uid()) is not null);
create policy "items admin write" on public.items for all
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');

-- 인벤토리: 본인·admin 읽기만. 쓰기는 RPC(purchase_item/consume_item)만.
create policy "student_items read" on public.student_items for select
  using (student_id = (select auth.uid()) or (select auth_role()) = 'admin');
