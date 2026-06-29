-- =============================================================================
-- 어나더레드급 배틀: 기술 효과 데이터(능력변화/상태이상/명중부가효과)를 위해
-- moves 에 function_code(효과 종류)·effect_chance(부가효과 확률%) 추가.
-- =============================================================================

alter table public.moves add column if not exists function_code text not null default 'None';
alter table public.moves add column if not exists effect_chance  int  not null default 0;
