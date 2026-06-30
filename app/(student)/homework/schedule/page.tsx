import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubTabs } from "@/components/SubTabs";
import { HOMEWORK_TABS } from "@/lib/hubTabs";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "통과 ✅", cls: "bg-green-100 text-green-700" },
  pending: { label: "검사 대기", cls: "bg-amber-100 text-amber-700" },
  rejected: { label: "반려 ❌", cls: "bg-red-100 text-red-700" },
  none: { label: "미제출", cls: "bg-slate-100 text-slate-500" },
};

function ddayBadge(dueAt: string | null): { label: string; cls: string } | null {
  if (!dueAt) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
  const today = fmt.format(new Date());
  const due = fmt.format(new Date(dueAt));
  const diff = Math.round(
    (new Date(due + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000,
  );
  if (diff < 0) return { label: "마감 지남", cls: "bg-slate-100 text-slate-400" };
  if (diff === 0) return { label: "오늘 마감", cls: "bg-red-100 text-red-700" };
  if (diff <= 3) return { label: `D-${diff}`, cls: "bg-amber-100 text-amber-700" };
  return { label: `D-${diff}`, cls: "bg-slate-100 text-slate-500" };
}

export default async function HomeworkSchedulePage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("homework_assignments")
    .select("id, title, due_at, xp_reward, coin_reward, classes(name)");

  const { data: subs } = await supabase
    .from("submissions")
    .select("assignment_id, status, reject_reason")
    .eq("student_id", profile.id);
  const subMap = new Map<string, any>((subs ?? []).map((s: any) => [s.assignment_id, s]));

  // 마감일 빠른 순(없으면 뒤로)
  const sorted = [...(assignments ?? [])].sort((a: any, b: any) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">숙제 📒</h1>
      <SubTabs tabs={HOMEWORK_TABS} />
      <p className="text-sm text-slate-500">선생님이 낸 숙제와 마감일이에요. 제출하면 검사 후 포켓몬이 자라요!</p>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          아직 등록된 숙제가 없어요.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((a: any) => {
            const sub = subMap.get(a.id);
            const status = sub?.status ?? "none";
            const badge = STATUS_BADGE[status];
            const dday = ddayBadge(a.due_at);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{a.title}</p>
                    {dday && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${dday.cls}`}>
                        {dday.label}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {a.classes?.name} · ⭐ {a.xp_reward} XP · 🪙 {a.coin_reward}
                  </p>
                  {status === "rejected" && sub?.reject_reason && (
                    <p className="mt-1 text-xs text-poke-red">사유: {sub.reject_reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                  {status !== "approved" && (
                    <Link
                      href={`/assignments/${a.id}/submit`}
                      className="rounded-lg bg-poke-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-poke-blue/90"
                    >
                      {status === "none" ? "제출" : "다시 제출"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
