import Link from "next/link";
import { requireRole } from "@/lib/auth";

const GROUPS: { title: string; items: { href: string; label: string; icon: string; desc: string }[] }[] = [
  {
    title: "운영",
    items: [
      { href: "/admin/analytics", label: "분석 대시보드", icon: "📊", desc: "참여 지표·통과율·인기 포켓몬" },
      { href: "/admin/users", label: "계정", icon: "👤", desc: "학생·선생님 계정 관리" },
      { href: "/admin/classes", label: "반 관리", icon: "🏫", desc: "반 만들기·학생/선생님 배정" },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      { href: "/admin/pokemon", label: "포켓몬 데이터", icon: "📦", desc: "종·스프라이트·배틀 데이터 등록" },
      { href: "/admin/starters", label: "스타터", icon: "✨", desc: "온보딩 스타터 후보 구성" },
      { href: "/admin/shop", label: "상점", icon: "🛒", desc: "구입 가능 포켓몬·가격" },
    ],
  },
  {
    title: "참여 이벤트",
    items: [
      { href: "/admin/questions", label: "질문", icon: "💬", desc: "학생에게 질문 보내기·답변 분석" },
      { href: "/admin/encounters", label: "보스", icon: "👑", desc: "시험 보스 배치" },
    ],
  },
  {
    title: "검사 (선생님 기능)",
    items: [
      { href: "/queue", label: "검사 큐", icon: "✅", desc: "숙제·일일기록 통과/반려" },
      { href: "/classes", label: "수업 반·숙제 내기", icon: "👨‍🏫", desc: "반별 숙제 만들기(마감일)" },
    ],
  },
];

export default async function AdminHome() {
  const profile = await requireRole("admin");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자 홈</h1>
        <p className="text-slate-500">{profile.display_name}님, 무엇을 관리할까요?</p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-poke-blue hover:-translate-y-0.5"
              >
                <span className="text-2xl">{it.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold">{it.label}</p>
                  <p className="truncate text-xs text-slate-500">{it.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
