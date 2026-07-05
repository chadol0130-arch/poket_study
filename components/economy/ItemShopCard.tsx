"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purchaseItem } from "@/lib/actions/shop";

export interface ShopItemInfo {
  itemKey: string;
  nameKo: string;
  description: string;
  kind: "ball" | "potion";
  price: number;
  effect: number;
  ownedQty: number;
}

export function ItemShopCard({ item, balance }: { item: ShopItemInfo; balance: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const [pending, startTransition] = useTransition();
  const canAfford = balance >= item.price;

  function buy() {
    setError(null);
    startTransition(async () => {
      const res = await purchaseItem(item.itemKey, 1);
      if ("error" in res) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      {broken ? (
        <span className="text-3xl">{item.kind === "ball" ? "🔴" : "🧪"}</span>
      ) : (
        <img
          src={`/items/${item.itemKey}.png`}
          alt={item.nameKo}
          className="h-10 w-10 object-contain"
          style={{ imageRendering: "pixelated" }}
          onError={() => setBroken(true)}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {item.nameKo}
          {item.ownedQty > 0 && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
              보유 ×{item.ownedQty}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-slate-500">{item.description}</p>
        {error && <p className="text-xs text-poke-red">{error}</p>}
      </div>
      <button
        onClick={buy}
        disabled={pending || !canAfford}
        className="whitespace-nowrap rounded-lg bg-poke-blue px-3 py-2 text-sm font-bold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        🪙 {item.price}
      </button>
    </div>
  );
}
