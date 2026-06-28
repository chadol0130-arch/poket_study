import { requireRole } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const profile = await requireRole("student", "admin");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">학습 캘린더</h1>
        <p className="text-slate-500">
          날짜를 눌러 목표를 적고 사진을 올리세요. 선생님이 통과시키면 포켓몬이 자라요! 🐾
        </p>
      </div>
      <CalendarView studentId={profile.id} />
    </div>
  );
}
