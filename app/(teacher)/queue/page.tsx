import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewQueueItem, type QueueItemData } from "@/components/homework/ReviewQueueItem";

export default async function QueuePage() {
  await requireRole("teacher", "admin");
  const supabase = await createClient();

  // RLS 가 담당 반 제출물로 제한한다.
  const { data: subs } = await supabase
    .from("submissions")
    .select(
      "id, note, submitted_at, photo_paths, student_id, homework_assignments(title, xp_reward, coin_reward)",
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  // 학생 이름 조회.
  const studentIds = Array.from(new Set((subs ?? []).map((s: any) => s.student_id)));
  const nameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", studentIds);
    (profiles ?? []).forEach((p: any) => nameById.set(p.id, p.display_name));
  }

  // 사진 서명 URL 생성.
  const items: QueueItemData[] = [];
  for (const s of (subs ?? []) as any[]) {
    const assignment = Array.isArray(s.homework_assignments)
      ? s.homework_assignments[0]
      : s.homework_assignments;
    let urls: string[] = [];
    if (s.photo_paths?.length) {
      const { data: signed } = await supabase.storage
        .from("homework-photos")
        .createSignedUrls(s.photo_paths, 3600);
      urls = (signed ?? [])
        .map((x: any) => x.signedUrl)
        .filter((u: string | null): u is string => Boolean(u));
    }
    items.push({
      submissionId: s.id,
      studentName: nameById.get(s.student_id) ?? "학생",
      assignmentTitle: assignment?.title ?? "숙제",
      xpReward: assignment?.xp_reward ?? 0,
      coinReward: assignment?.coin_reward ?? 0,
      note: s.note ?? "",
      photoUrls: urls,
      submittedAt: s.submitted_at,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">검사 큐</h1>
        <p className="text-slate-500">
          제출된 숙제를 확인하고 통과시키면 학생의 포켓몬이 성장해요.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          검사할 숙제가 없어요. 👍
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ReviewQueueItem key={item.submissionId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
