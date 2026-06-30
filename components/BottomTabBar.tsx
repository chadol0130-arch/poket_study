"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BottomTab {
  href: string;
  label: string;
  icon: string;
  /** 이 탭으로 강조 처리할 경로 접두사들 */
  match: string[];
}

export function BottomTabBar({ tabs }: { tabs: BottomTab[] }) {
  const pathname = usePathname() || "/";
  const activeIdx = tabs.findIndex((t) =>
    t.match.some((m) => pathname === m || pathname.startsWith(m + "/")),
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {tabs.map((t, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-poke-red" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className={`text-xl leading-none ${active ? "scale-110" : ""} transition-transform`}>
                {t.icon}
              </span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
