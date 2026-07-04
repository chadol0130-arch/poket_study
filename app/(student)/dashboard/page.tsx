import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { PendingQuestions } from "@/components/questions/PendingQuestions";
import { DailyMissions } from "@/components/engagement/DailyMissions";
import { CoinBalance } from "@/components/ui/CoinBalance";

export default async function DashboardPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  // 오늘의 미션/스트릭 상태 기준 (한국시간)
  const todayKST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const startKST = `${todayKST}T00:00:00+09:00`;

  // 서로 독립인 조회는 전부 한 번에 (순차 왕복 제거 — 원거리 DB에서 체감 큼)
  const [
    { data: pets },
    { data: pendingQs, error: pqErr },
    { data: assignments },
    { data: subs },
    { count: checkinCount },
    { count: subTodayCount },
    { count: dlTodayCount },
    { count: ansTodayCount },
  ] = await Promise.all([
    supabase.from("student_pokemon").select("*").eq("student_id", profile.id),
    // 미답변 질문 수 (활성 포켓몬에 ! 표시) — SECURITY DEFINER 함수로 견고하게 조회
    supabase.rpc("my_pending_questions"),
    // RLS 가 내 활성 반 과제로 제한. 최근 마감순 500개면 "할 일" 계산에 충분.
    supabase
      .from("homework_assignments")
      .select("id, due_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("submissions")
      .select("assignment_id, status")
      .eq("student_id", profile.id)
      .limit(1000),
    supabase
      .from("streak_checkins")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .eq("checkin_date", todayKST),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .gte("submitted_at", startKST),
    supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .eq("log_date", todayKST),
    supabase
      .from("question_answers")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .gte("answered_at", startKST),
  ]);

  // 포켓몬이 없으면 스타터 선택으로.
  if (!pets || pets.length === 0) redirect("/onboarding");

  const active = pets.find((p: any) => p.is_active) ?? pets[0];
  const info = await getSpeciesInfo(pets.map((p: any) => p.current_species_id));
  const activeInfo = info.get(active.current_species_id);

  if (pqErr) console.error("[dashboard] 미답변 질문 조회 실패:", pqErr.message);
  const pendingQuestions = (pendingQs ?? []).length;

  // 검사 대기/제출 가능 숙제 수 + 마감 임박.
  const subByAssignment = new Map<string, string>(
    (subs ?? []).map((s: any) => [s.assignment_id, s.status]),
  );
  const notDone = (assignments ?? []).filter(
    (a: any) => subByAssignment.get(a.id) !== "approved",
  );
  const todo = notDone.length;
  // 마감 3일 이내(미완료) 개수 — "오늘 할 일" 표시
  const nowMs = Date.now();
  const dueSoon = notDone.filter((a: any) => {
    if (!a.due_at) return false;
    const diff = (new Date(a.due_at).getTime() - nowMs) / 86400000;
    return diff >= -1 && diff <= 3;
  }).length;

  const checkedIn = (checkinCount ?? 0) > 0;
  const submittedToday = (subTodayCount ?? 0) + (dlTodayCount ?? 0) > 0;
  const answeredToday = (ansTodayCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">안녕, {profile.display_name}!</h1>
          <p className="text-slate-500">오늘도 숙제하고 포켓몬을 키워보자 🐾</p>
        </div>
        <CoinBalance amount={profile.coin_balance} />
      </div>

      <DailyMissions
        currentStreak={profile.current_streak ?? 0}
        longestStreak={profile.longest_streak ?? 0}
        checkedIn={checkedIn}
        submittedToday={submittedToday}
        answeredToday={answeredToday}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">내 대표 포켓몬</h2>
          <PendingQuestions
            studentId={profile.id}
            initialPending={pendingQuestions}
            card={{
              nameKo: activeInfo?.nameKo ?? "",
              name: activeInfo?.name ?? "",
              nickname: active.nickname,
              spriteUrl: activeInfo?.spriteUrl ?? null,
              xp: active.xp,
              isActive: true,
            }}
          />
        </div>

        <div className="space-y-3">
          <Link
            href="/homework"
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-poke-blue"
          >
            <p className="text-3xl">📒</p>
            <p className="mt-2 font-semibold">숙제 제출하기</p>
            <p className="text-sm text-slate-500">
              해야 할 숙제 <b className="text-poke-red">{todo}</b>개
              {dueSoon > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  마감 임박 {dueSoon}
                </span>
              )}
            </p>
          </Link>
          <Link
            href="/shop"
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-poke-blue"
          >
            <p className="text-3xl">🛒</p>
            <p className="mt-2 font-semibold">상점</p>
            <p className="text-sm text-slate-500">코인으로 새 포켓몬을 모아보세요</p>
          </Link>
        </div>
      </div>

      <Link href="/my-pokemon" className="inline-block text-sm font-medium text-poke-blue">
        내 포켓몬 전체 보기 ({pets.length}마리) →
      </Link>
    </div>
  );
}
