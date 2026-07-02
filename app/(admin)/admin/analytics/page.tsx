import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSpeciesInfo } from "@/lib/queries";

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

interface Analytics {
  students: number;
  teachers: number;
  classes: number;
  dau: number;
  wau: number;
  sub_approved: number;
  sub_rejected: number;
  sub_pending: number;
  log_approved: number;
  log_rejected: number;
  q_targets: number;
  q_answers: number;
  avg_streak: number;
  max_streak: number;
  top_species: { species_id: string; n: number }[];
  by_day: { d: string; n: number }[];
}

export default async function AnalyticsPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  // 행 전체를 앱으로 끌어오지 않고 DB 에서 한 번에 집계 (0015 admin_analytics RPC).
  const { data, error } = await admin.rpc("admin_analytics");

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">분석 대시보드 📊</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">집계 함수가 아직 준비되지 않았어요.</p>
          <p className="mt-1">
            Supabase SQL Editor 에서 <b>supabase/migrations/0015_scale.sql</b> 을 실행해 주세요.
            (SETUP.md 16번 단계)
          </p>
          {error && <p className="mt-2 text-xs text-amber-600">{error.message}</p>}
        </div>
      </div>
    );
  }

  const a = data as Analytics;
  const topSpecies = a.top_species ?? [];
  const info = await getSpeciesInfo(topSpecies.map((t) => t.species_id));
  const days = a.by_day ?? [];
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">분석 대시보드 📊</h1>
        <p className="text-slate-500">학생 참여 지표 — 무엇이 학생을 움직이는지 살펴보세요. (실시간 집계)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="학생 수" value={a.students} sub={`선생님 ${a.teachers} · 반 ${a.classes}`} />
        <Stat label="오늘 활동(DAU)" value={a.dau} sub={`참여율 ${pct(a.dau, a.students)}%`} />
        <Stat label="이번 주 활동(WAU)" value={a.wau} sub={`참여율 ${pct(a.wau, a.students)}%`} />
        <Stat label="평균 스트릭" value={`${a.avg_streak}일`} sub={`최고 ${a.max_streak}일`} />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="숙제 검사"
          value={`${pct(a.sub_approved, a.sub_approved + a.sub_rejected)}%`}
          sub={`통과 ${a.sub_approved} · 반려 ${a.sub_rejected} · 대기 ${a.sub_pending}`}
        />
        <Stat
          label="일일 학습기록"
          value={`${pct(a.log_approved, a.log_approved + a.log_rejected)}%`}
          sub={`통과 ${a.log_approved} · 반려 ${a.log_rejected}`}
        />
        <Stat
          label="질문 응답률"
          value={`${pct(a.q_answers, a.q_targets)}%`}
          sub={`응답 ${a.q_answers} / 발송 ${a.q_targets}`}
        />
      </section>

      {/* 최근 7일 활동 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">최근 7일 제출·기록</h2>
        <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
          {days.map((d) => (
            <div key={d.d} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold text-slate-600">{d.n}</span>
              <div
                className="w-full rounded-t bg-poke-blue"
                style={{ height: `${Math.round((d.n / maxDay) * 90)}%`, minHeight: d.n > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] text-slate-400">{d.d.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 인기 포켓몬 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">인기 포켓몬 Top 5</h2>
        {topSpecies.length === 0 ? (
          <p className="text-sm text-slate-400">아직 데이터가 없어요.</p>
        ) : (
          <ol className="space-y-1.5">
            {topSpecies.map((t, i) => {
              const s = info.get(t.species_id);
              return (
                <li key={t.species_id} className="flex items-center justify-between text-sm">
                  <span>
                    <b className="mr-2 text-slate-400">{i + 1}</b>
                    {s?.nameKo || s?.name || "?"}
                  </span>
                  <span className="font-semibold text-poke-blue">{t.n}마리</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
