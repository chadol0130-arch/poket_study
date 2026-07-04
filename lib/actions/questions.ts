"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

const QuestionSchema = z.object({
  body: z.string().min(1, "질문 내용을 입력하세요."),
  kind: z.enum(["open", "choice"]),
  options: z.array(z.string().min(1)).default([]),
  xpReward: z.number().int().min(0).default(20),
  audience: z.enum(["all", "class", "students"]),
  classId: z.string().uuid().nullable().optional(),
  studentIds: z.array(z.string().uuid()).default([]),
});

/** 관리자: 질문 생성 + 대상 학생을 행으로 펼쳐 저장. */
export async function createQuestion(
  input: z.input<typeof QuestionSchema>,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = QuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  }
  const data = parsed.data;
  if (data.kind === "choice" && data.options.length < 2) {
    return { error: "객관식은 선택지를 2개 이상 입력하세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 1) 대상 학생 id 모으기
  let studentIds: string[] = [];
  if (data.audience === "all") {
    const { data: rows } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student");
    studentIds = (rows ?? []).map((r: any) => r.id);
  } else if (data.audience === "class") {
    if (!data.classId) return { error: "반을 선택하세요." };
    const { data: rows } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("class_id", data.classId)
      .eq("status", "active");
    studentIds = (rows ?? []).map((r: any) => r.student_id);
  } else {
    studentIds = data.studentIds;
  }
  studentIds = Array.from(new Set(studentIds));
  if (studentIds.length === 0) {
    return { error: "받을 학생이 없습니다. 대상을 다시 확인하세요." };
  }

  // 2) 질문 생성
  const { data: q, error: qErr } = await supabase
    .from("questions")
    .insert({
      created_by: user.id,
      body: data.body,
      kind: data.kind,
      options: data.kind === "choice" ? data.options : [],
      xp_reward: data.xpReward,
      audience: data.audience,
    })
    .select("id")
    .single();
  if (qErr || !q) return { error: qErr?.message ?? "질문 생성 실패" };

  // 3) 대상 펼쳐 저장 — 대규모(수천 명)도 안전하게 500행씩 청크 삽입
  const rows = studentIds.map((sid) => ({ question_id: q.id, student_id: sid }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: tErr } = await supabase
      .from("question_targets")
      .insert(rows.slice(i, i + 500));
    if (tErr) return { error: tErr.message };
  }

  revalidatePath("/admin/questions");
  return { ok: true };
}

/** 관리자: 질문 활성/마감 토글. */
export async function setQuestionActive(
  questionId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({ is_active: isActive })
    .eq("id", questionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/questions");
  return { ok: true };
}
