"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createChallenge, respondChallenge } from "@/lib/actions/pvp";

export interface Classmate {
  id: string;
  name: string;
  level: number;
}
export interface IncomingChallenge {
  id: string;
  challengerName: string;
}
export interface OngoingPvp {
  id: string;
  otherName: string;
  myTurn: boolean;
}
export interface OutgoingChallenge {
  id: string;
  opponentName: string;
}

export function PvpSection({
  classmates,
  incoming,
  ongoing,
  outgoing,
}: {
  classmates: Classmate[];
  incoming: IncomingChallenge[];
  ongoing: OngoingPvp[];
  outgoing: OutgoingChallenge[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function challenge(opponentId: string) {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await createChallenge(opponentId);
      if ("error" in res) return setError(res.error);
      setMsg("도전장을 보냈어요! 친구가 수락하면 알림이 와요. ⚔️");
      router.refresh();
    });
  }

  function respond(id: string, accept: boolean) {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await respondChallenge(id, accept);
      if ("error" in res) {
        setError(res.error);
        router.refresh();
        return;
      }
      if (accept && res.battleId) router.push(`/pvp/${res.battleId}`);
      else router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-500">⚔️ 친구와 대결 (실시간 1:1)</h2>

      {error && <p className="rounded-lg bg-poke-red/5 p-2 text-sm text-poke-red">{error}</p>}
      {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}

      {/* 받은 도전장 */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          {incoming.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-2xl border-2 border-poke-yellow bg-yellow-50 p-3"
            >
              <span className="text-sm font-semibold">
                📨 {c.challengerName}의 도전장이 도착했어요!
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => respond(c.id, true)}
                  disabled={pending}
                  className="rounded-lg bg-poke-red px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  수락
                </button>
                <button
                  onClick={() => respond(c.id, false)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-500 disabled:opacity-50"
                >
                  거절
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 진행 중 대결 */}
      {ongoing.map((g) => (
        <Link
          key={g.id}
          href={`/pvp/${g.id}`}
          className="flex items-center justify-between rounded-2xl border-2 border-poke-blue bg-blue-50 p-3 hover:bg-blue-100"
        >
          <span className="text-sm font-semibold">
            🔥 {g.otherName}와(과) 대결 중! {g.myTurn ? "— 내 차례예요!" : ""}
          </span>
          <span className="text-sm font-bold text-poke-blue">이어하기 →</span>
        </Link>
      ))}

      {/* 보낸 도전장 */}
      {outgoing.map((o) => (
        <div key={o.id} className="rounded-2xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          ⏳ {o.opponentName}의 응답을 기다리는 중…
        </div>
      ))}

      {/* 반 친구 목록 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        {classmates.length === 0 ? (
          <p className="py-2 text-center text-sm text-slate-400">
            아직 대결할 반 친구가 없어요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {classmates.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">
                  {c.name} <span className="text-xs text-slate-400">Lv.{c.level}</span>
                </span>
                <button
                  onClick={() => challenge(c.id)}
                  disabled={pending}
                  className="rounded-lg border border-poke-red/50 px-3 py-1 text-xs font-bold text-poke-red hover:bg-poke-red/5 disabled:opacity-50"
                >
                  도전!
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400">
          하루 3회 · 같은 친구에겐 1회 · 승리 +{20} XP / 패배 +{5} XP
        </p>
      </div>
    </section>
  );
}
