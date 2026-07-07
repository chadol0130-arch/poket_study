"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pvpTurn, pvpTimeoutTurn, forfeitPvp, type PvpTurnResult } from "@/lib/actions/pvp";
import { typeKo, categoryKo } from "@/lib/i18n";

type Role = "challenger" | "opponent";
const other = (r: Role): Role => (r === "challenger" ? "opponent" : "challenger");

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
interface PState {
  challenger: Side;
  opponent: Side;
  playerNames?: { challenger: string; opponent: string };
  log: string[];
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

export function PvpArena({
  battleId,
  myRole,
  initialState,
  initialStatus,
  initialTurn,
  initialTurnNo,
  initialUpdatedAt,
}: {
  battleId: string;
  myRole: Role;
  initialState: PState;
  initialStatus: string;
  initialTurn: string | null;
  initialTurnNo: number;
  initialUpdatedAt: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PState>(initialState);
  const [status, setStatus] = useState(initialStatus);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialTurn);
  const turnNoRef = useRef(initialTurnNo);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 상대 턴 경과 시간 (타임아웃 버튼 표시용)
  const [waitSec, setWaitSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(initialUpdatedAt).getTime()) / 1000)),
  );
  const lastChangeRef = useRef(new Date(initialUpdatedAt).getTime());

  function apply(res: {
    state?: any;
    status?: string;
    currentTurn?: string | null;
    turnNo?: number;
  }) {
    if (typeof res.turnNo === "number") {
      if (res.turnNo < turnNoRef.current) return; // 오래된 스냅샷 무시
      turnNoRef.current = res.turnNo;
    }
    if (res.state) setState(res.state as PState);
    if (res.status) setStatus(res.status);
    if (res.currentTurn !== undefined) setCurrentTurn(res.currentTurn);
    lastChangeRef.current = Date.now();
    setWaitSec(0);
    setError(null);
  }

  // 실시간 구독 (+4초 폴링 폴백 — Realtime 불가 환경에서도 동작)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pvp-${battleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pvp_battles", filter: `id=eq.${battleId}` },
        (payload: any) => {
          const n = payload.new;
          if (n)
            apply({
              state: n.state,
              status: n.status,
              currentTurn: n.current_turn,
              turnNo: n.turn_no,
            });
        },
      )
      .subscribe();

    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("pvp_battles")
        .select("state, status, current_turn, turn_no")
        .eq("id", battleId)
        .maybeSingle();
      if (data && (data.turn_no > turnNoRef.current || data.status !== "active")) {
        apply({
          state: data.state,
          status: data.status,
          currentTurn: data.current_turn,
          turnNo: data.turn_no,
        });
      }
    }, 4000);

    const tick = window.setInterval(() => {
      setWaitSec(Math.floor((Date.now() - lastChangeRef.current) / 1000));
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId]);

  function run(fn: () => Promise<PvpTurnResult>) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) return setError(res.error);
      apply(res);
      if (res.status && res.status !== "active") router.refresh();
    });
  }

  const me = state[myRole];
  const foe = state[other(myRole)];
  const names = state.playerNames ?? { challenger: "도전자", opponent: "친구" };
  const foeName = names[other(myRole)];
  const myTurn = status === "active" && currentTurn === myRole;
  const iWon =
    (status === "won_challenger" && myRole === "challenger") ||
    (status === "won_opponent" && myRole === "opponent");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* 상대 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="mb-1 flex items-center justify-between text-sm font-semibold">
          <span>
            {foe.name} <span className="text-slate-400">Lv{foe.level}</span>
            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {foeName}
            </span>
          </span>
          <span className="text-xs text-slate-400">{foe.types.map(typeKo).join("·")}</span>
        </div>
        <HpBar hp={foe.hp} max={foe.maxHp} />
        <div className="mt-2 flex justify-end">
          {foe.spriteUrl ? (
            <img
              src={foe.spriteUrl}
              alt={foe.name}
              className={`h-28 w-28 object-contain ${status === "active" ? "poke-idle" : ""}`}
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center text-5xl">❓</div>
          )}
        </div>
      </div>

      {/* 나 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-amber-50 to-white p-4">
        <div className="flex justify-start">
          {me.spriteUrl ? (
            <img
              src={me.spriteUrl}
              alt={me.name}
              className={`h-28 w-28 object-contain ${status === "active" ? "poke-idle" : ""}`}
              style={{ imageRendering: "pixelated", transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center text-5xl">❓</div>
          )}
        </div>
        <div className="mb-1 mt-2 flex items-center justify-between text-sm font-semibold">
          <span>
            {me.name} <span className="text-slate-400">Lv{me.level}</span>
            <span className="ml-1.5 rounded bg-poke-blue/10 px-1.5 py-0.5 text-[10px] font-bold text-poke-blue">
              나
            </span>
          </span>
          <span className="text-xs text-slate-400">
            {me.hp}/{me.maxHp}
          </span>
        </div>
        <HpBar hp={me.hp} max={me.maxHp} />
      </div>

      {/* 로그 */}
      <div className="h-24 overflow-y-auto rounded-xl bg-slate-900 p-3 text-sm text-slate-100">
        {(state.log ?? []).slice(-6).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>

      {error && <p className="text-sm text-poke-red">{error}</p>}

      {status === "active" ? (
        myTurn ? (
          <div className="space-y-2">
            <p className="text-center text-sm font-bold text-poke-red">내 차례! 기술을 고르세요</p>
            <div className="grid grid-cols-2 gap-2">
              {me.moves.map((m) => (
                <button
                  key={m.key}
                  onClick={() => run(() => pvpTurn(battleId, m.key))}
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
              onClick={() => {
                if (window.confirm("정말 기권할까요? 상대의 승리가 됩니다.")) {
                  run(() => forfeitPvp(battleId));
                }
              }}
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-50"
            >
              🏳️ 기권
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-sm font-semibold text-slate-500">
              ⏳ {foeName}이(가) 기술을 고르는 중… <span className="text-slate-400">({waitSec}초)</span>
            </p>
            {waitSec >= 60 ? (
              <button
                onClick={() => run(() => pvpTimeoutTurn(battleId))}
                disabled={pending}
                className="w-full rounded-lg bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                ⏰ 시간 초과 — 자동으로 진행하기
              </button>
            ) : (
              <p className="text-xs text-slate-400">
                60초가 지나면 자동 진행 버튼이 나타나요.
              </p>
            )}
            <button
              onClick={() => {
                if (window.confirm("정말 기권할까요? 상대의 승리가 됩니다.")) {
                  run(() => forfeitPvp(battleId));
                }
              }}
              disabled={pending}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              🏳️ 기권하기
            </button>
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          {iWon ? (
            <>
              <p className="text-2xl font-black text-green-600">승리! 🏆</p>
              <p className="mt-1 text-sm text-amber-600">+20 XP — 주간 랭킹에도 반영돼요!</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-slate-500">패배…</p>
              <p className="mt-1 text-sm text-slate-500">
                참가 보상 +5 XP. 공부해서 레벨을 올리고 복수전을 신청하자!
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
              href="/leaderboard"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              랭킹 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
