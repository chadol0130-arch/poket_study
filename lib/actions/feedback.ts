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

/** 관리자: 건의 채택 — 학생에게 코인 100 + "아이디어 채택!" 알림. 중복 지급은 DB가 차단. */
export async function acceptFeedback(id: string): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_feedback", { p_feedback_id: id });
  if (error) return { error: error.message };
  if (data?.already) return { error: "이미 채택된 건의예요." };

  revalidatePath("/admin/feedback");
  return { ok: true };
}
