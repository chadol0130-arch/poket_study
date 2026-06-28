"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DailyMissions({
  currentStreak,
  longestStreak,
  checkedIn,
  submittedToday,
  answeredToday,
}: {
  currentStreak: number;
  longestStreak: number;
  checkedIn: boolean;
  submittedToday: boolean;
  answeredToday: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reward, setReward] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function checkin() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("daily_checkin");
      if (error) {
        setError("출석 실패: " + error.message);
        return;
      }
      if (data && !data.already) {
        setReward(`+${data.xp ?? 0} XP · +${data.coin ?? 0} 코인!`);
      }
      router.refresh();
    });
  }

  const missions = [
    { label: "출석 체크하기", done: checkedIn },
    { label: "오늘 숙제·기록 제출", done: submittedToday },
    { label: "질문에 답하기", done: answeredToday },
  ];
  const doneCount = missions.filter((m) => m.done).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">연속 출석</p>
          <p className="text-2xl font-black">
            <span className="text-orange-500">🔥 {currentStreak}일</span>
          </p>
          <p className="text-xs text-slate-400">최고 기록 {longestStreak}일</p>
        </div>
        {checkedIn ? (
          <span className="rounded-xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-600">
            오늘 출석 완료 ✓
          </span>
        ) : (
          <button
            onClick={checkin}
            disabled={pending}
            className="rounded-xl bg-orange-500 px-5 py-2.5 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {pending ? "체크 중..." : "오늘 출석 체크"}
          </button>
        )}
      </div>

      {reward && <p className="mt-2 text-sm font-semibold text-amber-600">{reward}</p>}
      {error && <p className="mt-2 text-sm text-poke-red">{error}</p>}

      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold text-slate-500">
          오늘의 미션 ({doneCount}/3)
        </p>
        <ul className="space-y-1">
          {missions.map((m) => (
            <li key={m.label} className="flex items-center gap-2 text-sm">
              <span className={m.done ? "text-green-500" : "text-slate-300"}>
                {m.done ? "✓" : "○"}
              </span>
              <span className={m.done ? "text-slate-400 line-through" : "text-slate-700"}>
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
