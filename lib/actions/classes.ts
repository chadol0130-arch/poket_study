"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

/** 관리자: 반 생성. */
export async function createClass(name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!name.trim()) return { error: "반 이름을 입력하세요." };

  const { error } = await supabase
    .from("classes")
    .insert({ name: name.trim(), created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/admin/classes");
  return { ok: true };
}

/** 관리자: 반에 교사 배정. */
export async function assignTeacher(
  classId: string,
  teacherId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_teachers")
    .insert({ class_id: classId, teacher_id: teacherId });
  if (error) return { error: error.message };
  revalidatePath("/admin/classes");
  return { ok: true };
}

/** 관리자/교사: 학생을 반에 등록. */
export async function enrollStudent(
  classId: string,
  studentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("enrollments")
    .upsert(
      { class_id: classId, student_id: studentId, status: "active" },
      { onConflict: "class_id,student_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/classes");
  return { ok: true };
}
