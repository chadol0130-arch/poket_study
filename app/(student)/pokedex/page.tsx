import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spriteUrl } from "@/lib/storage";
import { PokemonSprite } from "@/components/pokemon/PokemonSprite";
import { SubTabs } from "@/components/SubTabs";
import { POKEMON_TABS } from "@/lib/hubTabs";

export default async function PokedexPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const [{ data: species }, { data: pets }, { data: stages }] = await Promise.all([
    supabase
      .from("pokemon_species")
      .select("id, pokedex_number, name, name_ko, sprites(storage_path, variant)")
      .order("pokedex_number"),
    supabase.from("student_pokemon").select("chain_id").eq("student_id", profile.id),
    supabase.from("evolution_stages").select("species_id, chain_id"),
  ]);

  // 보유한 진화 체인 → 그 체인의 모든 종을 "발견됨"으로 처리(라인 전체 공개).
  const ownedChains = new Set((pets ?? []).map((p: any) => p.chain_id));
  const discovered = new Set(
    (stages ?? [])
      .filter((s: any) => ownedChains.has(s.chain_id))
      .map((s: any) => s.species_id),
  );

  const total = species?.length ?? 0;
  const found = (species ?? []).filter((s: any) => discovered.has(s.id)).length;

  return (
    <div className="space-y-4">
      <SubTabs tabs={POKEMON_TABS} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">포켓몬 도감</h1>
          <p className="text-slate-500">
            모은 포켓몬은 컬러로, 아직 못 모은 포켓몬은 실루엣으로 보여요.
          </p>
        </div>
        <span className="rounded-full bg-poke-blue/10 px-3 py-1 text-sm font-bold text-poke-blue">
          {found} / {total}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
        {(species ?? []).map((s: any) => {
          const def =
            (s.sprites ?? []).find((x: any) => x.variant === "default") ?? s.sprites?.[0];
          const isFound = discovered.has(s.id);
          return (
            <div
              key={s.id}
              className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-2 text-center"
            >
              <PokemonSprite
                url={spriteUrl(def?.storage_path)}
                alt={s.name_ko || s.name}
                size={72}
                silhouette={!isFound}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                No.{String(s.pokedex_number).padStart(3, "0")}
              </p>
              <p className="text-xs font-medium">
                {isFound ? s.name_ko || s.name : "???"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
