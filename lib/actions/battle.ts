"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spriteUrl } from "@/lib/storage";
import { levelForXp, xpToReach } from "@/lib/xp";
import {
  type Combatant,
  type BattleMove,
  type TypeChart,
  scaleStat,
  maxHpFor,
  zeroStages,
} from "@/lib/battle/engine";
import { selectBattleMoves } from "@/lib/battle/moveset";
import { resolveRound, enemyFreeAttack } from "@/lib/battle/turn";

type Admin = ReturnType<typeof createAdminClient>;

async function currentUid(): Promise<string | null> {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  return user?.id ?? null;
}

async function loadTypeChart(admin: Admin): Promise<TypeChart> {
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
async function buildCombatant(
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

export type BattleStartResult =
  | { ok: true; battleId: string }
  | { error: string };

/** 보스 배틀 시작(또는 진행 중이면 이어하기) */
export async function startBossBattle(encounterId: string): Promise<BattleStartResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: enc } = await admin
    .from("battle_encounters")
    .select("*")
    .eq("id", encounterId)
    .maybeSingle();
  if (!enc || !enc.is_active) return { error: "조우를 찾을 수 없습니다." };

  const { data: tgt } = await admin
    .from("encounter_targets")
    .select("id")
    .eq("encounter_id", encounterId)
    .eq("student_id", uid)
    .maybeSingle();
  if (!tgt) return { error: "이 보스의 대상이 아니에요." };

  const { data: won } = await admin
    .from("battles")
    .select("id")
    .eq("student_id", uid)
    .eq("encounter_id", encounterId)
    .eq("status", "won")
    .maybeSingle();
  if (won) return { error: "이미 클리어한 보스예요! 🎉" };

  const { data: ongoing } = await admin
    .from("battles")
    .select("id")
    .eq("student_id", uid)
    .eq("encounter_id", encounterId)
    .eq("status", "ongoing")
    .maybeSingle();
  if (ongoing) return { ok: true, battleId: ongoing.id };

  const { data: pet } = await admin
    .from("student_pokemon")
    .select("*")
    .eq("student_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!pet) return { error: "활성 포켓몬이 없어요. 먼저 스타터를 선택하세요." };

  const student = await buildCombatant(admin, pet.current_species_id, pet.level);
  const enemy = await buildCombatant(admin, enc.species_id, enc.level);
  const state = {
    student,
    enemy,
    turn: 1,
    catchable: enc.catchable,
    log: [`👑 보스 ${enemy.name}(Lv${enemy.level})이(가) 나타났다!`],
  };

  const { data: b, error } = await admin
    .from("battles")
    .insert({
      student_id: uid,
      encounter_id: encounterId,
      kind: "boss",
      enemy_species_id: enc.species_id,
      enemy_level: enc.level,
      student_pokemon_id: pet.id,
      state,
      status: "ongoing",
      reward_xp: enc.reward_xp,
      reward_coin: enc.reward_coin,
    })
    .select("id")
    .single();
  if (error || !b) return { error: error?.message ?? "배틀 생성 실패" };
  return { ok: true, battleId: b.id };
}

/** 야생 배틀 시작 (하루 1회). dateKST = 'YYYY-MM-DD' */
export async function startWildBattle(dateKST: string): Promise<BattleStartResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const start = `${dateKST}T00:00:00+09:00`;
  const end = `${dateKST}T23:59:59+09:00`;
  const { data: today } = await admin
    .from("battles")
    .select("id, status")
    .eq("student_id", uid)
    .eq("kind", "wild")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (today) {
    if (today.status === "ongoing") return { ok: true, battleId: today.id };
    return { error: "오늘은 이미 야생 포켓몬과 만났어요. 내일 또 만나요!" };
  }

  const { data: pet } = await admin
    .from("student_pokemon")
    .select("*")
    .eq("student_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!pet) return { error: "활성 포켓몬이 없어요. 먼저 스타터를 선택하세요." };

  // 상대 선택: ① 미보유 진화라인만(중복 포획 상황 예방) ② 내 대표와 종족값이 비슷한 종만
  // (좁은 밴드부터 넓혀가며 반드시 후보 확보 → 항상 비슷한 급이 출현)
  const [{ data: allSp }, { data: stages }, { data: myPets }] = await Promise.all([
    admin.from("pokemon_species").select("id, base_stats"),
    admin.from("evolution_stages").select("species_id, chain_id"),
    admin.from("student_pokemon").select("chain_id").eq("student_id", uid),
  ]);
  if (!allSp || allSp.length === 0) return { error: "포켓몬 데이터가 없어요." };

  const chainBySpecies = new Map<string, string>(
    (stages ?? []).map((s: any) => [s.species_id, s.chain_id]),
  );
  const ownedChains = new Set((myPets ?? []).map((p: any) => p.chain_id));
  const statTotal = (bs: Record<string, number> | null | undefined) =>
    Object.values(bs ?? {}).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
  const myTotal = statTotal(
    (allSp.find((s: any) => s.id === pet.current_species_id) as any)?.base_stats,
  );

  const unowned = allSp.filter((s: any) => !ownedChains.has(chainBySpecies.get(s.id) ?? ""));
  const pool = unowned.length > 0 ? unowned : allSp; // 전부 보유 시 폴백(포획은 중복가드가 막음)
  let candidates: any[] = pool;
  if (myTotal > 0) {
    for (const band of [0.15, 0.3, 0.5, Number.POSITIVE_INFINITY]) {
      const within = pool.filter(
        (s: any) => Math.abs(statTotal(s.base_stats) - myTotal) <= myTotal * band,
      );
      if (within.length > 0) {
        candidates = within;
        break;
      }
    }
  }
  const enemySpecies = candidates[Math.floor(Math.random() * candidates.length)].id;
  const enemyLevel = Math.max(2, pet.level + (Math.floor(Math.random() * 5) - 2));

  const student = await buildCombatant(admin, pet.current_species_id, pet.level);
  const enemy = await buildCombatant(admin, enemySpecies, enemyLevel);
  const state = {
    student,
    enemy,
    turn: 1,
    catchable: true,
    log: [`풀숲에서 야생 ${enemy.name}(Lv${enemy.level})이(가) 튀어나왔다!`],
  };

  const { data: b, error } = await admin
    .from("battles")
    .insert({
      student_id: uid,
      encounter_id: null,
      kind: "wild",
      enemy_species_id: enemySpecies,
      enemy_level: enemyLevel,
      student_pokemon_id: pet.id,
      state,
      status: "ongoing",
      reward_xp: enemyLevel * 8,
      reward_coin: enemyLevel * 2,
    })
    .select("id")
    .single();
  if (error || !b) return { error: error?.message ?? "배틀 생성 실패" };
  return { ok: true, battleId: b.id };
}

export interface TurnResult {
  ok?: true;
  error?: string;
  state?: any;
  status?: "ongoing" | "won" | "lost" | "fled";
  caughtName?: string | null;
  rewardXp?: number;
  rewardCoin?: number;
  /** useItem 후 남은 보유 수량 */
  remainingQty?: number;
}

/** 한 턴 진행: 내 기술 → (적 생존 시) 적 반격 → 승패 판정/보상/포획 */
export async function battleTurn(battleId: string, moveKey: string): Promise<TurnResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("battles").select("*").eq("id", battleId).maybeSingle();
  if (!b || b.student_id !== uid) return { error: "배틀을 찾을 수 없습니다." };
  if (b.status !== "ongoing")
    return { ok: true, state: b.state, status: b.status };

  const chart = await loadTypeChart(admin);
  const st = b.state as any;
  const student = st.student as Combatant;
  const enemy = st.enemy as Combatant;

  if (!student.moves.find((m) => m.key === moveKey)) {
    return { error: "사용할 수 없는 기술이에요." };
  }

  // 한 라운드 해석 (선공/명중/급소/상태이상/능력변화/도트 등 어나더레드급)
  const res = resolveRound(student, enemy, moveKey, chart);
  st.student = res.student;
  st.enemy = res.enemy;
  st.turn = (st.turn ?? 1) + 1;
  st.log = [...(st.log ?? []), ...res.log].slice(-40);
  const status = res.status;

  const update: Record<string, any> = { state: st, status };
  if (status !== "ongoing") update.finished_at = new Date().toISOString();
  await admin.from("battles").update(update).eq("id", battleId);

  let caughtName: string | null = null;
  if (status === "won") {
    await grantBattleRewards(admin, b);
    // 보스만 클리어 시 자동 포획. 야생은 배틀 중 몬스터볼로만 잡힌다.
    if (b.kind === "boss" && st.catchable) caughtName = await catchPokemon(admin, b);
  }

  return {
    ok: true,
    state: st,
    status,
    caughtName,
    rewardXp: status === "won" ? b.reward_xp : 0,
    rewardCoin: status === "won" ? b.reward_coin : 0,
  };
}

/** 배틀 중 도구 사용: 상처약=회복 후 적 프리턴, 몬스터볼=포획 시도(야생만). */
export async function useItem(battleId: string, itemKey: string): Promise<TurnResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("battles").select("*").eq("id", battleId).maybeSingle();
  if (!b || b.student_id !== uid) return { error: "배틀을 찾을 수 없습니다." };
  if (b.status !== "ongoing") return { ok: true, state: b.state, status: b.status };

  const { data: item } = await admin
    .from("items")
    .select("*")
    .eq("item_key", itemKey)
    .eq("is_active", true)
    .maybeSingle();
  if (!item) return { error: "사용할 수 없는 도구예요." };

  const st = b.state as any;
  const student = st.student as Combatant;
  const enemy = st.enemy as Combatant;

  if (item.kind === "ball" && !(b.kind === "wild" && st.catchable)) {
    return { error: "몬스터볼은 야생 포켓몬에게만 쓸 수 있어요." };
  }
  if (item.kind === "ball") {
    // 중복 포획 방지: 같은 진화라인 보유 시 볼 소모 전에 안내
    const { data: stage } = await admin
      .from("evolution_stages")
      .select("chain_id")
      .eq("species_id", b.enemy_species_id)
      .limit(1)
      .maybeSingle();
    if (stage) {
      const { data: dup } = await admin
        .from("student_pokemon")
        .select("id")
        .eq("student_id", uid)
        .eq("chain_id", stage.chain_id)
        .limit(1)
        .maybeSingle();
      if (dup) return { error: "이미 가지고 있는 포켓몬이에요! (중복 포획 방지)" };
    }
  }
  if (item.kind === "potion" && student.hp >= student.maxHp) {
    return { error: "HP가 가득 차 있어요." };
  }

  // 보유 수량 원자적 차감 (consume_item RPC — 동시 사용/치팅 방지)
  const { data: remaining, error: cErr } = await admin.rpc("consume_item", {
    p_student: uid,
    p_item_key: itemKey,
  });
  if (cErr) return { error: cErr.message };
  if ((remaining ?? -1) < 0) return { error: "가지고 있지 않은 도구예요. 상점에서 사보세요!" };
  const remainingQty = remaining as number;

  const chart = await loadTypeChart(admin);
  const log: string[] = [];
  let status: "ongoing" | "won" | "lost" = "ongoing";

  if (item.kind === "potion") {
    const heal = Math.min(item.effect, student.maxHp - student.hp);
    student.hp = Math.min(student.maxHp, student.hp + item.effect);
    log.push(`${item.name_ko}을(를) 사용했다! ${student.name}의 HP가 ${heal} 회복됐다!`);
    const res = enemyFreeAttack(student, enemy, chart);
    st.student = res.student;
    st.enemy = res.enemy;
    log.push(...res.log);
    status = res.status;
  } else {
    // 몬스터볼: HP가 낮을수록 잘 잡힌다 (기본 effect% + 최대 +55%p, 상한 95%)
    const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
    const chance = Math.min(95, item.effect + Math.floor((1 - hpRatio) * 55));
    log.push(`${item.name_ko}을(를) 던졌다!`);
    if (Math.random() * 100 < chance) {
      log.push(`잡았다! ${enemy.name}을(를) 손에 넣었다! ✨`);
      st.student = student;
      st.enemy = enemy;
      status = "won";
    } else {
      log.push(`앗! ${enemy.name}이(가) 볼에서 나와버렸다!`);
      const res = enemyFreeAttack(student, enemy, chart);
      st.student = res.student;
      st.enemy = res.enemy;
      log.push(...res.log);
      status = res.status;
    }
  }

  st.turn = (st.turn ?? 1) + 1;
  st.log = [...(st.log ?? []), ...log].slice(-40);
  const update: Record<string, any> = { state: st, status };
  if (status !== "ongoing") update.finished_at = new Date().toISOString();
  await admin.from("battles").update(update).eq("id", battleId);

  let caughtName: string | null = null;
  if (status === "won") {
    await grantBattleRewards(admin, b);
    // 볼로 잡았거나, (드물게) 도트로 쓰러진 보스가 catchable 인 경우
    if (item.kind === "ball" && st.catchable) caughtName = await catchPokemon(admin, b);
    else if (b.kind === "boss" && st.catchable) caughtName = await catchPokemon(admin, b);
  }

  return {
    ok: true,
    state: st,
    status,
    caughtName,
    rewardXp: status === "won" ? b.reward_xp : 0,
    rewardCoin: status === "won" ? b.reward_coin : 0,
    remainingQty,
  };
}

/** 도망치기: 배틀 종료(보상·포획 없음). 야생은 오늘 기회 소진, 보스는 재도전 가능. */
export async function fleeBattle(battleId: string): Promise<TurnResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("battles").select("*").eq("id", battleId).maybeSingle();
  if (!b || b.student_id !== uid) return { error: "배틀을 찾을 수 없습니다." };
  if (b.status !== "ongoing") return { ok: true, state: b.state, status: b.status };

  const st = b.state as any;
  st.log = [...(st.log ?? []), "무사히 도망쳤다!"].slice(-40);
  await admin
    .from("battles")
    .update({ state: st, status: "fled", finished_at: new Date().toISOString() })
    .eq("id", battleId);

  return { ok: true, state: st, status: "fled" };
}

/** 승리 보상: 활성 포켓몬 경험치 + 코인 (멱등: source_id=battle.id) */
async function grantBattleRewards(admin: Admin, b: any) {
  // 경험치 → 전투한 포켓몬
  if (b.student_pokemon_id && b.reward_xp > 0) {
    const { error: xerr } = await admin.from("xp_events").insert({
      student_pokemon_id: b.student_pokemon_id,
      source_type: "battle",
      source_id: b.id,
      xp_delta: b.reward_xp,
    });
    if (!xerr) {
      const { data: pet } = await admin
        .from("student_pokemon")
        .select("*")
        .eq("id", b.student_pokemon_id)
        .maybeSingle();
      if (pet) {
        const newTotal = pet.xp + b.reward_xp;
        const newLevel = levelForXp(newTotal);
        const { data: stage } = await admin
          .from("evolution_stages")
          .select("species_id")
          .eq("chain_id", pet.chain_id)
          .lte("min_level", newLevel)
          .order("stage_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        await admin
          .from("student_pokemon")
          .update({
            xp: newTotal,
            level: newLevel,
            current_species_id: stage?.species_id ?? pet.current_species_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pet.id);
      }
    }
  }
  // 코인
  if (b.reward_coin > 0) {
    const { error: cerr } = await admin.from("coin_events").insert({
      student_id: b.student_id,
      source_type: "battle",
      source_id: b.id,
      coin_delta: b.reward_coin,
    });
    if (!cerr) {
      const { data: prof } = await admin
        .from("profiles")
        .select("coin_balance")
        .eq("id", b.student_id)
        .maybeSingle();
      await admin
        .from("profiles")
        .update({ coin_balance: (prof?.coin_balance ?? 0) + b.reward_coin })
        .eq("id", b.student_id);
    }
  }
}

/** 포획: 적 종을 컬렉션에 추가 (이미 잡았거나 같은 진화라인 보유 시 skip — 중복 방지) */
async function catchPokemon(admin: Admin, b: any): Promise<string | null> {
  if (b.caught_species_id) return null; // 이미 처리됨
  const { data: stage } = await admin
    .from("evolution_stages")
    .select("chain_id")
    .eq("species_id", b.enemy_species_id)
    .limit(1)
    .maybeSingle();
  if (!stage) return null;

  const { data: dup } = await admin
    .from("student_pokemon")
    .select("id")
    .eq("student_id", b.student_id)
    .eq("chain_id", stage.chain_id)
    .limit(1)
    .maybeSingle();
  if (dup) return null; // 같은 진화라인 이미 보유 — 중복 포획 방지

  await admin.from("student_pokemon").insert({
    student_id: b.student_id,
    chain_id: stage.chain_id,
    current_species_id: b.enemy_species_id,
    level: b.enemy_level,
    xp: xpToReach(b.enemy_level),
    is_active: false,
    acquired_via: "gift",
  });
  await admin.from("battles").update({ caught_species_id: b.enemy_species_id }).eq("id", b.id);

  const { data: sp } = await admin
    .from("pokemon_species")
    .select("name_ko, name")
    .eq("id", b.enemy_species_id)
    .maybeSingle();
  return sp?.name_ko || sp?.name || "포켓몬";
}
