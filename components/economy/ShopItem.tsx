"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purchasePokemon } from "@/lib/actions/shop";
import { PokemonSprite } from "@/components/pokemon/PokemonSprite";

export interface ShopItemData {
  listingId: string;
  nameKo: string;
  name: string;
  spriteUrl: string | null;
  price: number;
  alreadyOwned: boolean;
}

export function ShopItem({
  item,
  balance,
}: {
  item: ShopItemData;
  balance: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canAfford = balance >= item.price;

  function buy() {
    setError(null);
    startTransition(async () => {
      const res = await purchasePokemon(item.listingId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <PokemonSprite url={item.spriteUrl} alt={item.nameKo || item.name} size={88} />
      <p className="mt-2 font-semibold">{item.nameKo || item.name}</p>
      <p className="mt-1 text-sm font-bold text-amber-600">🪙 {item.price.toLocaleString()}</p>

      <button
        onClick={buy}
        disabled={pending || !canAfford}
        className="mt-3 w-full rounded-lg bg-poke-blue py-1.5 text-sm font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        {pending ? "구입 중..." : canAfford ? "구입하기" : "코인 부족"}
      </button>
      {item.alreadyOwned && (
        <p className="mt-1 text-[11px] text-slate-400">이미 보유 중(추가 구입 가능)</p>
      )}
      {error && <p className="mt-1 text-xs text-poke-red">{error}</p>}
    </div>
  );
}
