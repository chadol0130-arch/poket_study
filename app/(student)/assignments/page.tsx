import { redirect } from "next/navigation";

// 숙제 목록은 숙제 허브의 '숙제 일정' 탭으로 통합됨.
export default function AssignmentsRedirect() {
  redirect("/homework/schedule");
}
