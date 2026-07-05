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

/** 학생: 상점에서 도구(몬스터볼·상처약 등) 구입 (purchase_item RPC, 트랜잭션). */
export async function purchaseItem(itemKey: string, qty = 1): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("purchase_item", {
    p_item_key: itemKey,
    p_qty: qty,
  });
  if (error) {
    if (error.message.includes("insufficient")) return { error: "코인이 부족합니다." };
    if (error.message.includes("not available")) return { error: "판매 중이 아닙니다." };
    if (/does not exist|schema cache/i.test(error.message)) {
      return { error: "도구 기능이 아직 적용되지 않았어요. (관리자: 마이그레이션 0016 실행 필요)" };
    }
    return { error: error.message };
  }
  revalidatePath("/shop");
  return { ok: true };
}
