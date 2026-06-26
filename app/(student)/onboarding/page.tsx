import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { StarterPicker, type StarterChoice } from "@/components/economy/StarterPicker";

export default async function OnboardingPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  // 이미 포켓몬이 있으면 온보딩 불필요.
  const { count } = await supabase
    .from("student_pokemon")
    .select("id", { count: "exact", head: true })
    .eq("student_id", profile.id);
  if ((count ?? 0) > 0) redirect("/dashboard");

  const { data: options } = await supabase
    .from("starter_options")
    .select("species_id, display_order")
    .eq("is_active", true)
    .order("display_order");

  const speciesIds = (options ?? []).map((o: any) => o.species_id);
  const info = await getSpeciesInfo(speciesIds);

  const choices: StarterChoice[] = (options ?? [])
    .map((o: any) => info.get(o.species_id))
    .filter(Boolean)
    .map((s: any) => ({
      speciesId: s.id,
      nameKo: s.nameKo,
      name: s.name,
      spriteUrl: s.spriteUrl,
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">첫 포켓몬을 골라보세요!</h1>
        <p className="mt-1 text-slate-500">
          숙제를 검사받으면 이 포켓몬이 경험치와 코인을 얻어요.
        </p>
      </div>

      {choices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          아직 선택할 수 있는 스타터가 없어요. 관리자에게 문의하세요.
        </p>
      ) : (
        <StarterPicker choices={choices} />
      )}
    </div>
  );
}
