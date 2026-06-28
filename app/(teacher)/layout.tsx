import { requireRole } from "@/lib/auth";
import { NavShell } from "@/components/NavShell";

const items = [
  { href: "/queue", label: "검사 큐", icon: "✅" },
  { href: "/classes", label: "내 반", icon: "👨‍🏫" },
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
