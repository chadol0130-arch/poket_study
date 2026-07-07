"use server";

// 학생 1:1 실시간 대전 — 도전장(같은 반, 하루 3회·상대당 1회) → 수락 → 교대 턴제.
// 모든 쓰기는 service-role(치팅 방지), 검증은 세션 uid 기준. 동시성은 turn_no CAS,
// 보상 멱등은 status='active' 원자 플립이 보장한다.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { levelForXp } from "@/lib/xp";
import { effectiveSpeed, type Combatant } from "@/lib/battle/engine";
import { type Admin, buildCombatant, loadTypeChart } from "@/lib/battle/build";
import { pvpAction } from "@/lib/battle/turn";

const WINNER_XP = 20;
const LOSER_XP = 5;
const DAILY_CHALLENGES = 3;
const TURN_TIMEOUT_MS = 60_000;
const CHALLENGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

type Role = "challenger" | "opponent";
const other = (r: Role): Role => (r === "challenger" ? "opponent" : "challenger");

async function currentUid(): Promise<string | null> {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  return user?.id ?? null;
}

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function roleOf(b: any, uid: string): Role | null {
  if (b.challenger_id === uid) return "challenger";
  if (b.opponent_id === uid) return "opponent";
  return null;
}

async function notify(admin: Admin, userId: string, title: string, body: string, href: string) {
  await admin.from("notifications").insert({ user_id: userId, kind: "pvp", title, body, href });
}

async function displayName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("display_name, full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name || data?.full_name || "친구";
}

export type PvpResult = { ok: true; battleId?: string } | { error: string };

/** 같은 반 친구에게 도전장 보내기 */
export async function createChallenge(opponentId: string): Promise<PvpResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  if (opponentId === uid) return { error: "자기 자신에게는 도전할 수 없어요." };
  const admin = createAdminClient();

  // 같은 반 검증 (enrollments self-join)
  const { data: myEnr } = await admin
    .from("enrollments")
    .select("class_id")
    .eq("student_id", uid)
    .eq("status", "active");
  const classIds = (myEnr ?? []).map((e: any) => e.class_id);
  if (classIds.length === 0) return { error: "반에 등록된 학생만 대결할 수 있어요." };
  const { data: sameClass } = await admin
    .from("enrollments")
    .select("id")
    .eq("student_id", opponentId)
    .eq("status", "active")
    .in("class_id", classIds)
    .limit(1)
    .maybeSingle();
  if (!sameClass) return { error: "같은 반 친구에게만 도전할 수 있어요." };

  // 하루 제한 (KST): 총 3회 + 같은 상대 1회
  const today = todayKST();
  const { data: todays } = await admin
    .from("pvp_battles")
    .select("id, opponent_id")
    .eq("challenger_id", uid)
    .gte("created_at", `${today}T00:00:00+09:00`)
    .lte("created_at", `${today}T23:59:59+09:00`);
  if ((todays ?? []).length >= DAILY_CHALLENGES)
    return { error: `오늘 도전 ${DAILY_CHALLENGES}회를 모두 썼어요. 내일 다시 도전해요!` };
  if ((todays ?? []).some((t: any) => t.opponent_id === opponentId))
    return { error: "같은 친구에게는 하루에 한 번만 도전할 수 있어요." };

  // 둘 사이에 열린 대결이 이미 있으면 금지 (양방향)
  const { data: open } = await admin
    .from("pvp_battles")
    .select("id")
    .or(
      `and(challenger_id.eq.${uid},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${uid})`,
    )
    .in("status", ["pending", "active"])
    .limit(1)
    .maybeSingle();
  if (open) return { error: "이 친구와는 이미 진행 중인 대결(또는 도전장)이 있어요." };

  const { data: myPet } = await admin
    .from("student_pokemon")
    .select("id")
    .eq("student_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!myPet) return { error: "대표 포켓몬이 없어요. 먼저 스타터를 선택하세요." };

  const { error } = await admin.from("pvp_battles").insert({
    challenger_id: uid,
    opponent_id: opponentId,
    challenger_pokemon_id: myPet.id,
  });
  if (error) return { error: error.message };

  const myName = await displayName(admin, uid);
  await notify(admin, opponentId, "⚔️ 대결 신청!", `${myName}이(가) 배틀을 걸어왔어요! 수락하러 가볼까요?`, "/battles");
  return { ok: true };
}

/** 도전장 수락/거절 (opponent 본인만) */
export async function respondChallenge(battleId: string, accept: boolean): Promise<PvpResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("pvp_battles").select("*").eq("id", battleId).maybeSingle();
  if (!b || b.opponent_id !== uid) return { error: "도전장을 찾을 수 없습니다." };
  if (b.status !== "pending") return { error: "이미 처리된 도전장이에요." };

  const cName = await displayName(admin, b.challenger_id);
  const oName = await displayName(admin, b.opponent_id);

  // 만료(24시간)
  if (Date.now() - new Date(b.created_at).getTime() > CHALLENGE_EXPIRY_MS) {
    await admin.from("pvp_battles").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", battleId);
    return { error: "만료된 도전장이에요." };
  }

  if (!accept) {
    await admin.from("pvp_battles").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", battleId);
    await notify(admin, b.challenger_id, "대결이 거절됐어요", `${oName}이(가) 다음을 기약했어요.`, "/battles");
    return { ok: true };
  }

  // 양측 대표 포켓몬 (수락 시점 기준으로 최신)
  const [{ data: cPet }, { data: oPet }] = await Promise.all([
    admin.from("student_pokemon").select("*").eq("student_id", b.challenger_id).eq("is_active", true).maybeSingle(),
    admin.from("student_pokemon").select("*").eq("student_id", b.opponent_id).eq("is_active", true).maybeSingle(),
  ]);
  if (!oPet) return { error: "대표 포켓몬이 없어요. 먼저 스타터를 선택하세요." };
  if (!cPet) {
    await admin.from("pvp_battles").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", battleId);
    return { error: "도전자의 대표 포켓몬이 없어 대결이 취소됐어요." };
  }

  const [cComb, oComb] = await Promise.all([
    buildCombatant(admin, cPet.current_species_id, cPet.level),
    buildCombatant(admin, oPet.current_species_id, oPet.level),
  ]);

  const cFirst =
    effectiveSpeed(cComb) > effectiveSpeed(oComb) ||
    (effectiveSpeed(cComb) === effectiveSpeed(oComb) && Math.random() < 0.5);
  const firstRole: Role = cFirst ? "challenger" : "opponent";
  const state = {
    challenger: cComb,
    opponent: oComb,
    playerNames: { challenger: cName, opponent: oName },
    log: [
      `⚔️ ${cName}의 ${cComb.name} vs ${oName}의 ${oComb.name} — 대결 시작!`,
      `${firstRole === "challenger" ? cComb.name : oComb.name}이(가) 더 빠르다! 선공!`,
    ],
  };

  const { error } = await admin
    .from("pvp_battles")
    .update({
      status: "active",
      state,
      current_turn: firstRole,
      challenger_pokemon_id: cPet.id,
      opponent_pokemon_id: oPet.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", battleId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  await notify(admin, b.challenger_id, "🔥 대결 수락!", `${oName}이(가) 도전을 받아들였어요! 대결장으로!`, `/pvp/${battleId}`);
  return { ok: true, battleId };
}

export interface PvpTurnResult {
  ok?: true;
  error?: string;
  state?: any;
  status?: string;
  currentTurn?: string | null;
  turnNo?: number;
}

function snapshot(b: any): PvpTurnResult {
  return { ok: true, state: b.state, status: b.status, currentTurn: b.current_turn, turnNo: b.turn_no };
}

/** 승자/패자 XP 지급 + 알림 (status 원자 플립에 성공한 호출만 이 함수에 도달 → 멱등) */
async function grantPvpXp(admin: Admin, b: any, winner: Role, loserXp: number) {
  const winnerPetId = winner === "challenger" ? b.challenger_pokemon_id : b.opponent_pokemon_id;
  const loserPetId = winner === "challenger" ? b.opponent_pokemon_id : b.challenger_pokemon_id;
  const winnerUid = winner === "challenger" ? b.challenger_id : b.opponent_id;
  const loserUid = winner === "challenger" ? b.opponent_id : b.challenger_id;

  async function award(petId: string | null, xp: number) {
    if (!petId || xp <= 0) return;
    const { error } = await admin.from("xp_events").insert({
      student_pokemon_id: petId,
      source_type: "pvp",
      source_id: crypto.randomUUID(),
      xp_delta: xp,
    });
    if (error) return;
    const { data: pet } = await admin.from("student_pokemon").select("*").eq("id", petId).maybeSingle();
    if (!pet) return;
    const newTotal = pet.xp + xp;
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
      .eq("id", petId);
  }

  await award(winnerPetId, WINNER_XP);
  await award(loserPetId, loserXp);
  await notify(admin, winnerUid, "🏆 대결 승리!", `+${WINNER_XP} XP! 주간 랭킹에도 반영돼요.`, `/pvp/${b.id}`);
  await notify(
    admin,
    loserUid,
    "대결 패배…",
    loserXp > 0 ? `아쉽다! 참가 보상 +${loserXp} XP. 더 키워서 복수전!` : "다음엔 이길 수 있어!",
    `/pvp/${b.id}`,
  );
}

/** 한 행동 실행 (본인 턴 or 타임아웃 대리턴). moveKey=null 이면 랜덤(부재자 자동 진행). */
async function runAction(
  admin: Admin,
  b: any,
  actorRole: Role,
  moveKey: string | null,
): Promise<PvpTurnResult> {
  const st = b.state as any;
  const attacker = st[actorRole] as Combatant;
  const defender = st[other(actorRole)] as Combatant;

  const key =
    moveKey ?? attacker.moves[Math.floor(Math.random() * attacker.moves.length)].key;
  if (!attacker.moves.find((m) => m.key === key)) return { error: "사용할 수 없는 기술이에요." };

  const chart = await loadTypeChart(admin);
  const res = pvpAction(attacker, defender, key, chart);
  st[actorRole] = res.attacker;
  st[other(actorRole)] = res.defender;
  st.log = [...(st.log ?? []), ...res.log].slice(-40);

  let winner: Role | null = null;
  if (res.defender.hp <= 0) winner = actorRole;
  else if (res.attacker.hp <= 0) winner = other(actorRole);

  if (!winner) {
    // 턴 넘기기 — turn_no CAS 로 경합 방지
    const { data: row } = await admin
      .from("pvp_battles")
      .update({
        state: st,
        current_turn: other(actorRole),
        turn_no: b.turn_no + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", b.id)
      .eq("turn_no", b.turn_no)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!row) {
      const { data: fresh } = await admin.from("pvp_battles").select("*").eq("id", b.id).maybeSingle();
      return fresh ? snapshot(fresh) : { error: "배틀을 찾을 수 없습니다." };
    }
    return { ok: true, state: st, status: "active", currentTurn: other(actorRole), turnNo: b.turn_no + 1 };
  }

  // 종료 — status 원자 플립(성공한 호출만 보상)
  const winName = (winner === "challenger" ? st.challenger : st.opponent).name;
  st.log = [...st.log, `${winName}의 승리! 🎉`].slice(-40);
  const newStatus = winner === "challenger" ? "won_challenger" : "won_opponent";
  const { data: flipped } = await admin
    .from("pvp_battles")
    .update({
      state: st,
      status: newStatus,
      current_turn: null,
      turn_no: b.turn_no + 1,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id)
    .eq("turn_no", b.turn_no)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (flipped) await grantPvpXp(admin, b, winner, LOSER_XP);

  return { ok: true, state: st, status: newStatus, currentTurn: null, turnNo: b.turn_no + 1 };
}

/** 내 턴 진행 */
export async function pvpTurn(battleId: string, moveKey: string): Promise<PvpTurnResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("pvp_battles").select("*").eq("id", battleId).maybeSingle();
  if (!b) return { error: "배틀을 찾을 수 없습니다." };
  const role = roleOf(b, uid);
  if (!role) return { error: "참가자가 아니에요." };
  if (b.status !== "active") return snapshot(b);
  if (b.current_turn !== role) return { error: "지금은 상대 차례예요." };

  return runAction(admin, b, role, moveKey);
}

/** 상대 60초+ 무응답 시 대기자가 호출 — 부재자 기술을 랜덤으로 대신 실행 */
export async function pvpTimeoutTurn(battleId: string): Promise<PvpTurnResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("pvp_battles").select("*").eq("id", battleId).maybeSingle();
  if (!b) return { error: "배틀을 찾을 수 없습니다." };
  const role = roleOf(b, uid);
  if (!role) return { error: "참가자가 아니에요." };
  if (b.status !== "active") return snapshot(b);
  if (b.current_turn === role) return { error: "지금은 내 차례예요 — 기술을 고르세요!" };
  if (Date.now() - new Date(b.updated_at).getTime() < TURN_TIMEOUT_MS)
    return { error: "아직 상대의 시간이 남아 있어요. 조금만 기다려요!" };

  return runAction(admin, b, other(role), null);
}

/** 기권 — 상대 승리 (기권자는 보상 없음) */
export async function forfeitPvp(battleId: string): Promise<PvpTurnResult> {
  const uid = await currentUid();
  if (!uid) return { error: "로그인이 필요합니다." };
  const admin = createAdminClient();

  const { data: b } = await admin.from("pvp_battles").select("*").eq("id", battleId).maybeSingle();
  if (!b) return { error: "배틀을 찾을 수 없습니다." };
  const role = roleOf(b, uid);
  if (!role) return { error: "참가자가 아니에요." };
  if (b.status !== "active") return snapshot(b);

  const winner = other(role);
  const st = b.state as any;
  const myName = st.playerNames?.[role] ?? "상대";
  st.log = [...(st.log ?? []), `🏳️ ${myName}이(가) 기권했다!`].slice(-40);
  const newStatus = winner === "challenger" ? "won_challenger" : "won_opponent";
  const { data: flipped } = await admin
    .from("pvp_battles")
    .update({
      state: st,
      status: newStatus,
      current_turn: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (flipped) await grantPvpXp(admin, b, winner, 0);

  const { data: fresh } = await admin.from("pvp_battles").select("*").eq("id", battleId).maybeSingle();
  return fresh ? snapshot(fresh) : { ok: true, status: newStatus };
}
