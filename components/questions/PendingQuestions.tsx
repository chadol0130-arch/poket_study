"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PokemonCard, type PokemonCardData } from "@/components/pokemon/PokemonCard";

interface PendingQ {
  id: string;
  body: string;
  kind: "open" | "choice";
  options: string[];
  xp_reward: number;
}

export function PendingQuestions({
  studentId,
  card,
  initialPending,
}: {
  studentId: string;
  card: PokemonCardData;
  initialPending: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<PendingQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [count, setCount] = useState(initialPending);

  async function loadAndOpen() {
    if (count === 0) return;
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    // 1) 내가 대상인 질문 id 목록  2) 내 답변 목록 (중첩 임베드 대신 명시적 2단계 — 견고)
    const [tRes, aRes] = await Promise.all([
      supabase.from("question_targets").select("question_id").eq("student_id", studentId),
      supabase.from("question_answers").select("question_id").eq("student_id", studentId),
    ]);
    if (tRes.error || aRes.error) {
      setLoadError("질문을 불러오지 못했어요: " + (tRes.error?.message ?? aRes.error?.message));
      setLoading(false);
      return;
    }
    const targetIds = (tRes.data ?? []).map((t: any) => t.question_id);
    if (targetIds.length === 0) {
      setQuestions([]);
      setCount(0);
      setLoading(false);
      return;
    }
    // 3) 질문 본문 조회 (활성만)
    const { data: qs, error: qErr } = await supabase
      .from("questions")
      .select("id, body, kind, options, xp_reward, is_active")
      .in("id", targetIds)
      .eq("is_active", true);
    if (qErr) {
      setLoadError("질문을 불러오지 못했어요: " + qErr.message);
      setLoading(false);
      return;
    }
    const answeredSet = new Set((aRes.data ?? []).map((a: any) => a.question_id));
    const pending: PendingQ[] = (qs ?? [])
      .filter((q: any) => !answeredSet.has(q.id))
      .map((q: any) => ({
        id: q.id,
        body: q.body,
        kind: q.kind,
        options: q.options ?? [],
        xp_reward: q.xp_reward,
      }));
    setQuestions(pending);
    setCount(pending.length);
    setLoading(false);
  }

  function onAnswered(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
    setCount((c) => Math.max(0, c - 1));
    router.refresh(); // 경험치/레벨 반영
  }

  return (
    <>
      <div className="relative inline-block w-full">
        <button
          onClick={loadAndOpen}
          className={`block w-full text-left ${count > 0 ? "cursor-pointer" : "cursor-default"}`}
        >
          <PokemonCard data={card} />
        </button>
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-poke-red text-lg font-black text-white shadow-lg ring-2 ring-white">
            !
          </span>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">포켓몬이 궁금해해요! ❗</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400">
                ✕
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-slate-400">불러오는 중...</p>
            ) : loadError ? (
              <p className="rounded-lg bg-poke-red/5 p-4 text-center text-sm text-poke-red">
                {loadError}
              </p>
            ) : questions.length === 0 ? (
              <p className="py-8 text-center text-slate-400">새 질문이 없어요!</p>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => (
                  <QuestionForm key={q.id} q={q} onAnswered={() => onAnswered(q.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function QuestionForm({ q, onAnswered }: { q: PendingQ; onAnswered: () => void }) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const p_answer = q.kind === "choice" ? (q.options[choice ?? -1] ?? "") : text;
      const { error } = await supabase.rpc("answer_question", {
        p_question_id: q.id,
        p_answer,
        p_choice_index: q.kind === "choice" ? choice : null,
      });
      if (error) {
        const m = error.message ?? "";
        if (/does not exist|schema cache|function .*answer_question/i.test(m)) {
          setError("질문 기능 설정이 아직 적용되지 않았어요. (관리자: 마이그레이션 0005 실행 필요)");
        } else if (/not a target/i.test(m)) {
          setError("이 질문의 대상이 아니에요.");
        } else {
          setError("제출 실패: " + m);
        }
        return;
      }
      onAnswered();
    });
  }

  const canSubmit = q.kind === "choice" ? choice !== null : text.trim().length > 0;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="font-medium">{q.body}</p>
      <p className="mb-2 text-xs text-amber-600">답하면 ⭐ {q.xp_reward} 경험치!</p>

      {q.kind === "choice" ? (
        <div className="space-y-1">
          {q.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={choice === i}
                onChange={() => setChoice(i)}
              />
              {opt}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="자유롭게 답해주세요"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      )}

      {error && <p className="mt-1 text-xs text-poke-red">{error}</p>}

      <button
        onClick={submit}
        disabled={pending || !canSubmit}
        className="mt-2 w-full rounded-lg bg-poke-red py-2 text-sm font-bold text-white hover:bg-poke-red/90 disabled:opacity-50"
      >
        {pending ? "제출 중..." : "답변하고 경험치 받기"}
      </button>
    </div>
  );
}
