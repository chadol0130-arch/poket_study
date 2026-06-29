import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spriteUrl } from "@/lib/storage";
import { levelProgress } from "@/lib/xp";
import { scaleStat, maxHpFor } from "@/lib/battle/engine";
import { selectBattleMoves } from "@/lib/battle/moveset";
import { typeKo, typeColor, categoryKo } from "@/lib/i18n";
import { PokemonManager } from "@/components/pokemon/PokemonManager";

/* eslint-disable @next/next/no-img-element */

const STAT_LABEL: Record<string, string> = {
  hp: "HP",
  attack: "공격",
  defense: "방어",
  special_attack: "특수공격",
  special_defense: "특수방어",
  speed: "스피드",
};
const STAT_ORDER = ["hp", "attack", "defense", "special_attack", "special_defense", "speed"];

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${typeColor(type)}`}>
      {typeKo(type)}
    </span>
  );
}

export default async function PokemonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: pet } = await supabase
    .from("student_pokemon")
    .select("id, current_species_id, chain_id, level, xp, nickname, is_active, acquired_via")
    .eq("id", id)
    .maybeSingle();
  if (!pet) notFound();

  const { data: sp } = await supabase
    .from("pokemon_species")
    .select("id, name, name_ko, type1, type2, base_stats, sprites(storage_path, variant)")
    .eq("id", pet.current_species_id)
    .maybeSingle();
  if (!sp) notFound();

  const sprites = (sp.sprites ?? []) as any[];
  const def = sprites.find((x) => x.variant === "default") ?? sprites[0];
  const url = spriteUrl(def?.storage_path);
  const types = [sp.type1, sp.type2].filter(Boolean) as string[];
  const baseStats = (sp.base_stats ?? {}) as Record<string, number>;
  const label = pet.nickname || sp.name_ko || sp.name;

  // 레벨로 환산한 실제 능력치
  const level = pet.level;
  const realStats: Record<string, number> = {
    hp: maxHpFor(baseStats.hp ?? 0, level),
    attack: scaleStat(baseStats.attack ?? 0, level),
    defense: scaleStat(baseStats.defense ?? 0, level),
    special_attack: scaleStat(baseStats.special_attack ?? 0, level),
    special_defense: scaleStat(baseStats.special_defense ?? 0, level),
    speed: scaleStat(baseStats.speed ?? 0, level),
  };
  const maxStatVal = Math.max(...STAT_ORDER.map((k) => realStats[k]), 1);

  // 학습세트 (현재 종)
  const { data: sm } = await supabase
    .from("species_moves")
    .select("move_key, level_learned")
    .eq("species_id", pet.current_species_id)
    .order("level_learned");
  const learnset = sm ?? [];
  const keys = learnset.map((r: any) => r.move_key);

  const moveById = new Map<string, any>();
  if (keys.length) {
    const { data: md } = await supabase
      .from("moves")
      .select("move_key, name_ko, power, move_type, category, accuracy, pp, description")
      .in("move_key", keys);
    (md ?? []).forEach((m: any) => moveById.set(m.move_key, m));
  }

  const learned = learnset
    .filter((r: any) => r.level_learned <= level)
    .map((r: any) => ({ ...r, mv: moveById.get(r.move_key) }))
    .filter((r: any) => r.mv)
    .sort((a: any, b: any) => b.level_learned - a.level_learned);

  // 배틀에서 실제로 쓰는 기술(요약·배틀 공용 규칙) — 두 화면이 항상 일치
  const battleFlat = selectBattleMoves(
    learned.map((r: any) => ({ level_learned: r.level_learned, power: r.mv.power, r })),
  );
  const battleKeys = new Set(battleFlat.map((x: any) => x.r.move_key));
  const battleMoves = battleFlat.map((x: any) => x.r);
  const otherLearned = learned.filter((r: any) => !battleKeys.has(r.move_key));

  const upcoming = learnset
    .filter((r: any) => r.level_learned > level)
    .map((r: any) => ({ ...r, mv: moveById.get(r.move_key) }))
    .filter((r: any) => r.mv);

  const prog = levelProgress(pet.xp);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/my-pokemon" className="text-sm text-poke-blue">
        ← 내 포켓몬
      </Link>

      {/* 헤더 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50 to-white p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-white">
            {url ? (
              <img src={url} alt={label} className="h-24 w-24 object-contain" style={{ imageRendering: "pixelated" }} />
            ) : (
              <span className="text-5xl">❓</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{label}</h1>
              {pet.is_active && (
                <span className="rounded-full bg-poke-red px-2 py-0.5 text-[10px] font-bold text-white">
                  대표
                </span>
              )}
            </div>
            {pet.nickname && (
              <p className="text-sm text-slate-400">{sp.name_ko || sp.name}</p>
            )}
            <p className="mt-0.5 text-sm font-semibold text-slate-600">Lv. {level}</p>
            <div className="mt-1 flex gap-1">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </div>

        {/* 경험치 */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>다음 레벨까지</span>
            <span>
              {prog.inLevelXp} / {prog.neededXp} XP
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-poke-yellow" style={{ width: `${prog.pct * 100}%` }} />
          </div>
        </div>
      </div>

      {/* 능력치 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">능력치 <span className="text-xs font-normal text-slate-400">(레벨 환산)</span></h2>
        <div className="space-y-2">
          {STAT_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-slate-500">{STAT_LABEL[k]}</span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                {realStats[k]}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-poke-blue"
                  style={{ width: `${Math.round((realStats[k] / maxStatVal) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 배틀에서 쓰는 기술 (요약·배틀 동일) */}
      <div className="rounded-2xl border border-poke-red/30 bg-white p-4">
        <h2 className="font-bold">
          배틀 기술 <span className="text-xs font-normal text-slate-400">⚔️ 배틀에서 이 {battleMoves.length}개를 사용</span>
        </h2>
        {battleMoves.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">아직 공격 기술이 없어요. 레벨을 올려 기술을 배워보세요!</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {battleMoves.map((r: any) => (
              <li key={r.move_key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.mv.name_ko}</span>
                    <TypeBadge type={r.mv.move_type} />
                    <span className="text-xs text-slate-400">{categoryKo(r.mv.category)}</span>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    {r.mv.power > 0 ? `위력 ${r.mv.power}` : "변화"} · PP {r.mv.pp}
                  </div>
                </div>
                {r.mv.description && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.mv.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 그 외 익힌 기술 (배틀 미사용 — 변화기술/낮은 위력 등) */}
      {otherLearned.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-bold">그 외 익힌 기술</h2>
          <p className="mb-3 text-xs text-slate-400">배운 적은 있지만 지금 배틀 기술 4개에는 빠진 기술이에요.</p>
          <ul className="space-y-1.5">
            {otherLearned.map((r: any) => (
              <li
                key={r.move_key}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">{r.mv.name_ko}</span>
                  <TypeBadge type={r.mv.move_type} />
                  <span className="text-xs text-slate-400">{categoryKo(r.mv.category)}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {r.mv.power > 0 ? `위력 ${r.mv.power}` : "변화"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 앞으로 배울 기술 */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-bold">앞으로 배울 기술</h2>
          <p className="mb-3 text-xs text-slate-400">레벨을 올리면 새 기술을 배워요! 💪</p>
          <ul className="space-y-1.5">
            {upcoming.map((r: any) => (
              <li
                key={r.move_key}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-semibold text-poke-blue">
                    Lv{r.level_learned}
                  </span>
                  <span className="text-slate-600">{r.mv.name_ko}</span>
                  <TypeBadge type={r.mv.move_type} />
                </div>
                <span className="text-xs text-slate-400">
                  {r.mv.power > 0 ? `위력 ${r.mv.power}` : "변화"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 관리(별명/대표) */}
      <PokemonManager
        petId={pet.id}
        currentNickname={pet.nickname ?? ""}
        isActive={pet.is_active}
      />
    </div>
  );
}
