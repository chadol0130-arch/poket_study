"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** 달성한 도전과제 티어의 보상 수령 버튼. */
export function AchievementClaim({
  track,
  goal,
  coin,
  unit,
}: {
  track: string;
  goal: number;
  coin: number;
  unit: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function claim() {
    setErr(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_achievement", {
        p_track: track,
        p_goal: goal,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      if (data?.error) {
        setErr(data.error);
        return;
      }
      if (data && !data.already) setMsg(`+${data.coin} 코인! 🎉`);
      router.refresh();
    });
  }

  if (msg) return <span className="text-xs font-bold text-amber-600">{msg}</span>;

  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={claim}
        disabled={pending}
        className="animate-pulse rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-500 disabled:opacity-50"
      >
        {pending ? "..." : `${goal}${unit} 달성 · +${coin}🪙 받기`}
      </button>
      {err && <span className="mt-0.5 text-[10px] text-poke-red">{err}</span>}
    </span>
  );
}
