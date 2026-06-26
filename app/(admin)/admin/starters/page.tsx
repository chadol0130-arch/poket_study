import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spriteUrl } from "@/lib/storage";
import { StarterToggle } from "@/components/admin/CatalogClient";
import { PokemonSprite } from "@/components/pokemon/PokemonSprite";

export default async function AdminStartersPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: species }, { data: starters }] = await Promise.all([
    supabase
      .from("pokemon_species")
      .select("id, pokedex_number, name, name_ko, sprites(storage_path, variant)")
      .order("pokedex_number"),
    supabase.from("starter_options").select("species_id, is_active"),
  ]);

  const activeStarter = new Set(
    (starters ?? []).filter((s: any) => s.is_active).map((s: any) => s.species_id),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">스타터 후보</h1>
        <p className="text-slate-500">
          학생이 온보딩에서 첫 포켓몬으로 고를 수 있는 후보를 선택하세요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {(species ?? []).map((s: any) => {
          const def =
            (s.sprites ?? []).find((x: any) => x.variant === "default") ?? s.sprites?.[0];
          return (
            <div
              key={s.id}
              className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-3 text-center"
            >
              <PokemonSprite url={spriteUrl(def?.storage_path)} alt={s.name_ko} size={64} />
              <p className="mt-1 text-sm font-medium">{s.name_ko || s.name}</p>
              <div className="mt-2">
                <StarterToggle speciesId={s.id} isStarter={activeStarter.has(s.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
