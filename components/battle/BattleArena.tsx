"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import Link from "next/link";
import { battleTurn } from "@/lib/actions/battle";
import { typeKo, categoryKo } from "@/lib/i18n";
import { STATUS_KO, type StatusKind } from "@/lib/battle/effects";

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
  status?: StatusKind | null;
  confuseTurns?: number;
}

const STATUS_STYLE: Record<string, string> = {
  poison: "bg-purple-500",
  badpoison: "bg-purple-700",
  burn: "bg-orange-500",
  paralyze: "bg-yellow-500",
  sleep: "bg-slate-500",
  freeze: "bg-cyan-500",
  confuse: "bg-pink-500",
};

function StatusBadge({ status, confused }: { status?: StatusKind | null; confused?: number }) {
  return (
    <span className="ml-1 inline-flex gap-1 align-middle">
      {status && (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${STATUS_STYLE[status]}`}>
          {STATUS_KO[status]}
        </span>
      )}
      {confused && confused > 0 && (
        <span className="rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-bold text-white">혼란</span>
      )}
    </span>
  );
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
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Sprite({
  url,
  alt,
  flip,
  anim,
  animKey,
  idle,
}: {
  url: string | null;
  alt: string;
  flip?: boolean;
  anim: string;
  animKey: number;
  idle: boolean;
}) {
  const cls = anim || (idle ? "poke-idle" : "");
  if (!url)
    return <div className="flex h-28 w-28 items-center justify-center text-5xl">❓</div>;
  return (
    <div key={animKey} className={cls}>
      <img
        src={url}
        alt={alt}
        className="h-28 w-28 object-contain"
        style={{ imageRendering: "pixelated", transform: flip ? "scaleX(-1)" : undefined }}
      />
    </div>
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

  // 애니메이션 상태
  const [eAnim, setEAnim] = useState("");
  const [sAnim, setSAnim] = useState("");
  const [eKey, setEKey] = useState(0);
  const [sKey, setSKey] = useState(0);
  const [ePop, setEPop] = useState<number | null>(null);
  const [sPop, setSPop] = useState<number | null>(null);
  const [popKey, setPopKey] = useState(0);
  const [flash, setFlash] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  function playE(cls: string, dur: number) {
    setEAnim(cls);
    setEKey((k) => k + 1);
    if (cls !== "faint") window.setTimeout(() => setEAnim(""), dur);
  }
  function playS(cls: string, dur: number) {
    setSAnim(cls);
    setSKey((k) => k + 1);
    if (cls !== "faint") window.setTimeout(() => setSAnim(""), dur);
  }
  function doFlash() {
    setFlash(true);
    setFlashKey((k) => k + 1);
    window.setTimeout(() => setFlash(false), 360);
  }

  function animate(eDmg: number, sDmg: number, ns: BState, st: "ongoing" | "won" | "lost") {
    const superEff = (ns.log ?? []).slice(-2).some((l) => l.includes("굉장"));
    // 1타: 내 공격
    playS("lunge-up", 360);
    if (eDmg > 0) {
      window.setTimeout(() => {
        setEPop(eDmg);
        setPopKey((k) => k + 1);
        playE("hit-shake", 400);
        if (superEff) doFlash();
      }, 140);
    }
    // 2타: 적 반격
    if (sDmg > 0) {
      window.setTimeout(() => {
        playE("lunge-down", 360);
        window.setTimeout(() => {
          setSPop(sDmg);
          setPopKey((k) => k + 1);
          playS("hit-shake", 400);
        }, 140);
      }, 540);
    }
    // 기절
    if (st === "won") window.setTimeout(() => playE("faint", 700), eDmg > 0 ? 600 : 200);
    if (st === "lost") window.setTimeout(() => playS("faint", 700), 1000);
  }

  function useMove(key: string) {
    if (status !== "ongoing" || pending) return;
    setError(null);
    const prevE = state.enemy.hp;
    const prevS = state.student.hp;
    startTransition(async () => {
      const res = await battleTurn(battleId, key);
      if (res.error) return setError(res.error);
      const ns = res.state as BState;
      if (ns) {
        setState(ns);
        animate(prevE - ns.enemy.hp, prevS - ns.student.hp, ns, (res.status ?? "ongoing") as any);
      }
      if (res.status) setStatus(res.status);
      if (res.status === "won") {
        setReward({ xp: res.rewardXp ?? 0, coin: res.rewardCoin ?? 0 });
        setCaught(res.caughtName ?? null);
      }
    });
  }

  const { student, enemy } = state;

  return (
    <div className="relative mx-auto max-w-lg space-y-4">
      {/* 화면 플래시 */}
      {flash && (
        <div key={flashKey} className="screen-flash pointer-events-none fixed inset-0 z-50 bg-white" />
      )}

      {/* 적 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50 to-white p-4">
        <div className="mb-1 flex items-center justify-between text-sm font-semibold">
          <span>
            {enemy.name} <span className="text-slate-400">Lv{enemy.level}</span>
            <StatusBadge status={enemy.status} confused={enemy.confuseTurns} />
          </span>
          <span className="text-xs text-slate-400">{enemy.types.map(typeKo).join("·")}</span>
        </div>
        <HpBar hp={enemy.hp} max={enemy.maxHp} />
        <div className="relative mt-2 flex justify-end">
          {ePop !== null && (
            <span key={`ep${popKey}`} className="dmg-pop absolute right-10 top-0 z-10 text-lg font-black text-red-500">
              -{ePop}
            </span>
          )}
          <Sprite url={enemy.spriteUrl} alt={enemy.name} anim={eAnim} animKey={eKey} idle={status === "ongoing"} />
        </div>
      </div>

      {/* 나 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-amber-50 to-white p-4">
        <div className="relative flex justify-start">
          {sPop !== null && (
            <span key={`sp${popKey}`} className="dmg-pop absolute left-10 top-0 z-10 text-lg font-black text-red-500">
              -{sPop}
            </span>
          )}
          <Sprite url={student.spriteUrl} alt={student.name} flip anim={sAnim} animKey={sKey} idle={status === "ongoing"} />
        </div>
        <div className="mb-1 mt-2 flex items-center justify-between text-sm font-semibold">
          <span>
            {student.name} <span className="text-slate-400">Lv{student.level}</span>
            <StatusBadge status={student.status} confused={student.confuseTurns} />
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
                {typeKo(m.type)} · {m.power > 0 ? m.power : categoryKo(m.category)}
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
                포켓몬은 곧 기운을 차려요. 더 공부해서 레벨을 올리면 새 기술로 이길 수 있어요!
              </p>
            </>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/battles"
              className="rounded-lg bg-poke-red px-4 py-2 text-sm font-semibold text-white"
            >
              배틀로 돌아가기
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
