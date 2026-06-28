// 첫 관리자 계정을 만드는 CLI 보조 도구 (SQL 대신 명령어를 선호할 때).
//   사용법: npm run create-admin -- <이메일> <비밀번호> [이름]
// .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 사용한다.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// .env.local 을 의존성 없이 직접 읽어 process.env 에 채운다.
function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local 이 없으면 실제 환경변수를 그대로 사용
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "❌ 환경변수가 없습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 넣어주세요.",
  );
  process.exit(1);
}

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error("사용법: npm run create-admin -- <이메일> <비밀번호> [이름]");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const displayName = name?.trim() || "관리자";
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: displayName, display_name: displayName, role: "admin" },
});
if (error) {
  console.error("❌ 계정 생성 실패:", error.message);
  process.exit(1);
}

// 트리거가 profiles 를 만들지만 role 을 확실히 admin 으로 보정.
const { error: upErr } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", data.user.id);
if (upErr) {
  console.error("⚠️ 계정은 만들어졌지만 role 갱신에 실패했습니다:", upErr.message);
  console.error("   create_admin.sql 의 update 문으로 role 을 'admin' 으로 바꿔주세요.");
  process.exit(1);
}

console.log(`✅ 관리자 계정 생성 완료: ${email}`);
console.log("   이제 이 이메일/비밀번호로 로그인하면 관리자 화면이 보입니다.");
