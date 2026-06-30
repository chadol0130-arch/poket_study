import { redirect } from "next/navigation";

// 캘린더는 숙제 허브의 '제출하기' 탭으로 통합됨.
export default function CalendarRedirect() {
  redirect("/homework");
}
