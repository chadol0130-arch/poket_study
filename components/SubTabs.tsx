"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SubTab {
  href: string;
  label: string;
}

/** 허브 상단 세그먼트 탭(소탭). 현재 경로로 활성 표시. */
export function SubTabs({ tabs }: { tabs: SubTab[] }) {
  const pathname = usePathname() || "/";
  // 가장 길게 일치하는 탭을 활성으로 (정확/접두 매칭)
  let activeHref = "";
  for (const t of tabs) {
    if ((pathname === t.href || pathname.startsWith(t.href + "/")) && t.href.length > activeHref.length) {
      activeHref = t.href;
    }
  }

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => {
        const active = t.href === activeHref;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition ${
              active ? "bg-white text-poke-red shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
