import { requireRole } from "@/lib/auth";
import { NavShell } from "@/components/NavShell";

// 그룹 순서(운영→콘텐츠→참여→검사)로 정렬. 자세한 설명은 /admin 허브 카드 참고.
const items = [
  { href: "/admin", label: "홈", icon: "🏠" },
  { href: "/admin/analytics", label: "분석", icon: "📊" },
  { href: "/admin/users", label: "계정", icon: "👤" },
  { href: "/admin/classes", label: "반 관리", icon: "🏫" },
  { href: "/admin/pokemon", label: "포켓몬", icon: "📦" },
  { href: "/admin/starters", label: "스타터", icon: "✨" },
  { href: "/admin/shop", label: "상점", icon: "🛒" },
  { href: "/admin/questions", label: "질문", icon: "💬" },
  { href: "/admin/encounters", label: "보스", icon: "👑" },
  // 관리자도 선생님 기능(숙제 검사/수업·숙제내기)을 바로 쓸 수 있게.
  { href: "/queue", label: "검사", icon: "✅" },
  { href: "/classes", label: "수업·숙제", icon: "👨‍🏫" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  return (
    <NavShell title="관리자 — 포켓몬 숙제" items={items}>
      {children}
    </NavShell>
  );
}
