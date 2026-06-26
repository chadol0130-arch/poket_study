"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

/** 학생: 상점에서 포켓몬 구입 (purchase_pokemon RPC, 트랜잭션). */
export async function purchasePokemon(listingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("purchase_pokemon", {
    p_listing_id: listingId,
  });
  if (error) {
    if (error.message.includes("insufficient")) return { error: "코인이 부족합니다." };
    if (error.message.includes("not available")) return { error: "판매 중이 아닙니다." };
    return { error: error.message };
  }
  revalidatePath("/shop");
  revalidatePath("/my-pokemon");
  revalidatePath("/dashboard");
  return { ok: true };
}
