import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { BattleEntry, type BossCard } from "@/components/battle/BattleEntry";

export default async function BattlesPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  // 나에게 배치된 활성 보스 (날짜 무관)
  const { data: tgts } = await supabase
    .from("encounter_targets")
    .select(
      "battle_encounters(id, kind, level, title, reward_xp, reward_coin, is_active, species_id)",
    )
    .eq("student_id", profile.id);

  const encs = (tgts ?? [])
    .map((t: any) =>
      Array.isArray(t.battle_encounters) ? t.battle_encounters[0] : t.battle_encounters,
    )
    .filter((e: any) => e && e.kind === "boss" && e.is_active);

  // 클리어한 보스
  const { data: wonRows } = await supabase
    .from("battles")
    .select("encounter_id")
    .eq("student_id", profile.id)
    .eq("status", "won")
    .not("encounter_id", "is", null);
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">배틀 ⚔️</h1>
        <p className="text-slate-500">
          야생 포켓몬과 만나거나 시험 보스에 도전하세요. 공부로 강해질수록 이기기 쉬워져요!
        </p>
      </div>
      <BattleEntry bosses={bosses} />
    </div>
  );
}
