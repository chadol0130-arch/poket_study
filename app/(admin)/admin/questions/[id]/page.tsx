import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("admin");
  const supabase = await createClient();

  const { data: q } = await supabase
    .from("questions")
    .select("id, body, kind, options, xp_reward, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!q) notFound();

  const [{ data: answers }, { data: targets }] = await Promise.all([
    supabase
      .from("question_answers")
      .select("student_id, answer_text, choice_index, answered_at")
      .eq("question_id", id)
      .order("answered_at", { ascending: false }),
    supabase.from("question_targets").select("student_id").eq("question_id", id),
  ]);

  // 학생 이름
  const ids = Array.from(
    new Set([
      ...(answers ?? []).map((a: any) => a.student_id),
      ...(targets ?? []).map((t: any) => t.student_id),
    ]),
  );
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    (profiles ?? []).forEach((p: any) => nameById.set(p.id, p.display_name));
  }

  // 객관식이면 선택지별 집계
  const isChoice = q.kind === "choice";
  const tally: number[] = isChoice ? (q.options as string[]).map(() => 0) : [];
  if (isChoice) {
    (answers ?? []).forEach((a: any) => {
      if (typeof a.choice_index === "number" && tally[a.choice_index] !== undefined) {
        tally[a.choice_index] += 1;
      }
    });
  }

  const answered = (answers ?? []).length;
  const total = (targets ?? []).length;

  return (
    <div className="space-y-5">
      <Link href="/admin/questions" className="text-sm text-slate-500">
        ← 질문 목록
      </Link>

      <div>
        <h1 className="text-xl font-bold">{q.body}</h1>
        <p className="text-sm text-slate-500">
          {isChoice ? "객관식" : "주관식"} · ⭐ {q.xp_reward} · 답변 {answered}/{total}
        </p>
      </div>

      {isChoice && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-500">선택지별 응답</h2>
          {(q.options as string[]).map((opt, i) => {
            const c = tally[i] ?? 0;
            const pct = answered ? Math.round((c / answered) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex justify-between text-sm">
                  <span>{opt}</span>
                  <span className="text-slate-500">
                    {c}명 ({pct}%)
                  </span>
                </div>
                <div className="mt-0.5 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-poke-blue" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">학생 답변</h2>
        <ul className="space-y-2">
          {answered === 0 && (
            <li className="text-sm text-slate-400">아직 답변이 없어요.</li>
          )}
          {(answers ?? []).map((a: any, i: number) => (
            <li key={i} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{nameById.get(a.student_id) ?? "학생"}</span>
                <time className="text-xs text-slate-400">
                  {new Date(a.answered_at).toLocaleString("ko-KR")}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {isChoice
                  ? (q.options as string[])[a.choice_index] ?? a.answer_text
                  : a.answer_text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
