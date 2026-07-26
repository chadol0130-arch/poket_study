"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptFeedback, updateFeedbackStatus } from "@/lib/actions/feedback";
import type { FeedbackStatus } from "@/lib/types/db";

export interface FeedbackRow {
  id: string;
  student_id: string;
  student_name: string;
  category: string;
  body: string;
  status: FeedbackStatus;
  admin_note: string;
  xp_awarded: number;
  coin_awarded: number;
  created_at: string;
}

const CATEGORY_KO: Record<string, string> = {
  bug: "🐞 버그",
  idea: "💡 건의",
  question: "❓ 질문",
  etc: "✏️ 기타",
};
const STATUS_OPTS: { value: FeedbackStatus; label: string }[] = [
  { value: "open", label: "접수됨" },
  { value: "in_progress", label: "확인 중" },
  { value: "resolved", label: "반영 완료" },
  { value: "wontfix", label: "보류" },
];
const STATUS_CLS: Record<FeedbackStatus, string> = {
  open: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  wontfix: "bg-slate-100 text-slate-400",
  accepted: "bg-purple-100 text-purple-700",
};
const statusLabel = (s: FeedbackStatus) =>
  s === "accepted" ? "채택! 💡" : (STATUS_OPTS.find((o) => o.value === s)?.label ?? s);

export function FeedbackClient({ initial }: { initial: FeedbackRow[] }) {
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(
    () =>
      initial.filter(
        (r) => (cat === "all" || r.category === cat) && (status === "all" || r.status === status),
      ),
    [initial, cat, status],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">전체 종류</option>
          <option value="bug">🐞 버그</option>
          <option value="idea">💡 건의</option>
          <option value="question">❓ 질문</option>
          <option value="etc">✏️ 기타</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">전체 상태</option>
          {STATUS_OPTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value="accepted">채택! 💡</option>
        </select>
        <span className="ml-auto self-center text-xs text-slate-400">{rows.length}건</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          문의가 없어요.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <FeedbackItem key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedbackItem({ row }: { row: FeedbackRow }) {
  const router = useRouter();
  const [status, setStatus] = useState<FeedbackStatus>(row.status);
  const [note, setNote] = useState(row.admin_note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = status !== row.status || note !== (row.admin_note ?? "");

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await updateFeedbackStatus(row.id, status, note);
      if ("error" in res) return setErr(res.error);
      setMsg("저장했어요!");
      router.refresh();
    });
  }

  function accept() {
    if (!confirm(`이 건의를 채택할까요?\n${row.student_name} 학생에게 코인 100개와 알림이 갑니다.`))
      return;
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await acceptFeedback(row.id);
      if ("error" in res) return setErr(res.error);
      setMsg("채택했어요! 학생에게 보상과 알림이 갔어요. 💡");
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          {CATEGORY_KO[row.category] ?? row.category} · {row.student_name}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[row.status]}`}>
          {statusLabel(row.status)}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.body}</p>
      <time className="text-xs text-slate-400">
        {new Date(row.created_at).toLocaleString("ko-KR")}
      </time>

      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {row.status !== "accepted" && (
            <>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                onClick={save}
                disabled={pending || !dirty}
                className="rounded-lg bg-poke-blue px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={accept}
                disabled={pending}
                className="ml-auto rounded-lg bg-purple-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
              >
                💡 채택 (+100🪙 보상)
              </button>
            </>
          )}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="내부 메모(학생에게 안 보임)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
        />
        {msg && <p className="text-xs text-green-600">{msg}</p>}
        {err && <p className="text-xs text-poke-red">{err}</p>}
      </div>
    </li>
  );
}
