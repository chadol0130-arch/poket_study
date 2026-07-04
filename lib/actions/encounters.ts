"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

const BossSchema = z.object({
  speciesId: z.string().uuid(),
  level: z.number().int().min(1).max(100),
  title: z.string().default(""),
  encounterDate: z.string().min(1, "날짜를 선택하세요."),
  audience: z.enum(["all", "class"]),
  classId: z.string().uuid().nullable().optional(),
  rewardXp: z.number().int().min(0).default(100),
  rewardCoin: z.number().int().min(0).default(30),
  catchable: z.boolean().default(true),
});

/** 관리자: 보스 배치 + 대상 학생 펼침 */
export async function createBoss(
  input: z.input<typeof BossSchema>,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = BossSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 대상 학생
  let studentIds: string[] = [];
  if (d.audience === "all") {
    const { data: rows } = await supabase.from("profiles").select("id").eq("role", "student");
    studentIds = (rows ?? []).map((r: any) => r.id);
  } else {
    if (!d.classId) return { error: "반을 선택하세요." };
    const { data: rows } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("class_id", d.classId)
      .eq("status", "active");
    studentIds = (rows ?? []).map((r: any) => r.student_id);
  }
  studentIds = Array.from(new Set(studentIds));
  if (studentIds.length === 0) return { error: "대상 학생이 없습니다." };

  const { data: enc, error: eErr } = await supabase
    .from("battle_encounters")
    .insert({
      kind: "boss",
      species_id: d.speciesId,
      level: d.level,
      title: d.title,
      encounter_date: d.encounterDate,
      audience: d.audience,
      class_id: d.audience === "class" ? d.classId : null,
      reward_xp: d.rewardXp,
      reward_coin: d.rewardCoin,
      catchable: d.catchable,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (eErr || !enc) return { error: eErr?.message ?? "보스 생성 실패" };

  // 대규모(수천 명)도 안전하게 500행씩 청크 삽입
  const rows = studentIds.map((sid) => ({ encounter_id: enc.id, student_id: sid }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: tErr } = await supabase
      .from("encounter_targets")
      .insert(rows.slice(i, i + 500));
    if (tErr) return { error: tErr.message };
  }

  revalidatePath("/admin/encounters");
  return { ok: true };
}

export async function setEncounterActive(
  encounterId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("battle_encounters")
    .update({ is_active: isActive })
    .eq("id", encounterId);
  if (error) return { error: error.message };
  revalidatePath("/admin/encounters");
  return { ok: true };
}
