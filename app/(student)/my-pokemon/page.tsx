import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesInfo } from "@/lib/queries";
import { CollectionGrid, type CollectionPet } from "@/components/pokemon/CollectionGrid";

export default async function MyPokemonPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: pets } = await supabase
    .from("student_pokemon")
    .select("*")
    .eq("student_id", profile.id)
    .order("created_at");

  if (!pets || pets.length === 0) {
    return (
      <div className="text-center">
        <p className="text-slate-500">아직 포켓몬이 없어요.</p>
        <Link href="/onboarding" className="mt-2 inline-block text-poke-blue">
          스타터 선택하러 가기 →
        </Link>
      </div>
    );
  }

  const info = await getSpeciesInfo(pets.map((p: any) => p.current_species_id));

  const collection: CollectionPet[] = pets.map((p: any) => {
    const s = info.get(p.current_species_id);
    return {
      id: p.id,
      nameKo: s?.nameKo ?? "",
      name: s?.name ?? "",
      nickname: p.nickname,
      spriteUrl: s?.spriteUrl ?? null,
      xp: p.xp,
      isActive: p.is_active,
      acquiredVia: p.acquired_via,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">내 포켓몬</h1>
        <p className="text-slate-500">
          카드를 누르면 능력치·기술을 보고 별명·대표를 바꿀 수 있어요. 대표 포켓몬에게만 숙제 경험치가 들어가요.
        </p>
      </div>
      <CollectionGrid pets={collection} />
    </div>
  );
}
