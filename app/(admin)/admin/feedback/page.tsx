import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeedbackClient, type FeedbackRow } from "@/components/admin/FeedbackClient";

export default async function AdminFeedbackPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("feedback")
    .select("id, student_id, category, body, status, admin_note, xp_awarded, coin_awarded, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const list = (rows ?? []) as any[];

  // 학생 이름 (한 번에 조회)
  const ids = Array.from(new Set(list.map((r) => r.student_id)));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, display_name, full_name")
      .in("id", ids);
    (profs ?? []).forEach((p: any) =>
      nameById.set(p.id, p.display_name || p.full_name || "학생"),
    );
  }

  const withNames: FeedbackRow[] = list.map((r) => ({
    ...r,
    student_name: nameById.get(r.student_id) ?? "학생",
  }));
  const openCount = withNames.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">문의함 💌</h1>
        <p className="text-slate-500">
          학생 문의·건의를 읽고 정리하세요. 개선 아이디어의 공급원이에요. (새 문의 {openCount}건)
        </p>
      </div>
      <FeedbackClient initial={withNames} />
    </div>
  );
}
