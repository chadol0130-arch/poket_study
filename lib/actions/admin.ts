"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";
import type { Role } from "@/lib/types/db";

const NewUserSchema = z.object({
  email: z.string().email("이메일 형식이 아닙니다."),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
  fullName: z.string().min(1, "이름을 입력하세요."),
  role: z.enum(["admin", "teacher", "student"]),
});

/** 관리자: 계정 생성 (Admin API, service-role). */
export async function createUserAccount(
  input: z.input<typeof NewUserSchema>,
): Promise<ActionResult> {
  await requireRole("admin"); // 호출자 권한 확인
  const parsed = NewUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  }
  const { email, password, fullName, role } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 학원 운영자가 직접 만드므로 메일 확인 생략
    user_metadata: { full_name: fullName, display_name: fullName, role },
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

/** 관리자: 역할 변경. */
export async function setUserRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}
