import { requireRole } from "@/lib/auth";
import { NavShell } from "@/components/NavShell";

const items = [
  { href: "/admin/users", label: "계정", icon: "👤" },
  { href: "/admin/classes", label: "반 관리", icon: "🏫" },
  { href: "/admin/pokemon", label: "포켓몬 데이터", icon: "📦" },
  { href: "/admin/starters", label: "스타터", icon: "✨" },
  { href: "/admin/shop", label: "상점", icon: "🛒" },
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
