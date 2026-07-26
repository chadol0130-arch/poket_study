"use client";

import { useRef, useState } from "react";

/** 반톡(카톡)에 붙여넣을 독려 문구를 클립보드로 복사하는 버튼. */
export function CopyNudgeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 구형 브라우저/비보안 컨텍스트 폴백
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-white transition ${
        copied ? "bg-green-500" : "bg-poke-blue hover:bg-poke-blue/90"
      }`}
    >
      {copied ? "복사됨 ✓" : "📋 반톡용 복사"}
    </button>
  );
}
