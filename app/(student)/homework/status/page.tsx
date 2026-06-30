import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubTabs } from "@/components/SubTabs";
import { HOMEWORK_TABS } from "@/lib/hubTabs";

const BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "통과 ✅", cls: "bg-green-100 text-green-700" },
  pending: { label: "검사 대기", cls: "bg-amber-100 text-amber-700" },
  rejected: { label: "반려 ❌", cls: "bg-red-100 text-red-700" },
};

interface Row {
  key: string;
  kind: string; // 숙제 / 일일기록
  title: string;
  status: "approved" | "pending" | "rejected";
  reason: string | null;
  when: string;
  href: string;
}

export default async function HomeworkStatusPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const [{ data: subs }, { data: logs }] = await Promise.all([
    supabase
      .from("submissions")
      .select("assignment_id, status, reject_reason, submitted_at, homework_assignments(title)")
      .eq("student_id", profile.id),
    supabase
      .from("daily_logs")
      .select("log_date, status, reject_reason, goal")
      .eq("student_id", profile.id),
  ]);

  const rows: Row[] = [];
  (subs ?? []).forEach((s: any) => {
    const a = Array.isArray(s.homework_assignments) ? s.homework_assignments[0] : s.homework_assignments;
    rows.push({
      key: `s-${s.assignment_id}`,
      kind: "숙제",
      title: a?.title ?? "숙제",
      status: s.status,
      reason: s.reject_reason,
      when: s.submitted_at ?? "",
      href: `/assignments/${s.assignment_id}/submit`,
    });
  });
  (logs ?? []).forEach((l: any) => {
    rows.push({
      key: `d-${l.log_date}`,
      kind: "일일기록",
      title: l.goal?.trim() ? l.goal : `${l.log_date} 학습`,
      status: l.status,
      reason: l.reject_reason,
      when: `${l.log_date}T00:00:00+09:00`,
      href: "/homework",
    });
  });
  rows.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">숙제 📒</h1>
      <SubTabs tabs={HOMEWORK_TABS} />
      <p className="text-sm text-slate-500">내가 제출한 것들의 검사 상태예요. 반려된 건 사유를 보고 다시 제출하세요.</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          아직 제출한 기록이 없어요.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const badge = BADGE[r.status];
            return (
              <li
                key={r.key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                      {r.kind}
                    </span>
                    <p className="truncate font-semibold">{r.title}</p>
                  </div>
                  {r.status === "rejected" && r.reason && (
                    <p className="mt-1 text-xs text-poke-red">사유: {r.reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                  {r.status === "rejected" && (
                    <Link
                      href={r.href}
                      className="rounded-lg bg-poke-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-poke-blue/90"
                    >
                      다시 제출
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
