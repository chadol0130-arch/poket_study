import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSpeciesInfo } from "@/lib/queries";

function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const today = kstDate();
  const day7 = kstDate(-6); // 오늘 포함 7일
  const start7 = `${day7}T00:00:00+09:00`;
  const startToday = `${today}T00:00:00+09:00`;

  const headCount = async (q: any) => (await q).count ?? 0;

  // 기본 규모
  const [students, teachers, classes] = await Promise.all([
    headCount(admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student")),
    headCount(admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher")),
    headCount(admin.from("classes").select("id", { count: "exact", head: true })),
  ]);

  // 활동 데이터(최근 7일) — 활성 사용자(DAU/WAU) 계산용
  const [subs7, logs7, ans7, chk7] = await Promise.all([
    admin.from("submissions").select("student_id, status, submitted_at").gte("submitted_at", start7),
    admin.from("daily_logs").select("student_id, status, log_date").gte("log_date", day7),
    admin.from("question_answers").select("student_id, answered_at").gte("answered_at", start7),
    admin.from("streak_checkins").select("student_id, checkin_date").gte("checkin_date", day7),
  ]);
  const S = (r: any) => (r.data ?? []) as any[];

  const activeIn = (sinceISO: string, sinceDate: string) => {
    const set = new Set<string>();
    S(subs7).forEach((x) => x.submitted_at >= sinceISO && set.add(x.student_id));
    S(logs7).forEach((x) => x.log_date >= sinceDate && set.add(x.student_id));
    S(ans7).forEach((x) => x.answered_at >= sinceISO && set.add(x.student_id));
    S(chk7).forEach((x) => x.checkin_date >= sinceDate && set.add(x.student_id));
    return set.size;
  };
  const dau = activeIn(startToday, today);
  const wau = activeIn(start7, day7);

  // 누적 검사 통계 (전체)
  const [subApproved, subRejected, subPending, logApproved, logRejected] = await Promise.all([
    headCount(admin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "approved")),
    headCount(admin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "rejected")),
    headCount(admin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending")),
    headCount(admin.from("daily_logs").select("id", { count: "exact", head: true }).eq("status", "approved")),
    headCount(admin.from("daily_logs").select("id", { count: "exact", head: true }).eq("status", "rejected")),
  ]);

  // 질문 응답률
  const [qTargets, qAnswers] = await Promise.all([
    headCount(admin.from("question_targets").select("id", { count: "exact", head: true })),
    headCount(admin.from("question_answers").select("id", { count: "exact", head: true })),
  ]);

  // 스트릭 분포 + 인기 포켓몬
  const { data: profStreaks } = await admin.from("profiles").select("current_streak").eq("role", "student");
  const streaks = (profStreaks ?? []).map((p: any) => p.current_streak ?? 0);
  const avgStreak = streaks.length ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10 : 0;
  const maxStreak = streaks.length ? Math.max(...streaks) : 0;

  const { data: pets } = await admin.from("student_pokemon").select("current_species_id");
  const speciesCount = new Map<string, number>();
  (pets ?? []).forEach((p: any) => speciesCount.set(p.current_species_id, (speciesCount.get(p.current_species_id) ?? 0) + 1));
  const topSpecies = [...speciesCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const info = await getSpeciesInfo(topSpecies.map(([id]) => id));

  // 최근 7일 일별 제출+기록 건수 (간단 막대)
  const days = Array.from({ length: 7 }, (_, i) => kstDate(-6 + i));
  const byDay = new Map<string, number>(days.map((d) => [d, 0]));
  S(subs7).forEach((x) => {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(x.submitted_at));
    if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  });
  S(logs7).forEach((x) => {
    if (byDay.has(x.log_date)) byDay.set(x.log_date, (byDay.get(x.log_date) ?? 0) + 1);
  });
  const maxDay = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">분석 대시보드 📊</h1>
        <p className="text-slate-500">학생 참여 지표 — 무엇이 학생을 움직이는지 살펴보세요. (실시간 집계)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="학생 수" value={students} sub={`선생님 ${teachers} · 반 ${classes}`} />
        <Stat label="오늘 활동(DAU)" value={dau} sub={`참여율 ${pct(dau, students)}%`} />
        <Stat label="이번 주 활동(WAU)" value={wau} sub={`참여율 ${pct(wau, students)}%`} />
        <Stat label="평균 스트릭" value={`${avgStreak}일`} sub={`최고 ${maxStreak}일`} />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="숙제 검사"
          value={`${pct(subApproved, subApproved + subRejected)}%`}
          sub={`통과 ${subApproved} · 반려 ${subRejected} · 대기 ${subPending}`}
        />
        <Stat
          label="일일 학습기록"
          value={`${pct(logApproved, logApproved + logRejected)}%`}
          sub={`통과 ${logApproved} · 반려 ${logRejected}`}
        />
        <Stat
          label="질문 응답률"
          value={`${pct(qAnswers, qTargets)}%`}
          sub={`응답 ${qAnswers} / 발송 ${qTargets}`}
        />
      </section>

      {/* 최근 7일 활동 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">최근 7일 제출·기록</h2>
        <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
          {days.map((d) => {
            const v = byDay.get(d) ?? 0;
            return (
              <div key={d} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold text-slate-600">{v}</span>
                <div
                  className="w-full rounded-t bg-poke-blue"
                  style={{ height: `${Math.round((v / maxDay) * 90)}%`, minHeight: v > 0 ? 4 : 0 }}
                />
                <span className="text-[10px] text-slate-400">{d.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 인기 포켓몬 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">인기 포켓몬 Top 5</h2>
        {topSpecies.length === 0 ? (
          <p className="text-sm text-slate-400">아직 데이터가 없어요.</p>
        ) : (
          <ol className="space-y-1.5">
            {topSpecies.map(([id, n], i) => {
              const s = info.get(id);
              return (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span>
                    <b className="mr-2 text-slate-400">{i + 1}</b>
                    {s?.nameKo || s?.name || "?"}
                  </span>
                  <span className="font-semibold text-poke-blue">{n}마리</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
