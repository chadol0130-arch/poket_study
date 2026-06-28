import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateQuestionForm, QuestionActiveToggle } from "@/components/admin/QuestionsClient";

export default async function AdminQuestionsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: classes }, { data: people }, { data: questions }, { data: targets }, { data: answers }] =
    await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("profiles").select("id, display_name, role"),
      supabase
        .from("questions")
        .select("id, body, kind, is_active, xp_reward, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("question_targets").select("question_id"),
      supabase.from("question_answers").select("question_id"),
    ]);

  const students = (people ?? [])
    .filter((p: any) => p.role === "student")
    .map((p: any) => ({ id: p.id, name: p.display_name }));
  const classOpts = (classes ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  const targetCount = new Map<string, number>();
  (targets ?? []).forEach((t: any) =>
    targetCount.set(t.question_id, (targetCount.get(t.question_id) ?? 0) + 1),
  );
  const answerCount = new Map<string, number>();
  (answers ?? []).forEach((a: any) =>
    answerCount.set(a.question_id, (answerCount.get(a.question_id) ?? 0) + 1),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">질문 보내기</h1>
        <p className="text-slate-500">
          학생 포켓몬에 ❗가 떠요. 답하면 즉시 경험치가 오르고, 답변은 여기 모입니다.
        </p>
      </div>

      <CreateQuestionForm classes={classOpts} students={students} />

      <div>
        <h2 className="mb-2 font-semibold">보낸 질문</h2>
        <ul className="space-y-2">
          {(questions ?? []).length === 0 && (
            <li className="text-sm text-slate-400">아직 보낸 질문이 없어요.</li>
          )}
          {(questions ?? []).map((q: any) => {
            const tc = targetCount.get(q.id) ?? 0;
            const ac = answerCount.get(q.id) ?? 0;
            return (
              <li
                key={q.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <Link href={`/admin/questions/${q.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{q.body}</p>
                  <p className="text-xs text-slate-500">
                    {q.kind === "choice" ? "객관식" : "주관식"} · ⭐ {q.xp_reward} · 답변{" "}
                    <b className="text-poke-blue">{ac}</b>/{tc}
                  </p>
                </Link>
                <QuestionActiveToggle questionId={q.id} isActive={q.is_active} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
