"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState, useTransition } from "react";
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
  card,
  initialPending,
}: {
  studentId?: string; // (호환용, 더 이상 사용 안 함 — 학생은 auth.uid() 기준으로 조회)
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

  // 미답변(활성) 질문을 SECURITY DEFINER 함수로 조회 — 학생 읽기 RLS에 의존하지 않아 견고.
  // 반환: { list, error }
  const fetchPending = useCallback(async (): Promise<{ list: PendingQ[]; error: string | null }> => {
    const { data, error } = await supabase.rpc("my_pending_questions");
    if (error) {
      const m = error.message ?? "";
      if (/does not exist|schema cache|my_pending_questions/i.test(m)) {
        return { list: [], error: "질문 기능 업데이트가 아직 적용되지 않았어요. (관리자: 마이그레이션 0009 실행 필요)" };
      }
      return { list: [], error: "질문을 불러오지 못했어요: " + m };
    }
    const list: PendingQ[] = (data ?? []).map((q: any) => ({
      id: q.id,
      body: q.body,
      kind: q.kind,
      options: q.options ?? [],
      xp_reward: q.xp_reward,
    }));
    return { list, error: null };
  }, [supabase]);

  // 마운트 시 실제 DB 기준으로 미답변 수를 다시 계산 → 서버 렌더 값이 캐시/지연돼도 배지가 정확.
  useEffect(() => {
    let alive = true;
    fetchPending().then(({ list, error }) => {
      if (!alive || error) return;
      setCount(list.length);
    });
    return () => {
      alive = false;
    };
  }, [fetchPending]);

  async function loadAndOpen() {
    if (count === 0) return;
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    const { list, error } = await fetchPending();
    if (error) {
      setLoadError(error);
      setLoading(false);
      return;
    }
    setQuestions(list);
    setCount(list.length);
    setLoading(false);
  }

  function onAnswered(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
    setCount((c) => Math.max(0, c - 1));
    router.refresh(); // 경험치/레벨 반영
  }

  return (
    <>
      <div className="inline-block w-full">
        <button
          onClick={loadAndOpen}
          className={`block w-full text-left ${count > 0 ? "cursor-pointer" : "cursor-default"}`}
        >
          <PokemonCard
            data={card}
            topNotice={
              count > 0 ? (
                <img
                  src="/exclaim.png"
                  alt="새 질문!"
                  title="포켓몬이 궁금해해요! 눌러서 답해보세요"
                  className="h-9 w-9 animate-bounce drop-shadow-md"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : undefined
            }
          />
        </button>
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
