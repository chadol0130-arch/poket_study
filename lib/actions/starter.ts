"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./submissions";

/** 학생: 스타터 선택 (choose_starter RPC, 1회만). */
export async function chooseStarter(speciesId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("choose_starter", {
    p_species_id: speciesId,
  });
  if (error) {
    if (error.message.includes("already")) return { error: "이미 스타터를 선택했습니다." };
    if (error.message.includes("invalid")) return { error: "선택할 수 없는 포켓몬입니다." };
    return { error: error.message };
  }
  revalidatePath("/onboarding");
  revalidatePath("/my-pokemon");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** 학생: 대표(활성) 포켓몬 전환. */
export async function setActivePokemon(studentPokemonId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_pokemon", {
    p_sp_id: studentPokemonId,
  });
  if (error) {
    if (error.message.includes("not your")) return { error: "본인 포켓몬이 아닙니다." };
    return { error: error.message };
  }
  revalidatePath("/my-pokemon");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** 학생: 포켓몬 별명 변경. (student_pokemon UPDATE 정책이 없어 서비스롤로 소유권 확인 후 변경) */
export async function renamePokemon(
  studentPokemonId: string,
  nickname: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const clean = nickname.trim().slice(0, 12);
  const admin = createAdminClient();
  const { data: pet } = await admin
    .from("student_pokemon")
    .select("id, student_id")
    .eq("id", studentPokemonId)
    .maybeSingle();
  if (!pet || pet.student_id !== user.id) return { error: "본인 포켓몬이 아닙니다." };

  const { error } = await admin
    .from("student_pokemon")
    .update({ nickname: clean || null })
    .eq("id", studentPokemonId);
  if (error) return { error: error.message };

  revalidatePath("/my-pokemon");
  revalidatePath(`/my-pokemon/${studentPokemonId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
