"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renamePokemon, setActivePokemon } from "@/lib/actions/starter";

export function PokemonManager({
  petId,
  currentNickname,
  isActive,
}: {
  petId: string;
  currentNickname: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(currentNickname);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await renamePokemon(petId, nickname);
      if ("error" in res) return setMsg(res.error);
      setMsg("별명을 저장했어요!");
      router.refresh();
    });
  }

  function makeActive() {
    setMsg(null);
    startTransition(async () => {
      const res = await setActivePokemon(petId);
      if ("error" in res) return setMsg(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">별명</label>
        <div className="mt-1 flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
            placeholder="별명을 지어주세요"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-poke-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>

      {isActive ? (
        <p className="rounded-lg bg-poke-red/10 py-2 text-center text-sm font-medium text-poke-red">
          현재 키우는 대표 포켓몬이에요 ⭐
        </p>
      ) : (
        <button
          onClick={makeActive}
          disabled={pending}
          className="w-full rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          대표로 지정 (숙제 경험치 받기)
        </button>
      )}

      {msg && <p className="text-center text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
