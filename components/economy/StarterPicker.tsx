"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseStarter } from "@/lib/actions/starter";
import { PokemonSprite } from "@/components/pokemon/PokemonSprite";

export interface StarterChoice {
  speciesId: string;
  nameKo: string;
  name: string;
  spriteUrl: string | null;
}

export function StarterPicker({ choices }: { choices: StarterChoice[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await chooseStarter(selected);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {choices.map((c) => {
          const isSel = selected === c.speciesId;
          return (
            <button
              key={c.speciesId}
              onClick={() => setSelected(c.speciesId)}
              className={`flex flex-col items-center rounded-2xl border-2 bg-white p-5 transition ${
                isSel
                  ? "border-poke-red ring-2 ring-poke-red/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <PokemonSprite url={c.spriteUrl} alt={c.nameKo || c.name} size={112} />
              <span className="mt-2 font-semibold">{c.nameKo || c.name}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-poke-red">{error}</p>}

      <button
        disabled={!selected || pending}
        onClick={confirm}
        className="mt-6 w-full rounded-xl bg-poke-red py-3 font-bold text-white transition hover:bg-poke-red/90 disabled:opacity-50"
      >
        {pending ? "결정 중..." : "이 포켓몬으로 시작하기!"}
      </button>
    </div>
  );
}
