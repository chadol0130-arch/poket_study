import { createClient } from "@supabase/supabase-js";

/**
 * service-role 클라이언트 — RLS 를 우회한다. **서버 전용**.
 * 절대 클라이언트 컴포넌트에서 import 하지 말 것.
 * 계정 생성(Admin API) 등 관리자 권한이 필요한 작업에만 사용.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
