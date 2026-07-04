import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { CoinBalance } from "@/components/ui/CoinBalance";
import { ShopItem, type ShopItemData } from "@/components/economy/ShopItem";

export default async function ShopPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const [{ data: listings }, { data: pets }] = await Promise.all([
    supabase
      .from("shop_listings")
      .select("id, species_id, chain_id, price, display_order")
      .eq("is_active", true)
      .order("display_order"),
    supabase.from("student_pokemon").select("chain_id").eq("student_id", profile.id),
  ]);
  const ownedChains = new Set((pets ?? []).map((p: any) => p.chain_id));

  const info = await getSpeciesInfo((listings ?? []).map((l: any) => l.species_id));

  const items: ShopItemData[] = (listings ?? []).map((l: any) => {
    const s = info.get(l.species_id);
    return {
      listingId: l.id,
      nameKo: s?.nameKo ?? "",
      name: s?.name ?? "",
      spriteUrl: s?.spriteUrl ?? null,
      price: l.price,
      alreadyOwned: ownedChains.has(l.chain_id),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">상점</h1>
          <p className="text-slate-500">숙제로 모은 코인으로 새 포켓몬을 데려오세요!</p>
        </div>
        <CoinBalance amount={profile.coin_balance} />
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          판매 중인 포켓몬이 없어요.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <ShopItem key={item.listingId} item={item} balance={profile.coin_balance} />
          ))}
        </div>
      )}
    </div>
  );
}
