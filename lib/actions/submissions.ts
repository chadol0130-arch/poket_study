"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

/** 학생이 숙제 제출(또는 pending 상태에서 재제출). */
export async function submitHomework(input: {
  assignmentId: string;
  note: string;
  photoPaths: string[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("submissions").upsert(
    {
      assignment_id: input.assignmentId,
      student_id: user.id,
      note: input.note,
      photo_paths: input.photoPaths,
      status: "pending",
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      reject_reason: null,
    },
    { onConflict: "assignment_id,student_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/assignments");
  revalidatePath(`/assignments/${input.assignmentId}/submit`);
  return { ok: true };
}

/** 교사/관리자: 제출 승인 → 트리거가 경험치/코인 지급. */
export async function approveSubmission(submissionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("submissions")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: null,
    })
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/queue");
  return { ok: true };
}

/** 교사/관리자: 제출 반려. */
export async function rejectSubmission(
  submissionId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("submissions")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason,
    })
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/queue");
  return { ok: true };
}
