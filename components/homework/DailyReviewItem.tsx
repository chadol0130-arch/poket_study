"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDailyLog, rejectDailyLog } from "@/lib/actions/daily";

export interface DailyItemData {
  logId: string;
  studentName: string;
  date: string;
  goal: string;
  photoUrls: string[];
}

export function DailyReviewItem({ item }: { item: DailyItemData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveDailyLog(item.logId);
      if ("error" in res) return setError(res.error);
      router.refresh();
    });
  }
  function reject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectDailyLog(item.logId, reason);
      if ("error" in res) return setError(res.error);
      setRejecting(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{item.studentName}</p>
          <p className="text-sm text-slate-500">📅 {item.date}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">보상: ⭐ 50 XP · 🪙 10</p>
        </div>
      </div>

      {item.goal && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
          🎯 {item.goal}
        </p>
      )}

      {item.photoUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.photoUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={`사진 ${i + 1}`}
                className="h-28 w-28 rounded-lg border border-slate-200 object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-poke-red">{error}</p>}

      {!rejecting ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={approve}
            disabled={pending}
            className="flex-1 rounded-lg bg-green-600 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {pending ? "처리 중..." : "✅ 통과 (성장!)"}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={pending}
            className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200"
          >
            반려
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유 (학생에게 표시)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={reject}
              disabled={pending}
              className="flex-1 rounded-lg bg-poke-red py-2 font-semibold text-white hover:bg-poke-red/90 disabled:opacity-50"
            >
              반려 확정
            </button>
            <button
              onClick={() => setRejecting(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
