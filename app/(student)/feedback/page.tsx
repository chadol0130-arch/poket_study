import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

const CATEGORY_KO: Record<string, string> = {
  bug: "🐞 오류·버그",
  idea: "💡 건의",
  question: "❓ 질문",
  etc: "✏️ 기타",
};
const STATUS_KO: Record<string, { label: string; cls: string }> = {
  open: { label: "접수됨", cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "확인 중", cls: "bg-amber-100 text-amber-700" },
  resolved: { label: "반영 완료", cls: "bg-green-100 text-green-700" },
  wontfix: { label: "보류", cls: "bg-slate-100 text-slate-500" },
};

export default async function FeedbackPage() {
  await requireRole("student", "admin");
  const supabase = await createClient();
  // 본인 문의 목록 — SECURITY DEFINER RPC(관리자 메모 제외).
  const { data } = await supabase.rpc("my_feedback");
  const rows = (data ?? []) as any[];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">문의·건의 💬</h1>
          <p className="text-slate-500">불편한 점·바라는 기능을 알려주세요. 서비스가 더 좋아져요!</p>
        </div>
        <Link href="/account" className="whitespace-nowrap text-sm text-poke-blue">
          ← 내 정보
        </Link>
      </div>

      <FeedbackForm />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">내가 보낸 문의</h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            아직 보낸 문의가 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const st = STATUS_KO[r.status] ?? STATUS_KO.open;
              return (
                <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      {CATEGORY_KO[r.category] ?? r.category}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
                  <time className="text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
