import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const DAYS = 7;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// path → 한글 화면명 (미매핑은 path 그대로)
const LABELS: Record<string, string> = {
  "/dashboard": "홈",
  "/homework": "숙제 제출(캘린더)",
  "/homework/schedule": "숙제 일정",
  "/homework/status": "검사 현황",
  "/assignments/:id/submit": "숙제 제출 폼",
  "/my-pokemon": "내 포켓몬",
  "/my-pokemon/:id": "포켓몬 상세",
  "/pokedex": "도감",
  "/battles": "배틀 허브",
  "/battle/:id": "배틀(야생·보스)",
  "/pvp/:id": "친구 대결",
  "/leaderboard": "랭킹",
  "/shop": "상점",
  "/account": "내 정보",
  "/feedback": "문의·건의",
  "/onboarding": "스타터 선택",
  "/achievements": "도전과제",
};
const label = (p: string) => LABELS[p] ?? p;

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function fmtDur(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export default async function BehaviorPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("admin_behavior_analytics", { p_days: DAYS });

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">행동 분석 👣</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">행동 추적이 아직 준비되지 않았어요.</p>
          <p className="mt-1">
            Supabase SQL Editor 에서 <b>supabase/migrations/0020_behavior.sql</b> 을 실행해 주세요.
            (SETUP.md 21번 단계) 실행 후 학생들이 앱을 사용하면 데이터가 쌓이기 시작합니다.
          </p>
          {error && <p className="mt-2 text-xs text-amber-600">{error.message}</p>}
        </div>
      </div>
    );
  }

  const a = data as any;
  const summary = a.summary ?? {};
  const byScreen = (a.by_screen ?? []) as any[];
  const exits = (a.exits ?? []) as any[];
  const funnel = (a.funnel ?? []) as any[];
  const heat = (a.heatmap ?? []) as any[];
  const dau = (a.dau_trend ?? []) as any[];

  const maxViews = Math.max(1, ...byScreen.map((s) => Number(s.views)));
  const maxDau = Math.max(1, ...dau.map((d) => Number(d.n)));
  const heatMap = new Map<string, number>(heat.map((h: any) => [`${h.dow}-${h.hour}`, Number(h.n)]));
  const maxHeat = Math.max(1, ...heat.map((h: any) => Number(h.n)));
  const funnelBase = Math.max(1, Number(funnel[0]?.n ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">행동 분석 👣</h1>
        <p className="text-slate-500">
          최근 {DAYS}일 — 학생들이 어디를 다니고 어디서 나가는지 보고, 개선에 활용하세요.
        </p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="세션(접속) 수" value={summary.sessions ?? 0} />
        <Stat label="평균 사용 시간" value={fmtDur(Number(summary.avg_secs ?? 0))} sub="세션당" />
        <Stat label="세션당 화면 수" value={summary.avg_pages ?? 0} />
        <Stat label="활동 학생" value={summary.students ?? 0} />
      </div>

      {/* 퍼널 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">핵심 퍼널 — 방문이 제출로 이어지나요?</h2>
        <div className="space-y-2">
          {funnel.map((f: any, i: number) => {
            const n = Number(f.n ?? 0);
            const pct = Math.round((n / funnelBase) * 100);
            return (
              <div key={i}>
                <div className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {f.label}
                  </span>
                  <span className="text-slate-500">
                    {n}명 <b className="text-poke-blue">({pct}%)</b>
                  </span>
                </div>
                <div className="mt-0.5 h-3 w-full rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-poke-blue"
                    style={{ width: `${pct}%`, minWidth: n > 0 ? 8 : 0 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 화면별 조회 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-bold">인기 화면 Top {byScreen.length}</h2>
          {byScreen.length === 0 ? (
            <p className="text-sm text-slate-400">아직 데이터가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {byScreen.map((s: any) => (
                <li key={s.path}>
                  <div className="flex justify-between text-sm">
                    <span>{label(s.path)}</span>
                    <span className="text-slate-500">
                      {s.views}회 · {s.users}명
                    </span>
                  </div>
                  <div className="mt-0.5 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${Math.round((Number(s.views) / maxViews) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 이탈 화면 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-bold">🚪 이탈 화면 랭킹</h2>
          <p className="mb-3 text-xs text-slate-400">
            학생이 마지막으로 보고 앱을 떠난 화면이에요. (이탈% = 이탈 횟수 ÷ 그 화면 조회수)
          </p>
          {exits.length === 0 ? (
            <p className="text-sm text-slate-400">아직 데이터가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {exits.map((e: any, i: number) => (
                <li
                  key={e.path}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    <b className="mr-2 text-slate-400">{i + 1}</b>
                    {label(e.path)}
                  </span>
                  <span className="font-semibold text-poke-red">
                    {e.exits}회 <span className="text-xs font-normal">({e.exit_pct}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 요일×시간 히트맵 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">언제 많이 쓰나요? (요일 × 시간)</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            {DOW.map((d, dow) => (
              <div key={dow} className="flex items-center gap-1 py-0.5">
                <span className="w-6 text-xs text-slate-400">{d}</span>
                {Array.from({ length: 24 }, (_, h) => {
                  const n = heatMap.get(`${dow}-${h}`) ?? 0;
                  const op = n === 0 ? 0 : 0.15 + (n / maxHeat) * 0.85;
                  return (
                    <div
                      key={h}
                      title={`${d} ${h}시 — ${n}회`}
                      className="h-4 flex-1 rounded-sm"
                      style={{ backgroundColor: `rgba(59,130,246,${op})` }}
                    />
                  );
                })}
              </div>
            ))}
            <div className="mt-1 flex gap-1 pl-7 text-[10px] text-slate-400">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="flex-1 text-center">
                  {h % 6 === 0 ? h : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 일별 활동 학생 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">일별 활동 학생</h2>
        <div className="flex items-end justify-between gap-2" style={{ height: 100 }}>
          {dau.map((d: any) => (
            <div key={d.d} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold text-slate-600">{d.n}</span>
              <div
                className="w-full rounded-t bg-poke-blue"
                style={{
                  height: `${Math.round((Number(d.n) / maxDau) * 80)}%`,
                  minHeight: Number(d.n) > 0 ? 4 : 0,
                }}
              />
              <span className="text-[10px] text-slate-400">{String(d.d).slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        💡 이탈이 많은 화면이 개선 1순위예요. 화면을 고친 뒤 이 페이지에서 수치가 좋아지는지
        다시 확인하세요. (수집: 학생 화면 이동만, 우리 DB에만 저장)
      </p>
    </div>
  );
}
