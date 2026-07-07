import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { BattleEntry, type BossCard } from "@/components/battle/BattleEntry";
import {
  PvpSection,
  type Classmate,
  type IncomingChallenge,
  type OngoingPvp,
  type OutgoingChallenge,
  type SpectateBattle,
  type RecentPvp,
} from "@/components/battle/PvpSection";
import { SubTabs } from "@/components/SubTabs";
import { POKEMON_TABS } from "@/lib/hubTabs";

export default async function BattlesPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  // 보스/클리어/반 친구(랭킹 RPC)/PvP(열린 것·내 최근 전적·승수) — 서로 독립이라 병렬 조회
  const [
    { data: tgts },
    { data: wonRows },
    { data: mates },
    { data: pvps },
    { data: finished },
    { data: pvpLb },
  ] = await Promise.all([
    supabase
      .from("encounter_targets")
      .select(
        "battle_encounters(id, kind, level, title, reward_xp, reward_coin, is_active, species_id)",
      )
      .eq("student_id", profile.id),
    supabase
      .from("battles")
      .select("encounter_id")
      .eq("student_id", profile.id)
      .eq("status", "won")
      .not("encounter_id", "is", null),
    supabase.rpc("weekly_leaderboard"),
    // 열린 대결: 내 것(도전장/진행) + 반 친구들 것(관전, 0019 RLS)
    supabase
      .from("pvp_battles")
      .select("id, challenger_id, opponent_id, status, current_turn, created_at")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(50),
    // 내 최근 전적 5건
    supabase
      .from("pvp_battles")
      .select("id, challenger_id, opponent_id, status, finished_at")
      .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .in("status", ["won_challenger", "won_opponent"])
      .order("finished_at", { ascending: false })
      .limit(5),
    // 승/패 합계 (0019 RPC — 미적용이면 null, 섹션만 숨김)
    supabase.rpc("pvp_leaderboard"),
  ]);

  const encs = (tgts ?? [])
    .map((t: any) =>
      Array.isArray(t.battle_encounters) ? t.battle_encounters[0] : t.battle_encounters,
    )
    .filter((e: any) => e && e.kind === "boss" && e.is_active);

  const wonSet = new Set((wonRows ?? []).map((w: any) => w.encounter_id));

  const speciesInfo = await getSpeciesInfo(encs.map((e: any) => e.species_id));

  const bosses: BossCard[] = encs.map((e: any) => {
    const info = speciesInfo.get(e.species_id);
    return {
      encounterId: e.id,
      title: e.title ?? "",
      name: info?.nameKo || info?.name || "보스",
      level: e.level,
      rewardXp: e.reward_xp,
      rewardCoin: e.reward_coin,
      won: wonSet.has(e.id),
      spriteUrl: info?.spriteUrl ?? null,
    };
  });

  // 미클리어 먼저, 그다음 레벨 오름차순
  bosses.sort((a, b) => Number(a.won) - Number(b.won) || a.level - b.level);

  // PvP 데이터 (이름은 랭킹 RPC 결과로 해석 — 같은 반만 대결하므로 커버됨)
  const nameById = new Map<string, string>(
    (mates ?? []).map((m: any) => [m.student_id, m.display_name]),
  );
  const classmates: Classmate[] = (mates ?? [])
    .filter((m: any) => !m.is_me)
    .map((m: any) => ({ id: m.student_id, name: m.display_name, level: m.level }));

  const rows = (pvps ?? []) as any[];
  const isMine = (b: any) => b.challenger_id === profile.id || b.opponent_id === profile.id;
  const incoming: IncomingChallenge[] = rows
    .filter((b) => b.status === "pending" && b.opponent_id === profile.id)
    .map((b) => ({ id: b.id, challengerName: nameById.get(b.challenger_id) ?? "친구" }));
  const outgoing: OutgoingChallenge[] = rows
    .filter((b) => b.status === "pending" && b.challenger_id === profile.id)
    .map((b) => ({ id: b.id, opponentName: nameById.get(b.opponent_id) ?? "친구" }));
  const ongoing: OngoingPvp[] = rows
    .filter((b) => b.status === "active" && isMine(b))
    .map((b) => {
      const myRole = b.challenger_id === profile.id ? "challenger" : "opponent";
      const otherId = myRole === "challenger" ? b.opponent_id : b.challenger_id;
      return {
        id: b.id,
        otherName: nameById.get(otherId) ?? "친구",
        myTurn: b.current_turn === myRole,
      };
    });

  // 관전: 반 친구들끼리의 진행 중 대결 (0019 RLS 로 조회됨)
  const spectate: SpectateBattle[] = rows
    .filter((b) => b.status === "active" && !isMine(b))
    .map((b) => ({
      id: b.id,
      aName: nameById.get(b.challenger_id) ?? "친구",
      bName: nameById.get(b.opponent_id) ?? "친구",
    }));

  // 내 전적 (합계 = 0019 RPC의 내 행, 최근 5건 = finished 쿼리)
  const myLb = ((pvpLb ?? []) as any[]).find((r) => r.is_me);
  const record = myLb ? { wins: Number(myLb.wins), losses: Number(myLb.losses) } : null;
  const recent: RecentPvp[] = ((finished ?? []) as any[]).map((b) => {
    const iAmChallenger = b.challenger_id === profile.id;
    const otherId = iAmChallenger ? b.opponent_id : b.challenger_id;
    const won =
      (b.status === "won_challenger" && iAmChallenger) ||
      (b.status === "won_opponent" && !iAmChallenger);
    return {
      id: b.id,
      otherName: nameById.get(otherId) ?? "친구",
      won,
      date: b.finished_at
        ? new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(
            new Date(b.finished_at),
          )
        : "",
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SubTabs tabs={POKEMON_TABS} />
      <div>
        <h1 className="text-2xl font-bold">배틀 ⚔️</h1>
        <p className="text-slate-500">
          친구와 대결하고, 야생 포켓몬을 만나고, 시험 보스에 도전하세요!
        </p>
      </div>
      <PvpSection
        classmates={classmates}
        incoming={incoming}
        ongoing={ongoing}
        outgoing={outgoing}
        spectate={spectate}
        record={record}
        recent={recent}
      />
      <BattleEntry bosses={bosses} />
    </div>
  );
}
