"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

const AssignmentSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, "제목을 입력하세요."),
  description: z.string().default(""),
  xpReward: z.number().int().min(0).default(50),
  coinReward: z.number().int().min(0).default(10),
  dueAt: z.string().nullable().optional(),
});

/** 교사/관리자: 담당 반에 과제 생성. (RLS: teaches_class 검사) */
export async function createAssignment(
  input: z.input<typeof AssignmentSchema>,
): Promise<ActionResult> {
  const parsed = AssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  }
  const data = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("homework_assignments").insert({
    class_id: data.classId,
    title: data.title,
    description: data.description,
    xp_reward: data.xpReward,
    coin_reward: data.coinReward,
    due_at: data.dueAt || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/assignments");
  return { ok: true };
}
