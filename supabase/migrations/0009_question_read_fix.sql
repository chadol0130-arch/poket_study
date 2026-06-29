-- =============================================================================
-- 버그픽스: 학생이 자기 질문(questions)을 못 읽어 "!" 가 안 뜨는 문제.
-- 원인: questions SELECT RLS 가 학생 읽기를 막음(정책 누락/엣지케이스).
-- 해결: 읽기를 RLS 의존에서 빼고, answer_question 과 동일한 SECURITY DEFINER
--       함수(my_pending_questions)로 학생 본인의 '활성·미답변' 질문만 안전 반환.
-- (질문 보내기/답변/관리자 조회는 그대로 — 학생 읽기 경로만 견고화)
-- =============================================================================

-- 1) 학생 본인의 미답변(활성) 질문 목록 — auth.uid() 로 스코프, RLS 우회(정의자 권한)
create or replace function public.my_pending_questions()
returns table (
  id        uuid,
  body      text,
  kind      text,
  options   text[],
  xp_reward int
)
language sql
security definer
set search_path = public
as $$
  select q.id, q.body, q.kind, q.options, q.xp_reward
  from public.question_targets t
  join public.questions q on q.id = t.question_id
  where t.student_id = auth.uid()
    and q.is_active
    and not exists (
      select 1 from public.question_answers a
      where a.question_id = q.id and a.student_id = auth.uid()
    )
  order by q.created_at;
$$;

grant execute on function public.my_pending_questions() to authenticated;

-- 2) (보강) questions SELECT 정책 재생성 — 혹시 누락/손상됐을 경우 대비.
--    대상 학생 또는 admin 읽기. (앱은 위 함수를 쓰지만 정책도 정상화해 둠)
drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions for select
  using (
    auth_role() = 'admin'
    or exists (
      select 1 from public.question_targets t
      where t.question_id = id and t.student_id = auth.uid()
    )
  );
