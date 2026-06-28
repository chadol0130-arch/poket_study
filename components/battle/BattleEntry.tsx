"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBossBattle, startWildBattle } from "@/lib/actions/battle";

export interface BossCard {
  encounterId: string;
  title: string;
  name: string;
  level: number;
  rewardXp: number;
  rewardCoin: number;
  won: boolean;
  spriteUrl: string | null;
}

function todayKST(): string {
  // Asia/Seoul 기준 오늘 날짜(YYYY-MM-DD)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA → YYYY-MM-DD
}

export function BattleEntry({ bosses }: { bosses: BossCard[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function goBoss(encounterId: string) {
    setError(null);
    startTransition(async () => {
      const res = await startBossBattle(encounterId);
      if ("error" in res) return setError(res.error);
      router.push(`/battle/${res.battleId}`);
    });
  }

  function goWild() {
    setError(null);
    startTransition(async () => {
      const res = await startWildBattle(todayKST());
      if ("error" in res) return setError(res.error);
      router.push(`/battle/${res.battleId}`);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-poke-red/30 bg-poke-red/5 p-3 text-center text-sm font-medium text-poke-red">
          {error}
        </div>
      )}

      {/* 야생 포켓몬 */}
      <section className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1 font-bold text-green-800">
              🌿 야생 포켓몬 만나기
            </h2>
            <p className="mt-0.5 text-sm text-green-700">
              풀숲에서 야생 포켓몬과 배틀해요. 이기면 경험치·코인·포획! (하루 1번)
            </p>
          </div>
          <button
            onClick={goWild}
            disabled={pending}
            className="shrink-0 rounded-xl bg-green-600 px-4 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {pending ? "..." : "만나기"}
          </button>
        </div>
      </section>

      {/* 보스 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1 font-bold">👑 시험 보스</h2>
        {bosses.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            아직 배치된 보스가 없어요. 선생님이 보스를 배치하면 여기에 나타나요!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bosses.map((b) => (
              <div
                key={b.encounterId}
                className={`flex items-center gap-3 rounded-2xl border p-4 ${
                  b.won ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  {b.spriteUrl ? (
                    <img src={b.spriteUrl} alt={b.name} className="h-14 w-14 object-contain" />
                  ) : (
                    <span className="text-2xl">👑</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {b.title || b.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {b.name} · Lv{b.level}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-600">
                    보상 ⭐{b.rewardXp} · 🪙{b.rewardCoin}
                  </p>
                </div>
                {b.won ? (
                  <span className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white">
                    클리어 ✅
                  </span>
                ) : (
                  <button
                    onClick={() => goBoss(b.encounterId)}
                    disabled={pending}
                    className="shrink-0 rounded-xl bg-poke-red px-4 py-2.5 font-bold text-white hover:bg-poke-red/90 disabled:opacity-50"
                  >
                    {pending ? "..." : "도전"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-slate-400">
        공부로 포켓몬을 키우면 기술이 해금되고 더 강해져서 보스를 이길 수 있어요!
      </p>
    </div>
  );
}
