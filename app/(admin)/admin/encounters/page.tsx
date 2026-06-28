import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateBossForm, EncounterToggle } from "@/components/admin/EncountersClient";

export default async function AdminEncountersPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: species }, { data: classes }, { data: bosses }, { data: targets }] =
    await Promise.all([
      supabase
        .from("pokemon_species")
        .select("id, pokedex_number, name, name_ko")
        .order("pokedex_number"),
      supabase.from("classes").select("id, name").order("name"),
      supabase
        .from("battle_encounters")
        .select("id, title, level, encounter_date, is_active, species_id, reward_xp, reward_coin")
        .eq("kind", "boss")
        .order("encounter_date", { ascending: false }),
      supabase.from("encounter_targets").select("encounter_id"),
    ]);

  const speciesOpts = (species ?? []).map((s: any) => ({
    id: s.id,
    label: `#${s.pokedex_number} ${s.name_ko || s.name}`,
  }));
  const nameBySpecies = new Map<string, string>(
    (species ?? []).map((s: any) => [s.id, s.name_ko || s.name]),
  );
  const classOpts = (classes ?? []).map((c: any) => ({ id: c.id, label: c.name }));
  const targetCount = new Map<string, number>();
  (targets ?? []).forEach((t: any) =>
    targetCount.set(t.encounter_id, (targetCount.get(t.encounter_id) ?? 0) + 1),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">보스 배치 👑</h1>
        <p className="text-slate-500">
          시험일 등에 강한 보스를 배치하세요. 학생은 공부로 포켓몬을 키워야 이길 수 있어요.
        </p>
      </div>

      <CreateBossForm species={speciesOpts} classes={classOpts} />

      <div>
        <h2 className="mb-2 font-semibold">배치된 보스</h2>
        <ul className="space-y-2">
          {(bosses ?? []).length === 0 && (
            <li className="text-sm text-slate-400">아직 배치된 보스가 없어요.</li>
          )}
          {(bosses ?? []).map((b: any) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">
                  {b.title || nameBySpecies.get(b.species_id) || "보스"}{" "}
                  <span className="text-sm text-slate-500">
                    ({nameBySpecies.get(b.species_id)} Lv{b.level})
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  📅 {b.encounter_date} · 대상 {targetCount.get(b.id) ?? 0}명 · ⭐ {b.reward_xp} · 🪙{" "}
                  {b.reward_coin}
                </p>
              </div>
              <EncounterToggle encounterId={b.id} isActive={b.is_active} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
