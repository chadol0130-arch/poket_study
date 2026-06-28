import { createClient } from "@/lib/supabase/server";
import { spriteUrl } from "@/lib/storage";

export interface SpeciesInfo {
  id: string;
  name: string;
  nameKo: string;
  spriteUrl: string | null;
}

/** 여러 종의 표시 정보(이름 + 기본 스프라이트 URL)를 한 번에 조회. */
export async function getSpeciesInfo(
  ids: string[],
): Promise<Map<string, SpeciesInfo>> {
  const map = new Map<string, SpeciesInfo>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pokemon_species")
    .select("id, name, name_ko, sprites(storage_path, variant)")
    .in("id", unique);

  (data ?? []).forEach((s: any) => {
    const sprites = s.sprites ?? [];
    const def = sprites.find((x: any) => x.variant === "default") ?? sprites[0];
    map.set(s.id, {
      id: s.id,
      name: s.name,
      nameKo: s.name_ko,
      spriteUrl: spriteUrl(def?.storage_path),
    });
  });
  return map;
}
