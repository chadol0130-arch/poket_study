import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BattleArena } from "@/components/battle/BattleArena";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: battle } = await supabase
    .from("battles")
    .select("id, state, status")
    .eq("id", id)
    .maybeSingle();
  if (!battle) notFound();

  return (
    <BattleArena
      battleId={battle.id}
      initialState={battle.state}
      initialStatus={battle.status}
    />
  );
}
