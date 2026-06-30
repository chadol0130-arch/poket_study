import { requireRole } from "@/lib/auth";
import { NavShell } from "@/components/NavShell";
import { CoinBalance } from "@/components/ui/CoinBalance";
import type { BottomTab } from "@/components/BottomTabBar";

// 핸드폰 친화 하단 탭 5개. match = 이 탭으로 강조할 경로 접두사들.
const tabs: BottomTab[] = [
  { href: "/dashboard", label: "홈", icon: "🏠", match: ["/dashboard"] },
  { href: "/homework", label: "숙제", icon: "📒", match: ["/homework", "/calendar", "/assignments"] },
  {
    href: "/my-pokemon",
    label: "포켓몬",
    icon: "🐾",
    match: ["/my-pokemon", "/pokedex", "/battles", "/battle", "/leaderboard", "/pokemon"],
  },
  { href: "/shop", label: "상점", icon: "🛒", match: ["/shop"] },
  { href: "/account", label: "내 정보", icon: "👤", match: ["/account"] },
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
      bottomTabs={tabs}
      right={<CoinBalance amount={profile.coin_balance} />}
    >
      {children}
    </NavShell>
  );
}
