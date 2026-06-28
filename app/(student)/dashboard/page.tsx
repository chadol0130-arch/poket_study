import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { PendingQuestions } from "@/components/questions/PendingQuestions";
import { CoinBalance } from "@/components/ui/CoinBalance";

export default async function DashboardPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: pets } = await supabase
    .from("student_pokemon")
    .select("*")
    .eq("student_id", profile.id);

  // 포켓몬이 없으면 스타터 선택으로.
  if (!pets || pets.length === 0) redirect("/onboarding");

  const active = pets.find((p: any) => p.is_active) ?? pets[0];
  const info = await getSpeciesInfo(pets.map((p: any) => p.current_species_id));
  const activeInfo = info.get(active.current_species_id);

  // 미답변 질문 수 (활성 포켓몬에 ! 표시)
  const { data: qTargets } = await supabase
    .from("question_targets")
    .select("question_id, questions(is_active)")
    .eq("student_id", profile.id);
  const { data: qAnswers } = await supabase
    .from("question_answers")
    .select("question_id")
    .eq("student_id", profile.id);
  const answeredSet = new Set((qAnswers ?? []).map((a: any) => a.question_id));
  const pendingQuestions = (qTargets ?? []).filter((t: any) => {
    const q = Array.isArray(t.questions) ? t.questions[0] : t.questions;
    return q?.is_active && !answeredSet.has(t.question_id);
  }).length;

  // 검사 대기/제출 가능 숙제 수.
  const { data: assignments } = await supabase
    .from("homework_assignments")
    .select("id");
  const { data: subs } = await supabase
    .from("submissions")
    .select("assignment_id, status")
    .eq("student_id", profile.id);
  const subByAssignment = new Map<string, string>(
    (subs ?? []).map((s: any) => [s.assignment_id, s.status]),
  );
  const todo = (assignments ?? []).filter(
    (a: any) => subByAssignment.get(a.id) !== "approved",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">안녕, {profile.display_name}!</h1>
          <p className="text-slate-500">오늘도 숙제하고 포켓몬을 키워보자 🐾</p>
        </div>
        <CoinBalance amount={profile.coin_balance} />
      </div>

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
            href="/assignments"
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-poke-blue"
          >
            <p className="text-3xl">📒</p>
            <p className="mt-2 font-semibold">숙제 제출하기</p>
            <p className="text-sm text-slate-500">
              해야 할 숙제 <b className="text-poke-red">{todo}</b>개
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
