import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "통과 ✅", cls: "bg-green-100 text-green-700" },
  pending: { label: "검사 대기", cls: "bg-amber-100 text-amber-700" },
  rejected: { label: "반려 ❌", cls: "bg-red-100 text-red-700" },
  none: { label: "미제출", cls: "bg-slate-100 text-slate-500" },
};

export default async function AssignmentsPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("homework_assignments")
    .select("id, title, description, due_at, xp_reward, coin_reward, classes(name)")
    .order("created_at", { ascending: false });

  const { data: subs } = await supabase
    .from("submissions")
    .select("assignment_id, status, reject_reason")
    .eq("student_id", profile.id);
  const subMap = new Map<string, any>(
    (subs ?? []).map((s: any) => [s.assignment_id, s]),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">숙제</h1>

      {(!assignments || assignments.length === 0) && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          아직 등록된 숙제가 없어요.
        </p>
      )}

      <ul className="space-y-3">
        {(assignments ?? []).map((a: any) => {
          const sub = subMap.get(a.id);
          const status = sub?.status ?? "none";
          const badge = STATUS_BADGE[status];
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold">{a.title}</p>
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
    </div>
  );
}
