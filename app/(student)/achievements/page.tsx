import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AchievementClaim } from "@/components/AchievementClaim";

const TIER_COIN = [15, 30, 50, 80, 120]; // n번째 티어 보상 (0023 claim_achievement 와 동일)

interface Ach {
  key: string;
  icon: string;
  title: string;
  current: number;
  goals: number[];
  unit: string;
}

export default async function AchievementsPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const head = async (q: any) => (await q).count ?? 0;
  const [{ data: pets }, subApproved, logApproved, battlesWon, answers, { data: claims }] =
    await Promise.all([
      supabase.from("student_pokemon").select("level").eq("student_id", profile.id),
      head(supabase.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("status", "approved")),
      head(supabase.from("daily_logs").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("status", "approved")),
      head(supabase.from("battles").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("status", "won")),
      head(supabase.from("question_answers").select("id", { count: "exact", head: true }).eq("student_id", profile.id)),
      // 0023 미적용이면 에러 → null → 미수령 취급 (버튼 클릭 시 안내)
      supabase.from("achievement_claims").select("track, goal").eq("student_id", profile.id),
    ]);

  const claimed = new Set((claims ?? []).map((c: any) => `${c.track}-${c.goal}`));
  const petCount = (pets ?? []).length;
  const maxLevel = (pets ?? []).reduce((m: number, p: any) => Math.max(m, p.level ?? 1), 1);
  const passes = subApproved + logApproved;

  // key 는 0023 claim_achievement 의 트랙 이름과 1:1
  const list: Ach[] = [
    { key: "streak", icon: "🔥", title: "연속 출석", current: profile.longest_streak ?? 0, goals: [3, 7, 14, 30], unit: "일" },
    { key: "passes", icon: "✅", title: "숙제·기록 통과", current: passes, goals: [1, 10, 30, 50, 100], unit: "개" },
    { key: "collect", icon: "🐾", title: "포켓몬 수집", current: petCount, goals: [1, 3, 5, 10, 20], unit: "마리" },
    { key: "level", icon: "⭐", title: "최고 레벨", current: maxLevel, goals: [10, 16, 32, 50], unit: "레벨" },
    { key: "wins", icon: "⚔️", title: "배틀 승리", current: battlesWon, goals: [1, 5, 10, 25], unit: "승" },
    { key: "answers", icon: "💬", title: "질문 답변", current: answers, goals: [1, 10, 30, 60], unit: "개" },
  ];

  let claimableCount = 0;
  const cards = list.map((a) => {
    const nextGoal = a.goals.find((g) => a.current < g) ?? a.goals[a.goals.length - 1];
    const done = a.current >= nextGoal;
    const tiers = a.goals.map((g, i) => {
      const achieved = a.current >= g;
      const isClaimed = claimed.has(`${a.key}-${g}`);
      if (achieved && !isClaimed) claimableCount++;
      return { goal: g, coin: TIER_COIN[i], achieved, claimed: isClaimed };
    });
    return { ...a, nextGoal, done, tiers };
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">도전과제 🏅</h1>
          <p className="text-slate-500">목표를 채우고 코인 보상을 받아가세요!</p>
        </div>
        <Link href="/account" className="text-sm text-poke-blue">
          ← 내 정보
        </Link>
      </div>

      {claimableCount > 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
          🎁 받을 수 있는 보상이 {claimableCount}개 있어요!
        </p>
      )}

      <ul className="space-y-3">
        {cards.map((a) => {
          const ratio = Math.min(1, a.current / a.nextGoal);
          return (
            <li
              key={a.key}
              className={`rounded-2xl border p-4 ${a.done ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{a.icon}</span>
                  <span className="font-semibold">{a.title}</span>
                </div>
                <span className={`text-sm font-bold ${a.done ? "text-green-600" : "text-slate-400"}`}>
                  {a.done ? "모두 달성! ✨" : `${a.current} / ${a.nextGoal}${a.unit}`}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${a.done ? "bg-green-500" : "bg-poke-yellow"}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>

              {/* 티어별 보상 */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {a.tiers.map((t) =>
                  t.claimed ? (
                    <span
                      key={t.goal}
                      className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-600"
                    >
                      {t.goal}{a.unit} ✓
                    </span>
                  ) : t.achieved ? (
                    <AchievementClaim
                      key={t.goal}
                      track={a.key}
                      goal={t.goal}
                      coin={t.coin}
                      unit={a.unit}
                    />
                  ) : (
                    <span
                      key={t.goal}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400"
                    >
                      {t.goal}{a.unit} · {t.coin}🪙
                    </span>
                  ),
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
