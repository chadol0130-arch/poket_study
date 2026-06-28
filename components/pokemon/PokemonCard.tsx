import { PokemonSprite } from "./PokemonSprite";
import { XpBar } from "@/components/ui/XpBar";

export interface PokemonCardData {
  nameKo: string;
  name: string;
  nickname?: string | null;
  spriteUrl: string | null;
  xp: number;
  isActive?: boolean;
  acquiredVia?: string;
}

/** 소유 포켓몬 한 마리를 보여주는 카드. */
export function PokemonCard({
  data,
  footer,
}: {
  data: PokemonCardData;
  footer?: React.ReactNode;
}) {
  const label = data.nickname || data.nameKo || data.name;
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border bg-white p-4 shadow-sm transition ${
        data.isActive ? "border-poke-red ring-2 ring-poke-red/30" : "border-slate-200"
      }`}
    >
      {data.isActive && (
        <span className="mb-1 rounded-full bg-poke-red px-2 py-0.5 text-[10px] font-bold text-white">
          대표
        </span>
      )}
      <PokemonSprite url={data.spriteUrl} alt={label} size={96} />
      <p className="mt-2 text-center font-semibold">{label}</p>
      {data.nickname && (
        <p className="text-center text-xs text-slate-400">{data.nameKo || data.name}</p>
      )}
      <div className="mt-3 w-full">
        <XpBar xp={data.xp} />
      </div>
      {footer && <div className="mt-3 w-full">{footer}</div>}
    </div>
  );
}
