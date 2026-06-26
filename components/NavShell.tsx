import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

/** 상단 네비 + 본문 컨테이너. 역할별 layout 에서 메뉴를 주입한다. */
export function NavShell({
  title,
  items,
  right,
  children,
}: {
  title: string;
  items: NavItem[];
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span aria-hidden>⚡️</span>
            <span className="hidden sm:inline">{title}</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {it.icon && <span className="mr-1">{it.icon}</span>}
                {it.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {right}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
