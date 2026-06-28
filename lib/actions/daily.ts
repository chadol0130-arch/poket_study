"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

/** 교사/관리자: 날짜별 기록 승인 → 트리거가 경험치/코인 지급. */
export async function approveDailyLog(logId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("daily_logs")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: null,
    })
    .eq("id", logId);
  if (error) return { error: error.message };
  revalidatePath("/queue");
  return { ok: true };
}

/** 교사/관리자: 날짜별 기록 반려. */
export async function rejectDailyLog(
  logId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("daily_logs")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason,
    })
    .eq("id", logId);
  if (error) return { error: error.message };
  revalidatePath("/queue");
  return { ok: true };
}
