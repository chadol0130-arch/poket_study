import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CopyNudgeButton } from "@/components/CopyNudgeButton";

/**
 * 독려 📣 — 앱 밖(카톡 반톡)으로 학생에게 닿기 위한 선생님 도구.
 * 마감 임박 숙제의 미제출 명단과 오늘 출석 안 한 명단을 반톡용 문구와 함께 제공.
 */
export default async function NudgePage() {
  const profile = await requireRole("teacher", "admin");
  const supabase = await createClient();

  // 내 반 (admin 은 전체 반)
  let classIds: string[] | null = null;
  if (profile.role !== "admin") {
    const { data: ct } = await supabase
      .from("class_teachers")
      .select("class_id")
      .eq("teacher_id", profile.id);
    classIds = (ct ?? []).map((x: any) => x.class_id);
  }
  let classQuery = supabase.from("classes").select("id, name").order("name");
  if (classIds) classQuery = classQuery.in("id", classIds.length ? classIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: classes } = await classQuery;
  const ids = (classes ?? []).map((c: any) => c.id);
  const className = new Map<string, string>((classes ?? []).map((c: any) => [c.id, c.name]));

  const todayKST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const now = Date.now();
  const from = new Date(now - 1 * 86400000).toISOString(); // 어제 마감(하루 지남)까지 포함
  const to = new Date(now + 2 * 86400000).toISOString();   // 이틀 뒤 마감까지

  const [{ data: assignments }, { data: enrollments }] = await Promise.all([
    ids.length
      ? supabase
          .from("homework_assignments")
          .select("id, class_id, title, due_at")
          .in("class_id", ids)
          .gte("due_at", from)
          .lte("due_at", to)
          .order("due_at")
      : Promise.resolve({ data: [] as any[] }),
    ids.length
      ? supabase
          .from("enrollments")
          .select("class_id, student_id, profiles(display_name, last_checkin_date, current_streak)")
          .in("class_id", ids)
          .eq("status", "active")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const dueIds = (assignments ?? []).map((a: any) => a.id);
  const { data: subs } = dueIds.length
    ? await supabase
        .from("submissions")
        .select("assignment_id, student_id, status")
        .in("assignment_id", dueIds)
    : { data: [] as any[] };

  // 숙제별 "제출로 인정"(승인/대기) 학생 집합 — 반려는 재제출 필요라 미제출로 취급
  const doneBy = new Map<string, Set<string>>();
  for (const s of subs ?? []) {
    if (s.status !== "approved" && s.status !== "pending") continue;
    if (!doneBy.has(s.assignment_id)) doneBy.set(s.assignment_id, new Set());
    doneBy.get(s.assignment_id)!.add(s.student_id);
  }

  const studentsByClass = new Map<string, { id: string; name: string; lastCheckin: string | null; streak: number }[]>();
  for (const e of enrollments ?? []) {
    const p: any = e.profiles;
    if (!studentsByClass.has(e.class_id)) studentsByClass.set(e.class_id, []);
    studentsByClass.get(e.class_id)!.push({
      id: e.student_id,
      name: p?.display_name ?? "학생",
      lastCheckin: p?.last_checkin_date ?? null,
      streak: p?.current_streak ?? 0,
    });
  }

  // 카드 1: 숙제별 미제출 명단
  const hwCards = (assignments ?? [])
    .map((a: any) => {
      const students = studentsByClass.get(a.class_id) ?? [];
      const done = doneBy.get(a.id) ?? new Set();
      const missing = students.filter((s) => !done.has(s.id));
      const dueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(a.due_at));
      const dDays = Math.round((new Date(`${dueDate}T00:00:00+09:00`).getTime() - new Date(`${todayKST}T00:00:00+09:00`).getTime()) / 86400000);
      const dLabel = dDays > 0 ? `D-${dDays}` : dDays === 0 ? "오늘 마감!" : "마감 지남";
      return { ...a, klass: className.get(a.class_id) ?? "", missing, dLabel, total: students.length };
    })
    .filter((c: any) => c.missing.length > 0);

  // 카드 2: 반별 오늘 출석 안 한 학생 (스트릭 있는 학생 우선 — 끊기기 직전이라 제일 급함)
  const checkinCards = (classes ?? [])
    .map((c: any) => {
      const students = (studentsByClass.get(c.id) ?? []).filter((s) => s.lastCheckin !== todayKST);
      students.sort((a, b) => b.streak - a.streak);
      return { id: c.id, name: c.name, students };
    })
    .filter((c: any) => c.students.length > 0);

  const hwText = (c: any) =>
    `📢 [${c.klass}] "${c.title}" ${c.dLabel}\n` +
    `아직 제출 안 한 친구: ${c.missing.map((m: any) => m.name).join(", ")}\n` +
    `지금 제출하면 XP·코인 받아요 🎁`;

  const checkinText = (c: any) =>
    `📢 [${c.name}] 오늘 아직 출석체크 안 한 친구: ${c.students.map((s: any) => s.name).join(", ")}\n` +
    `앱에서 출석 체크하면 코인 받고 스트릭이 이어져요 🔥`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">독려 📣</h1>
        <p className="text-slate-500">
          미제출·미출석 명단을 확인하고, 문구를 복사해 반 단톡방에 붙여넣으세요.
          앱 알림보다 카톡이 빨라요.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">📒 마감 임박 숙제 — 미제출 명단</h2>
        {hwCards.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            마감 임박(어제~모레) 숙제 중 미제출자가 없어요. 👏
          </p>
        ) : (
          hwCards.map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{c.klass}</span>
                    {c.title}
                    <span className={`ml-2 text-xs font-bold ${c.dLabel === "오늘 마감!" ? "text-poke-red" : "text-amber-600"}`}>
                      {c.dLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    미제출 {c.missing.length}/{c.total}명:{" "}
                    <b>{c.missing.map((m: any) => m.name).join(", ")}</b>
                  </p>
                </div>
                <CopyNudgeButton text={hwText(c)} />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">🔥 오늘 출석 안 한 학생</h2>
        {checkinCards.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            모든 학생이 오늘 출석했어요! 🎉
          </p>
        ) : (
          checkinCards.map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {c.students.map((s: any) => (
                      <span key={s.id} className="mr-2 inline-block">
                        {s.name}
                        {s.streak > 0 && (
                          <span className="ml-0.5 text-xs text-orange-500">🔥{s.streak}</span>
                        )}
                      </span>
                    ))}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">🔥 표시는 연속 출석이 끊기기 직전인 학생 — 제일 급해요!</p>
                </div>
                <CopyNudgeButton text={checkinText(c)} />
              </div>
            </div>
          ))
        )}
      </section>

      <p className="text-xs text-slate-400">
        💡 매일 오후 5시에 앱 안 알림(리마인더)도 자동 발송돼요(0022 적용 시). 이 페이지의
        카톡 문구는 앱을 안 여는 학생에게 닿는 가장 확실한 방법이에요.
      </p>
    </div>
  );
}
