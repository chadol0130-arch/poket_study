"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * 학생 행동 수집기 — 화면 이동을 app_events 에 기록한다.
 * fire-and-forget: 실패(0020 미적용/오프라인)해도 앱 동작에 아무 영향 없음.
 * 동적 id 는 ':id' 로 정규화해 개별 리소스가 아닌 "화면" 단위로 집계되게 한다.
 */
export function BehaviorTracker({ userId }: { userId: string }) {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const path = pathname.replace(UUID_RE, ":id");
    if (last.current === path) return; // 같은 화면 리렌더는 스킵
    last.current = path;

    let sessionId: string;
    try {
      const stored = sessionStorage.getItem("evt-session");
      sessionId = stored ?? crypto.randomUUID();
      if (!stored) sessionStorage.setItem("evt-session", sessionId);
    } catch {
      return; // 시크릿 모드 등 저장 불가 — 조용히 생략
    }

    const supabase = createClient();
    supabase
      .from("app_events")
      .insert({ user_id: userId, event: "page_view", path, session_id: sessionId })
      .then(
        () => {},
        () => {},
      );
  }, [pathname, userId]);

  return null;
}
