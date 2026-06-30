"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  is_read: boolean;
  created_at: string;
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function NotificationBell() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, href, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  }

  async function openItem(n: Notif) {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg px-2 py-1.5 text-lg hover:bg-slate-100"
        aria-label="알림"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-poke-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-bold">알림</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-poke-blue">
                  모두 읽음
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">알림이 없어요.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
                      n.is_read ? "" : "bg-poke-blue/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-poke-red" />}
                      <span className="truncate text-sm font-semibold">{n.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400">{ago(n.created_at)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
