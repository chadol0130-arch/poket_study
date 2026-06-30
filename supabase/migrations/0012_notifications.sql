-- =============================================================================
-- 인앱 알림: 검사 통과/반려, 새 질문 도착 등을 학생에게 알림(벨 배지).
-- 삽입은 트리거(SECURITY DEFINER)만 — 클라이언트 insert 정책 없음.
-- =============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text not null default '',
  href       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
create policy "notif read own"   on public.notifications for select
  using (user_id = auth.uid());
create policy "notif update own" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- insert 정책 없음 → 트리거(정의자 권한)로만 생성

-- 숙제 제출 검사 결과 알림
create or replace function public.notify_submission_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    select title into v_title from public.homework_assignments where id = new.assignment_id;
    insert into public.notifications (user_id, kind, title, body, href)
    values (
      new.student_id,
      new.status,
      case when new.status = 'approved' then '숙제 통과! 🎉' else '숙제가 반려됐어요' end,
      case when new.status = 'approved'
           then coalesce(v_title, '숙제') || ' 검사를 통과했어요. 포켓몬이 자랐어요!'
           else coalesce(nullif(new.reject_reason, ''), '사유를 확인하고 다시 제출해요.') end,
      '/homework/status'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_submission on public.submissions;
create trigger trg_notify_submission after update on public.submissions
  for each row execute function public.notify_submission_review();

-- 일일 학습기록 검사 결과 알림
create or replace function public.notify_daily_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, kind, title, body, href)
    values (
      new.student_id,
      new.status,
      case when new.status = 'approved' then '학습기록 통과! 🎉' else '학습기록이 반려됐어요' end,
      case when new.status = 'approved'
           then new.log_date || ' 학습기록을 통과했어요. 포켓몬이 자랐어요!'
           else coalesce(nullif(new.reject_reason, ''), '사유를 확인하고 다시 제출해요.') end,
      '/homework/status'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_daily on public.daily_logs;
create trigger trg_notify_daily after update on public.daily_logs
  for each row execute function public.notify_daily_review();

-- 새 질문 도착 알림
create or replace function public.notify_new_question()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, href)
  values (
    new.student_id,
    'question',
    '포켓몬이 궁금해해요! ❗',
    '새 질문이 도착했어요. 답하고 경험치를 받아요!',
    '/dashboard'
  );
  return new;
end;
$$;
drop trigger if exists trg_notify_question on public.question_targets;
create trigger trg_notify_question after insert on public.question_targets
  for each row execute function public.notify_new_question();
