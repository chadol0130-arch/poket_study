import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PvpArena } from "@/components/battle/PvpArena";

export default async function PvpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("pvp_battles")
    .select("id, challenger_id, opponent_id, status, current_turn, turn_no, state, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  const myRole =
    b.challenger_id === profile.id
      ? "challenger"
      : b.opponent_id === profile.id
        ? "opponent"
        : null;
  // 비참가자인데 RLS 를 통과했다 = 같은 반(0019) → 관전 모드 (challenger 시점)
  const spectator = myRole === null;
  if (b.status === "pending" || b.status === "declined") redirect("/battles");

  return (
    <PvpArena
      battleId={b.id}
      myRole={myRole ?? "challenger"}
      initialState={b.state}
      initialStatus={b.status}
      initialTurn={b.current_turn}
      initialTurnNo={b.turn_no}
      initialUpdatedAt={b.updated_at}
      spectator={spectator}
    />
  );
}
