"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "idea", label: "💡 건의·아이디어" },
  { value: "bug", label: "🐞 오류·버그" },
  { value: "question", label: "❓ 질문" },
  { value: "etc", label: "✏️ 기타" },
];

export function FeedbackForm() {
  const router = useRouter();
  const supabase = createClient();
  const [category, setCategory] = useState("idea");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const { data, error } = await supabase.rpc("submit_feedback", {
        p_category: category,
        p_body: body,
      });
      if (error) {
        const m = error.message ?? "";
        if (/does not exist|schema cache|submit_feedback/i.test(m)) {
          setErr("문의 기능이 아직 적용되지 않았어요. (관리자: 마이그레이션 0014 실행 필요)");
        } else if (/only students/i.test(m)) {
          setErr("학생 계정만 문의를 남길 수 있어요.");
        } else if (/empty body/i.test(m)) {
          setErr("내용을 입력해주세요.");
        } else {
          setErr("제출 실패: " + m);
        }
        return;
      }
      const r = (data ?? {}) as { awarded?: boolean; xp?: number; coin?: number };
      setMsg(
        r.awarded
          ? `보내주셔서 고마워요! ⭐ 경험치 +${r.xp ?? 0} · 🪙 코인 +${r.coin ?? 0}`
          : "보내주셔서 고마워요! (오늘 보상은 이미 받았어요)",
      );
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">종류</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">내용</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="불편한 점, 있으면 좋겠는 기능, 궁금한 점을 자유롭게 적어주세요."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      <p className="text-xs text-amber-600">문의를 남기면 하루 1번 ⭐ 경험치 +15 · 🪙 코인 +5!</p>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-poke-red">{err}</p>}

      <button
        onClick={submit}
        disabled={pending || !body.trim()}
        className="w-full rounded-lg bg-poke-blue py-2.5 text-sm font-bold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        {pending ? "보내는 중..." : "문의 보내기"}
      </button>
    </div>
  );
}
