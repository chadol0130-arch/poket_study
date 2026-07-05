import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { CoinBalance } from "@/components/ui/CoinBalance";
import { ShopItem, type ShopItemData } from "@/components/economy/ShopItem";
import { ItemShopCard, type ShopItemInfo } from "@/components/economy/ItemShopCard";

export default async function ShopPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const [{ data: listings }, { data: pets }, { data: gears }, { data: owned }] =
    await Promise.all([
      supabase
        .from("shop_listings")
        .select("id, species_id, chain_id, price, display_order")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("student_pokemon").select("chain_id").eq("student_id", profile.id),
      supabase
        .from("items")
        .select("item_key, name_ko, description, kind, price, effect")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("student_items").select("item_key, qty").eq("student_id", profile.id),
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

  const qtyByKey = new Map<string, number>((owned ?? []).map((o: any) => [o.item_key, o.qty]));
  const gearItems: ShopItemInfo[] = (gears ?? []).map((g: any) => ({
    itemKey: g.item_key,
    nameKo: g.name_ko,
    description: g.description ?? "",
    kind: g.kind,
    price: g.price,
    effect: g.effect,
    ownedQty: qtyByKey.get(g.item_key) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">상점</h1>
          <p className="text-slate-500">숙제로 모은 코인으로 도구와 새 포켓몬을 데려오세요!</p>
        </div>
        <CoinBalance amount={profile.coin_balance} />
      </div>

      {/* 도구 (몬스터볼·상처약) — 배틀에서 사용 */}
      {gearItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">
            🎒 도구 <span className="font-normal">— 배틀에서 사용해요 (야생 포획은 몬스터볼 필수!)</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {gearItems.map((g) => (
              <ItemShopCard key={g.itemKey} item={g} balance={profile.coin_balance} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500">🐾 포켓몬</h2>
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
      </section>
    </div>
  );
}
