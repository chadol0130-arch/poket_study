-- 스프라이트에 'icon'(64x64 아이콘) 변종을 허용한다.
-- 기존 카탈로그는 정면(default) 스프라이트만 썼으나, 아이콘도 함께 저장하기 위함.

alter table public.sprites drop constraint if exists sprites_variant_check;
alter table public.sprites
  add constraint sprites_variant_check
  check (variant in ('default', 'shiny', 'back', 'front', 'icon'));
