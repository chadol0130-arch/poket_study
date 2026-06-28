import { levelProgress } from "@/lib/xp";

/** 누적 경험치를 받아 현재 레벨과 다음 레벨까지의 진행률을 보여준다. */
export function XpBar({ xp }: { xp: number }) {
  const p = levelProgress(xp);
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Lv. {p.level}</span>
        <span>
          {p.inLevelXp} / {p.neededXp} XP
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="xp-fill h-full rounded-full bg-gradient-to-r from-poke-yellow to-poke-red"
          style={{ width: `${Math.round(p.pct * 100)}%` }}
        />
      </div>
    </div>
  );
}
