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

  const studentIds = Array.from(
    new Set([
      ...(subs ?? []).map((s: any) => s.student_id),
      ...(dailies ?? []).map((d: any) => d.student_id),
    ]),
  );
  // 큐 전체의 사진 경로를 모아 서명 URL 을 한 번에 발급 (항목별 호출 = 큐 크기만큼 왕복)
  const allPaths = Array.from(
    new Set([
      ...(subs ?? []).flatMap((s: any) => (s.photo_paths ?? []) as string[]),
      ...(dailies ?? []).flatMap((d: any) => (d.photo_paths ?? []) as string[]),
    ]),
  );

  const [profilesRes, signedRes] = await Promise.all([
    studentIds.length > 0
      ? supabase.from("profiles").select("id, display_name").in("id", studentIds)
      : Promise.resolve({ data: [] as any[] }),
    allPaths.length > 0
      ? supabase.storage.from("homework-photos").createSignedUrls(allPaths, 3600)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const nameById = new Map<string, string>();
  (profilesRes.data ?? []).forEach((p: any) => nameById.set(p.id, p.display_name));

  const urlByPath = new Map<string, string>();
  (signedRes.data ?? []).forEach((x: any) => {
    if (x.path && x.signedUrl) urlByPath.set(x.path, x.signedUrl);
  });
  const sign = (paths: string[]): string[] =>
    (paths ?? [])
      .map((p) => urlByPath.get(p))
      .filter((u): u is string => Boolean(u));

  // 과제 제출
  const items: QueueItemData[] = ((subs ?? []) as any[]).map((s) => {
    const a = Array.isArray(s.homework_assignments)
      ? s.homework_assignments[0]
      : s.homework_assignments;
    return {
      submissionId: s.id,
      studentName: nameById.get(s.student_id) ?? "학생",
      assignmentTitle: a?.title ?? "숙제",
      xpReward: a?.xp_reward ?? 0,
      coinReward: a?.coin_reward ?? 0,
      note: s.note ?? "",
      photoUrls: sign(s.photo_paths),
      submittedAt: s.submitted_at,
    };
  });

  // 날짜별 기록
  const dailyItems: DailyItemData[] = ((dailies ?? []) as any[]).map((d) => ({
    logId: d.id,
    studentName: nameById.get(d.student_id) ?? "학생",
    date: d.log_date,
    goal: d.goal ?? "",
    photoUrls: sign(d.photo_paths),
  }));

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
