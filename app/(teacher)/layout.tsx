import { requireRole } from "@/lib/auth";
import { NavShell } from "@/components/NavShell";

const items = [
  { href: "/queue", label: "검사", icon: "✅" },
  { href: "/classes", label: "수업·숙제 내기", icon: "👨‍🏫" },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("teacher", "admin");
  return (
    <NavShell title="선생님 — 포켓몬 숙제" items={items}>
      {children}
    </NavShell>
  );
}
