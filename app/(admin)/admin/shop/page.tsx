import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spriteUrl } from "@/lib/storage";
import { ShopForm } from "@/components/admin/CatalogClient";
import { PokemonSprite } from "@/components/pokemon/PokemonSprite";

export default async function AdminShopPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: species }, { data: listings }] = await Promise.all([
    supabase
      .from("pokemon_species")
      .select("id, pokedex_number, name, name_ko, sprites(storage_path, variant)")
      .order("pokedex_number"),
    supabase.from("shop_listings").select("id, species_id, price, is_active"),
  ]);

  const listingBySpecies = new Map<string, any>(
    (listings ?? []).map((l: any) => [l.species_id, l]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">상점 관리</h1>
        <p className="text-slate-500">가격을 정하고 판매중으로 두면 학생 상점에 노출됩니다.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {(species ?? []).map((s: any) => {
              const def =
                (s.sprites ?? []).find((x: any) => x.variant === "default") ?? s.sprites?.[0];
              const listing = listingBySpecies.get(s.id);
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="w-16 px-3 py-2">
                    <PokemonSprite url={spriteUrl(def?.storage_path)} alt={s.name_ko} size={48} />
                  </td>
                  <td className="px-3 py-2 font-medium">{s.name_ko || s.name}</td>
                  <td className="px-3 py-2 text-right">
                    <ShopForm
                      speciesId={s.id}
                      listingId={listing?.id}
                      currentPrice={listing?.price ?? 100}
                      isActive={listing?.is_active ?? false}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
