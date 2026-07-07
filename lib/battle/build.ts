// 전투원 구성 헬퍼 — battle.ts(야생/보스)와 pvp.ts(대인전)가 공유한다.
// ("use server" 파일은 async 액션만 export 가능해 공유 헬퍼는 일반 모듈로 분리)

import { createAdminClient } from "@/lib/supabase/admin";
import { spriteUrl } from "@/lib/storage";
import {
  type Combatant,
  type BattleMove,
  type TypeChart,
  scaleStat,
  maxHpFor,
  zeroStages,
} from "@/lib/battle/engine";
import { selectBattleMoves } from "@/lib/battle/moveset";

export type Admin = ReturnType<typeof createAdminClient>;

export async function loadTypeChart(admin: Admin): Promise<TypeChart> {
  const { data } = await admin
    .from("type_relations")
    .select("type, weaknesses, resistances, immunities");
  const chart: TypeChart = {};
  (data ?? []).forEach((r: any) => {
    chart[r.type] = {
      weaknesses: r.weaknesses ?? [],
      resistances: r.resistances ?? [],
      immunities: r.immunities ?? [],
    };
  });
  return chart;
}

/** 종 + 레벨로 전투원(스탯/기술/스프라이트) 구성 */
export async function buildCombatant(
  admin: Admin,
  speciesId: string,
  level: number,
): Promise<Combatant> {
  const { data: sp } = await admin
    .from("pokemon_species")
    .select("id, name, name_ko, type1, type2, base_stats, sprites(storage_path, variant)")
    .eq("id", speciesId)
    .single();
  const bs = (sp?.base_stats ?? {}) as Record<string, number>;
  const types = [sp?.type1, sp?.type2].filter(Boolean) as string[];

  // 학습한(레벨 이하) 기술 — 요약 화면과 동일한 규칙(selectBattleMoves)으로 4개 선택
  const { data: sm } = await admin
    .from("species_moves")
    .select("move_key, level_learned")
    .eq("species_id", speciesId)
    .lte("level_learned", level);
  const levelByKey = new Map<string, number>(
    (sm ?? []).map((r: any) => [r.move_key, r.level_learned]),
  );
  const keys = Array.from(levelByKey.keys());
  let moves: BattleMove[] = [];
  if (keys.length) {
    const { data: md } = await admin
      .from("moves")
      .select("move_key, name_ko, power, move_type, category, accuracy, function_code, effect_chance")
      .in("move_key", keys);
    const learned = (md ?? []).map((m: any) => ({
      key: m.move_key,
      name_ko: m.name_ko || m.move_key,
      power: m.power,
      type: m.move_type,
      category: m.category,
      accuracy: m.accuracy ?? 100,
      function_code: m.function_code ?? "None",
      effect_chance: m.effect_chance ?? 0,
      level_learned: levelByKey.get(m.move_key) ?? 1,
    }));
    moves = selectBattleMoves(learned).map(({ level_learned, ...mv }) => mv);
  }
  if (moves.length === 0) {
    moves = [{ key: "STRUGGLE", name_ko: "발버둥", power: 30, type: "normal", category: 0 }];
  }

  const stats = {
    hp: bs.hp ?? 30,
    attack: scaleStat(bs.attack ?? 30, level),
    defense: scaleStat(bs.defense ?? 30, level),
    special_attack: scaleStat(bs.special_attack ?? 30, level),
    special_defense: scaleStat(bs.special_defense ?? 30, level),
    speed: scaleStat(bs.speed ?? 30, level),
  };
  const maxHp = maxHpFor(bs.hp ?? 30, level);
  const sprites = (sp?.sprites ?? []) as any[];
  const def = sprites.find((x) => x.variant === "default") ?? sprites[0];

  return {
    speciesId: sp!.id,
    name: sp?.name_ko || sp?.name || "포켓몬",
    level,
    types,
    stats,
    maxHp,
    hp: maxHp,
    moves,
    spriteUrl: spriteUrl(def?.storage_path),
    stages: zeroStages(),
    status: null,
  };
}
