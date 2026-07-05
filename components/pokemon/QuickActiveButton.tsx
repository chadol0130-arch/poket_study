"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActivePokemon } from "@/lib/actions/starter";

/** 컬렉션 카드에서 바로 대표 지정 (Link 안에서 쓰이므로 이동을 막고 처리) */
export function QuickActiveButton({ petId }: { petId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    startTransition(async () => {
      await setActivePokemon(petId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="w-full rounded-lg border border-poke-red/40 py-1.5 text-center text-xs font-bold text-poke-red hover:bg-poke-red/5 disabled:opacity-50"
    >
      {pending ? "변경 중..." : "⭐ 대표로 지정"}
    </button>
  );
}
