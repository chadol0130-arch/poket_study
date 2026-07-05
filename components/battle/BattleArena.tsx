"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import Link from "next/link";
import { battleTurn, useItem, fleeBattle } from "@/lib/actions/battle";
import { typeKo, categoryKo } from "@/lib/i18n";
import { STATUS_KO, type StatusKind } from "@/lib/battle/effects";

export interface InvItem {
  itemKey: string;
  nameKo: string;
  description: string;
  kind: "ball" | "potion";
  effect: number;
  qty: number;
}

function ItemIcon({ itemKey, kind }: { itemKey: string; kind: "ball" | "potion" }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="text-xl">{kind === "ball" ? "🔴" : "🧪"}</span>;
  return (
    <img
      src={`/items/${itemKey}.png`}
      alt=""
      className="h-7 w-7 object-contain"
      style={{ imageRendering: "pixelated" }}
      onError={() => setBroken(true)}
    />
  );
}

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
  kind = "wild",
  inventory = [],
}: {
  battleId: string;
  initialState: BState;
  initialStatus: "ongoing" | "won" | "lost" | "fled";
  kind?: "boss" | "wild";
  inventory?: InvItem[];
}) {
  const [state, setState] = useState<BState>(initialState);
  const [status, setStatus] = useState<"ongoing" | "won" | "lost" | "fled">(initialStatus);
  const [caught, setCaught] = useState<string | null>(null);
  const [reward, setReward] = useState<{ xp: number; coin: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [menu, setMenu] = useState<"root" | "fight" | "items">("root");
  const [inv, setInv] = useState<InvItem[]>(inventory);

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

  function doUseItem(itemKey: string) {
    if (status !== "ongoing" || pending) return;
    setError(null);
    const prevS = state.student.hp;
    startTransition(async () => {
      const res = await useItem(battleId, itemKey);
      if (res.error) return setError(res.error);
      if (typeof res.remainingQty === "number") {
        setInv((prev) =>
          prev.map((it) => (it.itemKey === itemKey ? { ...it, qty: res.remainingQty! } : it)),
        );
      }
      const ns = res.state as BState;
      if (ns) {
        setState(ns);
        // 아이템 사용 후 적 반격 데미지만 연출
        const sDmg = prevS > ns.student.hp ? prevS - ns.student.hp : 0;
        if (sDmg > 0) {
          playE("lunge-down", 360);
          window.setTimeout(() => {
            setSPop(sDmg);
            setPopKey((k) => k + 1);
            playS("hit-shake", 400);
          }, 140);
        }
        if (res.status === "won") playE("faint", 700);
        if (res.status === "lost") window.setTimeout(() => playS("faint", 700), 500);
      }
      if (res.status) setStatus(res.status);
      if (res.status === "won") {
        setReward({ xp: res.rewardXp ?? 0, coin: res.rewardCoin ?? 0 });
        setCaught(res.caughtName ?? null);
      }
      if (res.status === "ongoing") setMenu("root");
    });
  }

  function doFlee() {
    if (status !== "ongoing" || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fleeBattle(battleId);
      if (res.error) return setError(res.error);
      if (res.state) setState(res.state as BState);
      if (res.status) setStatus(res.status);
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

      {/* 결과 또는 행동 메뉴 */}
      {status === "ongoing" ? (
        menu === "root" ? (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setMenu("fight")}
              disabled={pending}
              className="rounded-xl border-2 border-poke-red bg-white px-3 py-4 text-center font-bold text-poke-red hover:bg-poke-red/5 disabled:opacity-50"
            >
              ⚔️<br />싸우기
            </button>
            <button
              onClick={() => setMenu("items")}
              disabled={pending}
              className="rounded-xl border-2 border-poke-blue bg-white px-3 py-4 text-center font-bold text-poke-blue hover:bg-poke-blue/5 disabled:opacity-50"
            >
              🎒<br />도구
            </button>
            <button
              onClick={doFlee}
              disabled={pending}
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-4 text-center font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              🏃<br />도망치기
            </button>
          </div>
        ) : menu === "fight" ? (
          <div className="space-y-2">
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
            <button
              onClick={() => setMenu("root")}
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              ← 뒤로
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {inv.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                가진 도구가 없어요.{" "}
                <Link href="/shop" className="font-semibold text-poke-blue">
                  상점에서 사보세요 →
                </Link>
              </p>
            ) : (
              inv.map((it) => {
                const ballBlocked = it.kind === "ball" && kind !== "wild";
                const disabled = pending || it.qty < 1 || ballBlocked;
                return (
                  <button
                    key={it.itemKey}
                    onClick={() => doUseItem(it.itemKey)}
                    disabled={disabled}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm hover:border-poke-blue disabled:opacity-40"
                  >
                    <ItemIcon itemKey={it.itemKey} kind={it.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{it.nameKo}</span>
                      <span className="ml-1 text-xs text-slate-400">
                        {ballBlocked
                          ? "야생 전용"
                          : it.kind === "ball"
                            ? "포획 시도 (HP가 낮을수록 잘 잡힘)"
                            : `HP +${it.effect}`}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-slate-500">×{it.qty}</span>
                  </button>
                );
              })
            )}
            <button
              onClick={() => setMenu("root")}
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              ← 뒤로
            </button>
          </div>
        )
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
              {caught ? (
                <p className="mt-1 font-semibold text-poke-blue">
                  {caught}을(를) 잡았다! 도감에 추가됨 ✨
                </p>
              ) : (
                kind === "wild" && (
                  <p className="mt-1 text-xs text-slate-400">
                    쓰러진 포켓몬은 잡을 수 없어요. 다음엔 몬스터볼로 잡아보자!
                  </p>
                )
              )}
            </>
          ) : status === "fled" ? (
            <>
              <p className="text-2xl font-black text-slate-500">무사히 도망쳤다! 🏃</p>
              <p className="mt-1 text-sm text-slate-500">
                다음에 다시 도전해요. 도구를 챙겨 오면 더 유리해요!
              </p>
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
