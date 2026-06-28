"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActivePokemon } from "@/lib/actions/starter";
import { PokemonCard, type PokemonCardData } from "./PokemonCard";

export interface CollectionPet extends PokemonCardData {
  id: string;
}

export function CollectionGrid({ pets }: { pets: CollectionPet[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function makeActive(id: string) {
    setBusyId(id);
    startTransition(async () => {
      await setActivePokemon(id);
      setBusyId(null);
      router.refresh();
    });
  }

  if (pets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
        아직 포켓몬이 없어요.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {pets.map((pet) => (
        <PokemonCard
          key={pet.id}
          data={pet}
          footer={
            pet.isActive ? (
              <p className="text-center text-xs font-medium text-poke-red">현재 키우는 중</p>
            ) : (
              <button
                onClick={() => makeActive(pet.id)}
                disabled={pending && busyId === pet.id}
                className="w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {pending && busyId === pet.id ? "변경 중..." : "대표로 지정"}
              </button>
            )
          }
        />
      ))}
    </div>
  );
}
