import { requireRole } from "@/lib/auth";
import { NavShell } from "@/components/NavShell";
import { CoinBalance } from "@/components/ui/CoinBalance";

const items = [
  { href: "/dashboard", label: "홈", icon: "🏠" },
  { href: "/my-pokemon", label: "내 포켓몬", icon: "🐾" },
  { href: "/assignments", label: "숙제", icon: "📒" },
  { href: "/shop", label: "상점", icon: "🛒" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("student", "admin");
  return (
    <NavShell
      title="포켓몬 숙제"
      items={items}
      right={<CoinBalance amount={profile.coin_balance} />}
    >
      {children}
    </NavShell>
  );
}
