"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";
import type { FeedbackStatus } from "@/lib/types/db";

const STATUSES: FeedbackStatus[] = ["open", "in_progress", "resolved", "wontfix"];

/** 관리자: 문의 상태 변경 + 내부 메모. (RLS: feedback admin manage — 학생 제출은 submit_feedback RPC) */
export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  note: string,
): Promise<ActionResult> {
  await requireRole("admin");
  if (!STATUSES.includes(status)) return { error: "잘못된 상태입니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({
      status,
      admin_note: (note ?? "").slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/feedback");
  return { ok: true };
}
