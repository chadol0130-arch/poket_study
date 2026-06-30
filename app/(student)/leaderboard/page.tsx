import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubTabs } from "@/components/SubTabs";
import { POKEMON_TABS } from "@/lib/hubTabs";

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("weekly_leaderboard");
  const list = (rows ?? []) as any[];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <SubTabs tabs={POKEMON_TABS} />
      <div>
        <h1 className="text-2xl font-bold">주간 랭킹 🏆</h1>
        <p className="text-slate-500">
          이번 주(월요일부터) 우리 반 친구들과 모은 경험치 순위예요.
        </p>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          아직 같은 반 친구가 없거나 이번 주 활동이 없어요.
        </p>
      ) : (
        <ol className="space-y-2">
          {list.map((r, i) => (
            <li
              key={r.student_id}
              className={`flex items-center justify-between rounded-2xl border p-4 ${
                r.is_me
                  ? "border-poke-blue bg-poke-blue/5 ring-1 ring-poke-blue/30"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold">
                  {MEDAL[i] ?? i + 1}
                </span>
                <div>
                  <p className="font-semibold">
                    {r.display_name}
                    {r.is_me && <span className="ml-1 text-xs text-poke-blue">(나)</span>}
                  </p>
                  <p className="text-xs text-slate-400">Lv. {r.level}</p>
                </div>
              </div>
              <span className="font-bold text-poke-blue">
                {Number(r.weekly_xp).toLocaleString()} XP
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
