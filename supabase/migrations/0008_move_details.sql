-- =============================================================================
-- 기술(moves)에 PP·설명 추가 — '내 포켓몬' 요약 화면에서 어나더레드처럼
-- 기술 정보를 보여주기 위함. (배틀 계산에는 영향 없음 / 표시용)
-- =============================================================================

alter table public.moves add column if not exists pp int not null default 0;
alter table public.moves add column if not exists description text not null default '';
