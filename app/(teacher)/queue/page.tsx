import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewQueueItem, type QueueItemData } from "@/components/homework/ReviewQueueItem";
import { DailyReviewItem, type DailyItemData } from "@/components/homework/DailyReviewItem";

export default async function QueuePage() {
  await requireRole("teacher", "admin");
  const supabase = await createClient();

  // RLS 가 담당 반 제출물/기록으로 제한한다.
  const [{ data: subs }, { data: dailies }] = await Promise.all([
    supabase
      .from("submissions")
      .select(
        "id, note, submitted_at, photo_paths, student_id, homework_assignments(title, xp_reward, coin_reward)",
      )
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("daily_logs")
      .select("id, log_date, goal, photo_paths, student_id, submitted_at")
      .eq("status", "pending")
      .order("log_date", { ascending: true }),
  ]);

  // 학생 이름 (제출 + 날짜기록 합쳐서 한 번에)
  const studentIds = Array.from(
    new Set([
      ...(subs ?? []).map((s: any) => s.student_id),
      ...(dailies ?? []).map((d: any) => d.student_id),
    ]),
  );
  const nameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", studentIds);
    (profiles ?? []).forEach((p: any) => nameById.set(p.id, p.display_name));
  }

  async function sign(paths: string[]): Promise<string[]> {
    if (!paths?.length) return [];
    const { data } = await supabase.storage
      .from("homework-photos")
      .createSignedUrls(paths, 3600);
    return (data ?? [])
      .map((x: any) => x.signedUrl)
      .filter((u: string | null): u is string => Boolean(u));
  }

  // 과제 제출
  const items: QueueItemData[] = [];
  for (const s of (subs ?? []) as any[]) {
    const a = Array.isArray(s.homework_assignments)
      ? s.homework_assignments[0]
      : s.homework_assignments;
    items.push({
      submissionId: s.id,
      studentName: nameById.get(s.student_id) ?? "학생",
      assignmentTitle: a?.title ?? "숙제",
      xpReward: a?.xp_reward ?? 0,
      coinReward: a?.coin_reward ?? 0,
      note: s.note ?? "",
      photoUrls: await sign(s.photo_paths),
      submittedAt: s.submitted_at,
    });
  }

  // 날짜별 기록
  const dailyItems: DailyItemData[] = [];
  for (const d of (dailies ?? []) as any[]) {
    dailyItems.push({
      logId: d.id,
      studentName: nameById.get(d.student_id) ?? "학생",
      date: d.log_date,
      goal: d.goal ?? "",
      photoUrls: await sign(d.photo_paths),
    });
  }

  const empty = items.length === 0 && dailyItems.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">검사 큐</h1>
        <p className="text-slate-500">
          제출을 확인하고 통과시키면 학생의 포켓몬이 성장해요.
        </p>
      </div>

      {empty && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          검사할 제출이 없어요. 👍
        </p>
      )}

      {dailyItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500">📅 날짜별 학습 기록</h2>
          {dailyItems.map((item) => (
            <DailyReviewItem key={item.logId} item={item} />
          ))}
        </section>
      )}

      {items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500">📒 과제 제출</h2>
          {items.map((item) => (
            <ReviewQueueItem key={item.submissionId} item={item} />
          ))}
        </section>
      )}
    </div>
  );
}
