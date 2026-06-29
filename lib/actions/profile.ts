"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

/** 본인 표시 이름(별명) 변경. profiles self update RLS(id=auth.uid())로 본인 것만 변경 가능. */
export async function updateMyProfile(displayName: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const clean = displayName.trim().slice(0, 20);
  if (!clean) return { error: "이름을 입력하세요." };

  // 앱은 display_name 만 변경 (role 등 다른 컬럼은 건드리지 않음).
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: clean })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true };
}
