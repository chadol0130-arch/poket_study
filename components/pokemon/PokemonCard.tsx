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
  topNotice,
}: {
  data: PokemonCardData;
  footer?: React.ReactNode;
  /** "대표" 칸과 포켓몬 사이에 끼워 넣는 영역(예: 질문 "!" 말풍선) */
  topNotice?: React.ReactNode;
}) {
  const label = data.nickname || data.nameKo || data.name;
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border bg-white p-4 shadow-sm transition ${
        data.isActive ? "border-poke-red ring-2 ring-poke-red/30" : "border-slate-200"
      }`}
    >
      {data.isActive && (
        <span className="rounded-full bg-poke-red px-2 py-0.5 text-[10px] font-bold text-white">
          대표
        </span>
      )}
      {/* 대표 ↔ 포켓몬 사이 영역: 알림이 있으면 넉넉한 간격, 없으면 기본 간격 */}
      {topNotice ? (
        <div className="flex h-10 items-center justify-center py-1">{topNotice}</div>
      ) : (
        <div className="h-2" />
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
