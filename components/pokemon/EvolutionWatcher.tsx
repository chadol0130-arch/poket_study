"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

interface Snapshot {
  speciesId: string;
  name: string;
  spriteUrl: string | null;
}

/**
 * 진화 감지 + 어나더레드식 연출.
 * 진화는 서버(숙제 승인/체크인/질문/배틀)에서 조용히 일어나므로,
 * 이 기기에서 마지막으로 본 종을 localStorage 에 기억해 두고
 * 대시보드 진입 시 달라져 있으면 풀스크린 진화 연출을 보여준다.
 */
export function EvolutionWatcher({
  petId,
  speciesId,
  name,
  spriteUrl,
}: {
  petId: string;
  speciesId: string;
  name: string;
  spriteUrl: string | null;
}) {
  const [prev, setPrev] = useState<Snapshot | null>(null);
  // 0=옛 모습, 1=점멸, 2=새 모습 공개
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const key = `evo-${petId}`;
    try {
      const raw = localStorage.getItem(key);
      const stored: Snapshot | null = raw ? JSON.parse(raw) : null;
      if (stored && stored.speciesId !== speciesId && stored.spriteUrl) {
        setPrev(stored);
        setPhase(0);
        const t1 = window.setTimeout(() => setPhase(1), 1400);
        const t2 = window.setTimeout(() => setPhase(2), 3600);
        localStorage.setItem(key, JSON.stringify({ speciesId, name, spriteUrl }));
        return () => {
          window.clearTimeout(t1);
          window.clearTimeout(t2);
        };
      }
      localStorage.setItem(key, JSON.stringify({ speciesId, name, spriteUrl }));
    } catch {
      // localStorage 불가(시크릿 모드 등) — 연출만 생략, 앱 동작엔 영향 없음
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, speciesId]);

  if (!prev) return null;

  const showUrl = phase === 2 ? spriteUrl : prev.spriteUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-44 w-44 items-center justify-center">
          {showUrl && (
            <img
              key={phase === 2 ? "new" : "old"}
              src={showUrl}
              alt=""
              className={`h-40 w-40 object-contain ${
                phase === 0 ? "poke-idle" : phase === 1 ? "evolve-flicker" : "evolve-reveal"
              }`}
              style={{ imageRendering: "pixelated" }}
            />
          )}
        </div>

        <p className="mt-4 min-h-[3.5rem] text-lg font-bold text-white">
          {phase === 0 && `어라…? ${prev.name}의 상태가…!`}
          {phase === 1 && `${prev.name}이(가) 빛나기 시작했다…!`}
          {phase === 2 && (
            <>
              축하합니다! 🎉
              <br />
              <span className="text-poke-yellow">{prev.name}</span>은(는){" "}
              <span className="text-poke-yellow">{name}</span>(으)로 진화했다!
            </>
          )}
        </p>

        {phase === 2 && (
          <button
            onClick={() => setPrev(null)}
            className="mt-5 rounded-xl bg-poke-red px-6 py-2.5 font-bold text-white hover:bg-poke-red/90"
          >
            멋져! 계속하기
          </button>
        )}
      </div>
    </div>
  );
}
