import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spriteUrl } from "@/lib/storage";
import { SeedForm } from "@/components/admin/CatalogClient";
import { PokemonSprite } from "@/components/pokemon/PokemonSprite";

export default async function AdminPokemonPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: species } = await supabase
    .from("pokemon_species")
    .select("id, pokedex_number, name, name_ko, type1, type2, sprites(storage_path, variant)")
    .order("pokedex_number");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">포켓몬 데이터</h1>
        <p className="text-slate-500">
          스프라이트 이미지는 Supabase Storage 의 <code>pokemon-sprites</code> 버킷에
          업로드한 뒤, 아래에서 데이터를 등록하세요.
        </p>
      </div>

      <SeedForm />

      <div>
        <h2 className="mb-2 font-semibold">등록된 종 ({species?.length ?? 0})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {(species ?? []).map((s: any) => {
            const def =
              (s.sprites ?? []).find((x: any) => x.variant === "default") ??
              s.sprites?.[0];
            return (
              <div
                key={s.id}
                className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-2 text-center"
              >
                <PokemonSprite url={spriteUrl(def?.storage_path)} alt={s.name_ko} size={64} />
                <p className="mt-1 text-xs font-medium">{s.name_ko || s.name}</p>
                <p className="text-[10px] text-slate-400">#{s.pokedex_number}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
