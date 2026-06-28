"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import Link from "next/link";
import { battleTurn } from "@/lib/actions/battle";

interface Mv {
  key: string;
  name_ko: string;
  type: string;
  power: number;
  category: number;
}
interface Side {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  types: string[];
  spriteUrl: string | null;
  moves: Mv[];
}
interface BState {
  student: Side;
  enemy: Side;
  log: string[];
  turn: number;
  catchable?: boolean;
}

function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, max)) * 100)));
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Sprite({ url, alt, flip }: { url: string | null; alt: string; flip?: boolean }) {
  if (!url)
    return <div className="flex h-28 w-28 items-center justify-center text-5xl">❓</div>;
  return (
    <img
      src={url}
      alt={alt}
      className="h-28 w-28 object-contain"
      style={{ imageRendering: "pixelated", transform: flip ? "scaleX(-1)" : undefined }}
    />
  );
}

export function BattleArena({
  battleId,
  initialState,
  initialStatus,
}: {
  battleId: string;
  initialState: BState;
  initialStatus: "ongoing" | "won" | "lost";
}) {
  const [state, setState] = useState<BState>(initialState);
  const [status, setStatus] = useState(initialStatus);
  const [caught, setCaught] = useState<string | null>(null);
  const [reward, setReward] = useState<{ xp: number; coin: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function useMove(key: string) {
    if (status !== "ongoing" || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await battleTurn(battleId, key);
      if (res.error) return setError(res.error);
      if (res.state) setState(res.state);
      if (res.status) setStatus(res.status);
      if (res.status === "won") {
        setReward({ xp: res.rewardXp ?? 0, coin: res.rewardCoin ?? 0 });
        setCaught(res.caughtName ?? null);
      }
    });
  }

  const { student, enemy } = state;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* 적 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50 to-white p-4">
        <div className="mb-1 flex items-center justify-between text-sm font-semibold">
          <span>
            {enemy.name} <span className="text-slate-400">Lv{enemy.level}</span>
          </span>
          <span className="text-xs text-slate-400">{enemy.types.join("·")}</span>
        </div>
        <HpBar hp={enemy.hp} max={enemy.maxHp} />
        <div className="mt-2 flex justify-end">
          <Sprite url={enemy.spriteUrl} alt={enemy.name} />
        </div>
      </div>

      {/* 나 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-amber-50 to-white p-4">
        <div className="flex justify-start">
          <Sprite url={student.spriteUrl} alt={student.name} flip />
        </div>
        <div className="mb-1 mt-2 flex items-center justify-between text-sm font-semibold">
          <span>
            {student.name} <span className="text-slate-400">Lv{student.level}</span>
          </span>
          <span className="text-xs text-slate-400">
            {student.hp}/{student.maxHp}
          </span>
        </div>
        <HpBar hp={student.hp} max={student.maxHp} />
      </div>

      {/* 로그 */}
      <div className="h-24 overflow-y-auto rounded-xl bg-slate-900 p-3 text-sm text-slate-100">
        {state.log.slice(-6).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>

      {error && <p className="text-sm text-poke-red">{error}</p>}

      {/* 결과 또는 기술 */}
      {status === "ongoing" ? (
        <div className="grid grid-cols-2 gap-2">
          {student.moves.map((m) => (
            <button
              key={m.key}
              onClick={() => useMove(m.key)}
              disabled={pending}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-left text-sm font-semibold hover:border-poke-red disabled:opacity-50"
            >
              {m.name_ko}
              <span className="ml-1 text-xs font-normal text-slate-400">
                {m.type} · {m.power}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          {status === "won" ? (
            <>
              <p className="text-2xl font-black text-green-600">승리! 🎉</p>
              {reward && (
                <p className="mt-1 text-sm text-amber-600">
                  +{reward.xp} XP · +{reward.coin} 코인
                </p>
              )}
              {caught && (
                <p className="mt-1 font-semibold text-poke-blue">
                  {caught}을(를) 잡았다! 도감에 추가됨 ✨
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-slate-500">졌다…</p>
              <p className="mt-1 text-sm text-slate-500">
                더 공부해서 레벨을 올리면 새 기술로 이길 수 있어요!
              </p>
            </>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/calendar"
              className="rounded-lg bg-poke-blue px-4 py-2 text-sm font-semibold text-white"
            >
              캘린더로
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              홈으로
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
