import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BattleArena, type InvItem } from "@/components/battle/BattleArena";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const [{ data: battle }, { data: items }, { data: owned }] = await Promise.all([
    supabase.from("battles").select("id, kind, state, status").eq("id", id).maybeSingle(),
    supabase
      .from("items")
      .select("item_key, name_ko, description, kind, effect")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("student_items")
      .select("item_key, qty")
      .eq("student_id", profile.id),
  ]);
  if (!battle) notFound();

  // 활성 도구 전체를 보유 수량과 함께 (0개도 표시해 상점 유도)
  const qtyByKey = new Map<string, number>((owned ?? []).map((o: any) => [o.item_key, o.qty]));
  const inventory: InvItem[] = (items ?? []).map((it: any) => ({
    itemKey: it.item_key,
    nameKo: it.name_ko,
    description: it.description ?? "",
    kind: it.kind,
    effect: it.effect,
    qty: qtyByKey.get(it.item_key) ?? 0,
  }));

  return (
    <BattleArena
      battleId={battle.id}
      initialState={battle.state}
      initialStatus={battle.status}
      kind={battle.kind}
      inventory={inventory}
    />
  );
}
