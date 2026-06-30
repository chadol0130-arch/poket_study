import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Ach {
  icon: string;
  title: string;
  current: number;
  goal: number;
  unit: string;
}

function row(icon: string, title: string, current: number, goals: number[], unit: string): Ach {
  // 현재 값 바로 위 목표를 다음 도전과제로 (모두 달성 시 마지막 목표 유지)
  const goal = goals.find((g) => current < g) ?? goals[goals.length - 1];
  return { icon, title, current, goal, unit };
}

export default async function AchievementsPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const head = async (q: any) => (await q).count ?? 0;
  const [{ data: pets }, subApproved, logApproved, battlesWon, answers] = await Promise.all([
    supabase.from("student_pokemon").select("level").eq("student_id", profile.id),
    head(supabase.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("status", "approved")),
    head(supabase.from("daily_logs").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("status", "approved")),
    head(supabase.from("battles").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("status", "won")),
    head(supabase.from("question_answers").select("id", { count: "exact", head: true }).eq("student_id", profile.id)),
  ]);

  const petCount = (pets ?? []).length;
  const maxLevel = (pets ?? []).reduce((m: number, p: any) => Math.max(m, p.level ?? 1), 1);
  const passes = subApproved + logApproved;

  const list: Ach[] = [
    row("🔥", "연속 출석", profile.longest_streak ?? 0, [3, 7, 14, 30], "일"),
    row("✅", "숙제·기록 통과", passes, [1, 10, 30, 50, 100], "개"),
    row("🐾", "포켓몬 수집", petCount, [1, 3, 5, 10, 20], "마리"),
    row("⭐", "최고 레벨", maxLevel, [10, 16, 32, 50], "레벨"),
    row("⚔️", "배틀 승리", battlesWon, [1, 5, 10, 25], "승"),
    row("💬", "질문 답변", answers, [1, 10, 30, 60], "개"),
  ];
  const earned = list.filter((a) => a.current >= a.goal).length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">도전과제 🏅</h1>
          <p className="text-slate-500">목표를 채우며 성장해보세요!</p>
        </div>
        <Link href="/account" className="text-sm text-poke-blue">
          ← 내 정보
        </Link>
      </div>

      <ul className="space-y-3">
        {list.map((a) => {
          const done = a.current >= a.goal;
          const ratio = Math.min(1, a.current / a.goal);
          return (
            <li
              key={a.title}
              className={`rounded-2xl border p-4 ${done ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{a.icon}</span>
                  <span className="font-semibold">{a.title}</span>
                </div>
                <span className={`text-sm font-bold ${done ? "text-green-600" : "text-slate-400"}`}>
                  {done ? "달성! ✨" : `${a.current} / ${a.goal}${a.unit}`}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${done ? "bg-green-500" : "bg-poke-yellow"}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-center text-sm text-slate-500">
        달성한 도전과제 <b className="text-green-600">{earned}</b> / {list.length}
      </p>
    </div>
  );
}
