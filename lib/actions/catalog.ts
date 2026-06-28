"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./submissions";

// 벌크 시드 입력 형식. 각 종(species) 행이 자신이 속한 진화 체인(chain 키)과
// 그 안에서의 단계(stage_order), 진화 레벨(min_level)을 함께 선언한다.
const SpeciesRow = z.object({
  pokedex_number: z.number().int(),
  name: z.string().min(1),
  name_ko: z.string().default(""),
  type1: z.string().nullable().optional(),
  type2: z.string().nullable().optional(),
  base_stats: z.record(z.string(), z.number()).optional(), // hp/attack/... (배틀용)
  sprite: z.string().optional(), // 정면 스프라이트 경로 (pokemon-sprites 버킷)
  icon: z.string().optional(), // 64x64 아이콘 경로
  chain: z.string().min(1), // 같은 진화 라인은 같은 키
  stage_order: z.number().int().min(1),
  min_level: z.number().int().min(1).default(1),
  moves: z.array(z.tuple([z.number(), z.string()])).optional(), // 레벨업 학습세트 [[lv, KEY]]
});
const SeedSchema = z.object({ species: z.array(SpeciesRow).min(1) });

/** 관리자: 포켓몬 카탈로그(종/진화체인/단계/스프라이트) 벌크 업서트. */
export async function seedCatalog(json: string): Promise<ActionResult> {
  await requireRole("admin");

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { error: "JSON 파싱 실패: 형식을 확인하세요." };
  }
  const parsed = SeedSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  }
  const rows = parsed.data.species;
  const supabase = await createClient();

  // 1) 진화 체인 — name(=chain 키)으로 식별. 기존 것 재사용, 없으면 생성.
  const chainKeys = Array.from(new Set(rows.map((r) => r.chain)));
  const chainIdByKey = new Map<string, string>();

  const { data: existingChains } = await supabase
    .from("evolution_chains")
    .select("id, name")
    .in("name", chainKeys);
  (existingChains ?? []).forEach((c: { id: string; name: string }) =>
    chainIdByKey.set(c.name, c.id),
  );

  const missingChains = chainKeys.filter((k) => !chainIdByKey.has(k));
  if (missingChains.length > 0) {
    const { data: inserted, error } = await supabase
      .from("evolution_chains")
      .insert(missingChains.map((name) => ({ name })))
      .select("id, name");
    if (error) return { error: `체인 생성 실패: ${error.message}` };
    (inserted ?? []).forEach((c: { id: string; name: string }) =>
      chainIdByKey.set(c.name, c.id),
    );
  }

  // 2) 종 업서트 (pokedex_number 고유)
  const { data: species, error: spErr } = await supabase
    .from("pokemon_species")
    .upsert(
      rows.map((r) => ({
        pokedex_number: r.pokedex_number,
        name: r.name,
        name_ko: r.name_ko,
        type1: r.type1 ?? null,
        type2: r.type2 ?? null,
        base_stats: r.base_stats ?? {},
      })),
      { onConflict: "pokedex_number" },
    )
    .select("id, pokedex_number");
  if (spErr) return { error: `종 업서트 실패: ${spErr.message}` };

  const speciesIdByDex = new Map<number, string>();
  (species ?? []).forEach((s: { id: string; pokedex_number: number }) =>
    speciesIdByDex.set(s.pokedex_number, s.id),
  );

  // 3) 진화 단계 업서트 (chain_id, stage_order 고유)
  const stageRows = rows.map((r) => ({
    chain_id: chainIdByKey.get(r.chain)!,
    species_id: speciesIdByDex.get(r.pokedex_number)!,
    stage_order: r.stage_order,
    min_level: r.min_level,
  }));
  const { error: stErr } = await supabase
    .from("evolution_stages")
    .upsert(stageRows, { onConflict: "chain_id,stage_order" });
  if (stErr) return { error: `진화 단계 업서트 실패: ${stErr.message}` };

  // 4) 스프라이트 업서트 (species_id, variant 고유) — 정면(default) + 아이콘(icon)
  const spriteRows = [
    ...rows
      .filter((r) => r.sprite)
      .map((r) => ({
        species_id: speciesIdByDex.get(r.pokedex_number)!,
        variant: "default" as const,
        storage_path: r.sprite!,
      })),
    ...rows
      .filter((r) => r.icon)
      .map((r) => ({
        species_id: speciesIdByDex.get(r.pokedex_number)!,
        variant: "icon" as const,
        storage_path: r.icon!,
      })),
  ];
  if (spriteRows.length > 0) {
    const { error: imgErr } = await supabase
      .from("sprites")
      .upsert(spriteRows, { onConflict: "species_id,variant" });
    if (imgErr) return { error: `스프라이트 업서트 실패: ${imgErr.message}` };
  }

  // 5) 레벨업 학습세트(species_moves) 업서트 — 배틀용
  const moveRows = rows.flatMap((r) =>
    (r.moves ?? []).map(([lvl, key]) => ({
      species_id: speciesIdByDex.get(r.pokedex_number)!,
      move_key: key,
      level_learned: lvl,
    })),
  );
  if (moveRows.length > 0) {
    const { error: smErr } = await supabase
      .from("species_moves")
      .upsert(moveRows, { onConflict: "species_id,move_key" });
    if (smErr) return { error: `학습세트 업서트 실패: ${smErr.message}` };
  }

  revalidatePath("/admin/pokemon");
  revalidatePath("/admin/starters");
  revalidatePath("/admin/shop");
  return { ok: true };
}

/** 종의 진화 체인 id 조회 헬퍼 (stage 테이블 기준). */
async function chainIdForSpecies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  speciesId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("evolution_stages")
    .select("chain_id")
    .eq("species_id", speciesId)
    .limit(1)
    .maybeSingle();
  return (data?.chain_id as string) ?? null;
}

/** 관리자: 스타터 후보 등록/갱신. */
export async function setStarterOption(
  speciesId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createClient();
  const chainId = await chainIdForSpecies(supabase, speciesId);
  if (!chainId) return { error: "해당 종의 진화 체인을 찾을 수 없습니다." };

  const { error } = await supabase
    .from("starter_options")
    .upsert(
      { species_id: speciesId, chain_id: chainId, is_active: isActive },
      { onConflict: "species_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/starters");
  revalidatePath("/onboarding");
  return { ok: true };
}

/** 관리자: 상점 상품 등록/갱신. */
export async function upsertShopListing(input: {
  listingId?: string;
  speciesId: string;
  price: number;
  isActive: boolean;
}): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createClient();
  const chainId = await chainIdForSpecies(supabase, input.speciesId);
  if (!chainId) return { error: "해당 종의 진화 체인을 찾을 수 없습니다." };

  const row = {
    ...(input.listingId ? { id: input.listingId } : {}),
    species_id: input.speciesId,
    chain_id: chainId,
    price: input.price,
    is_active: input.isActive,
  };
  const { error } = await supabase.from("shop_listings").upsert(row);
  if (error) return { error: error.message };
  revalidatePath("/admin/shop");
  revalidatePath("/shop");
  return { ok: true };
}

// 배틀 기초 데이터(기술 + 타입 상성) 임포트
const BattleDataSchema = z.object({
  moves: z.array(
    z.object({
      key: z.string(),
      name_ko: z.string().default(""),
      power: z.number().int().default(0),
      type: z.string().default("normal"),
      category: z.number().int().default(2),
      accuracy: z.number().int().default(100),
    }),
  ),
  type_chart: z.record(
    z.string(),
    z.object({
      weaknesses: z.array(z.string()).default([]),
      resistances: z.array(z.string()).default([]),
      immunities: z.array(z.string()).default([]),
    }),
  ),
});

/** 관리자: 배틀 기초 데이터(기술/타입 상성) 업서트. (data/pokemon/battle_data.json) */
export async function seedBattleData(json: string): Promise<ActionResult> {
  await requireRole("admin");
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { error: "JSON 파싱 실패: 형식을 확인하세요." };
  }
  const parsed = BattleDataSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  }
  const supabase = await createClient();

  const moveRows = parsed.data.moves.map((m) => ({
    move_key: m.key,
    name_ko: m.name_ko,
    power: m.power,
    move_type: m.type,
    category: m.category,
    accuracy: m.accuracy,
  }));
  const { error: mErr } = await supabase
    .from("moves")
    .upsert(moveRows, { onConflict: "move_key" });
  if (mErr) return { error: `기술 업서트 실패: ${mErr.message}` };

  const typeRows = Object.entries(parsed.data.type_chart).map(([type, rel]) => ({
    type,
    weaknesses: rel.weaknesses,
    resistances: rel.resistances,
    immunities: rel.immunities,
  }));
  const { error: tErr } = await supabase
    .from("type_relations")
    .upsert(typeRows, { onConflict: "type" });
  if (tErr) return { error: `타입 상성 업서트 실패: ${tErr.message}` };

  revalidatePath("/admin/pokemon");
  return { ok: true };
}
