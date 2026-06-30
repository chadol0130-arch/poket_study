import { requireRole } from "@/lib/auth";
import { SubTabs } from "@/components/SubTabs";
import { HOMEWORK_TABS } from "@/lib/hubTabs";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function HomeworkSubmitPage() {
  const profile = await requireRole("student", "admin");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">숙제 📒</h1>
      <SubTabs tabs={HOMEWORK_TABS} />
      <p className="text-sm text-slate-500">
        날짜를 눌러 오늘의 목표를 적고 사진을 올리세요. 선생님이 통과시키면 포켓몬이 자라요! 🐾
      </p>
      <CalendarView studentId={profile.id} />
    </div>
  );
}
