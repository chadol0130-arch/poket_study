# AI 숙제 검사 보조 — 설계 문서 (OCR·요약 + 자동 반려사유 제안)

> **상태: 설계 전용(미구현).** 이 문서는 "선생님 검사 효율을 AI로 높일 수 있을까?"라는
> 질문에 대한 결론과, 나중에 구현할 때 그대로 따라갈 수 있는 청사진입니다.
> 지금은 **코드/마이그레이션/워커를 만들지 않습니다.** 앱·DB·배포에 아무 영향 없습니다.

---

## 0. 세 줄 요약

1. **가능합니다.** 단, 숙제는 *사진*이라 텍스트 LLM이 아니라 **비전 모델(VLM)** 이 필요하고,
   가장 큰 리스크는 **한글 손글씨·수식 OCR 정확도**입니다.
2. AI는 **검사 대행이 아니라 검사 보조**입니다. 선생님의 승인 클릭이 여전히 보상(경험치·코인·진화)의
   트리거이고, AI는 **OCR·요약**과 **자동 반려사유 제안**으로 선생님의 시간을 줄여줄 뿐입니다.
3. Vercel(공용 클라우드)은 집/학원의 GPU에 **직접 붙을 수 없습니다.** 그래서 정답 구조는
   **폴링 워커** — 이 구조는 **추론 백엔드만 갈아끼우면** 클라우드 VLM ↔ 로컬 NVIDIA(NIM)를 오갈 수 있습니다.

---

## 1. 배경 — 왜 이 설계인가

현재 검사 흐름(코드 확인 완료):

- 학생이 사진을 올리면 `submissions` 행이 생깁니다. `photo_paths text[]`(버킷 `homework-photos`),
  `status ∈ {pending, approved, rejected}`, `reviewed_by`, `reviewed_at`, `reject_reason`.
- 선생님이 큐(`app/(teacher)/queue/page.tsx`)에서 **통과/반려** 버튼을 누르면
  `lib/actions/submissions.ts`의 `approveSubmission`/`rejectSubmission`이 `status`만 바꿉니다.
- `status`가 `approved`로 바뀌는 순간 DB 트리거 `trg_award_on_approve`(`0001_init.sql`)가
  경험치·코인 지급 + 레벨업·진화를 처리합니다.

핵심: **승인 = 보상 트리거.** 그래서 AI가 자동 승인하면 공정성·신뢰가 무너집니다.
AI는 반드시 **사람 개입(human-in-the-loop)** 을 유지한 채 보조 정보만 제공해야 합니다.

이번에 확정된 AI 역할(사용자 선택):

- ✅ **OCR + 요약** — 사진 속 손글씨를 텍스트로 뽑고 핵심을 요약해, 선생님이 사진을 일일이 열지 않아도 훑기.
- ✅ **자동 반려사유 제안** — 반려할 만하면 이유(예: "3번 미풀이", "사진 흐림")를 제안해 반려창에 프리필.
- ⏭️ (이번 범위 밖, 같은 구조로 나중 확장) 사전 선별(triage), 오답 지적·피드백 초안.

---

## 2. 아키텍처 — 왜 "폴링 워커"인가

앱은 **Vercel 서버리스**(상태 없는 공용 클라우드)에서 돌고, GPU는 **집/학원 사설망**에 있습니다.
서버리스 함수는 사설망 안으로 연결을 열 수 없으므로 "서버액션에서 로컬 모델 직접 호출"은 불가능합니다.

### 채택: 폴링 워커 (Polling Worker)

```
┌──────────────┐        ┌──────────────────┐        ┌───────────────────┐
│   학생 앱     │ 사진   │     Supabase      │ 조회   │  검사 워커(별도)   │
│  (Vercel)    ├───────▶│  submissions      │◀───────┤  1) pending 폴링   │
│              │        │  storage(사진)    │        │  2) 사진 다운(서명)│
│  교사 큐     │◀───────┤  submission_ai_   │◀───────┤  3) VLM 추론       │
│  (AI 블록)   │  읽기  │    reviews        │  기록  │  4) 결과 upsert    │
└──────────────┘        └──────────────────┘        └───────────────────┘
```

- 워커가 주기적으로 `status='pending'`이고 아직 AI 리뷰가 없는 제출을 조회 → **서명 URL**로 사진 내려받기
  → VLM 추론 → `submission_ai_reviews`에 결과 기록. 앱은 그 결과를 읽어 큐에 표시만 합니다.
- **장점**: 방화벽에 인바운드 구멍을 안 뚫어도 됨, 집 인터넷 그대로 사용 가능,
  **GPU가 꺼져 있어도 앱은 정상 동작**(검사만 늦게 붙음). 워커가 죽어도 앱은 안 죽습니다.

### 기각: 보안 터널(Cloudflare Tunnel / Tailscale)로 추론 엔드포인트 노출

- 앱이 실시간으로 GPU를 호출 → GPU가 **요청 경로**에 들어가 지연·가동률·보안 표면이 커짐.
  비개발자 1인 운영에는 부담. (필요해지면 나중에 옵션으로.)

> **"빌드 엔비디아" = build.nvidia.com / NVIDIA NIM.** NIM은 모델을 OpenAI 호환 API로 서빙하는
> 도커 컨테이너라 자체호스팅 경로로는 깔끔합니다. 다만 쓸만한 VLM은 **VRAM 16~24GB+** 를 요구하고,
> 일부 모델은 상용 시 NVIDIA AI Enterprise 라이선스 고려가 필요합니다(개발은 무료).

---

## 3. 데이터 모델 (나중에 마이그레이션 — 지금은 스펙만)

`submissions`를 건드리지 않기 위해 **별도 테이블**을 권장합니다(추가/삭제·재생성 자유, 핫 테이블 RLS 무영향).

```sql
-- (예시 스펙 — 실제 파일은 나중에 supabase/migrations/00XX_ai_review.sql 로 추가)
create table public.submission_ai_reviews (
  submission_id           uuid primary key references public.submissions(id) on delete cascade,
  status                  text not null default 'queued'
                            check (status in ('queued','done','error')),
  ocr_text                text,          -- 사진 속 손글씨 추출 전문
  summary                 text,          -- 핵심 요약(선생님 훑기용)
  suggested_reject_reason text,          -- 있으면 반려 후보, null = 통과 추천
  confidence              numeric,       -- 모델 확신도(정렬/경고용)
  model                   text,          -- 생성 백엔드 추적 (cloud:claude-* / local:nim-*)
  error                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

RLS:

- `select`: 교사(자기 반 제출물) + admin만. 기존 헬퍼 `teaches_class()` / `auth_role()` 재사용.
- `insert`/`update`: **정책 없음** → 오직 **service-role 클라이언트(워커)** 만 씀.
  (학생은 자기 검사 결과를 못 봄 — 반려사유는 교사가 확인·수정 후 `submissions.reject_reason`으로 전달.)

멱등: `submission_id`가 PK/unique라 재처리해도 upsert 1행. 재제출 시(사진 갱신) 워커가 다시 채움.

---

## 4. 생산자(워커) 계약 — 백엔드 교체 가능하게

핵심 설계 목표: **추론 백엔드만 갈아끼우면** 클라우드 ↔ 로컬을 오갈 수 있어야 함.
그래서 공통 인터페이스를 먼저 고정합니다.

```ts
// 어댑터 공통 인터페이스 (클라우드/로컬이 동일하게 구현)
interface HomeworkReviewer {
  reviewSubmission(
    photoUrls: string[],                 // 서명 URL로 내려받을 사진들
    ctx: { assignmentTitle: string; note: string; rubric?: string }
  ): Promise<{
    ocrText: string;
    summary: string;
    suggestedRejectReason?: string;      // 없으면 통과 추천
    confidence?: number;
    model: string;                       // "claude-opus-4-8" | "nim:qwen2-vl" 등
  }>;
}
```

폴링 워커 루프(의사코드):

```
반복:
  pending = select submissions where status='pending'
              and id not in (select submission_id from submission_ai_reviews where status='done')
  for sub in pending:
    urls = 서명 URL 생성(sub.photo_paths)         # lib/storage 패턴 재사용
    try:
      r = reviewer.reviewSubmission(urls, ctx)
      upsert submission_ai_reviews(sub.id, status='done', ...r)
    except e:
      upsert submission_ai_reviews(sub.id, status='error', error=str(e))
  sleep(interval)
```

### 어댑터 2종 (동일 인터페이스)

**☁️ 클라우드 어댑터 (권장 시작점)**

- Anthropic Messages API의 **비전(VLM)** 입력으로 사진을 보냄. Claude는 이미지 이해를 지원.
- 검사는 실시간일 필요가 없음(선생님이 몰아서 봄) → **Batch API**(비동기·약 50% 저렴) + **프롬프트 캐싱**
  (공통 루브릭·지시문 재사용)으로 비용을 크게 낮춤.
- 기본 모델: 정확도 우선 `claude-opus-4-8`, 저비용 우선 `claude-haiku-4-5`.
- **데이터 정책**: Anthropic API는 기본적으로 입력을 학습에 쓰지 않음. 제로리텐션 옵션도 존재 →
  학부모 동의 문구에 명시.

**🖥️ 로컬 어댑터 (프라이버시/규모용, 나중)**

- **NVIDIA NIM**(OpenAI 호환 엔드포인트) 또는 Ollama류에 오픈 VLM(예: Qwen2-VL, Llama 3.2 Vision, InternVL).
- 같은 `HomeworkReviewer` 인터페이스로 구현 → 워커는 코드 변경 없이 어댑터만 교체.
- 요구: VRAM 16~24GB+ GPU, 24시간 가동, 모니터링.

### 실행 위치 (나중 결정, 인터페이스가 같아 무관)

- (a) **온프렘 폴링 워커** — 로컬 GPU 기계에서 상시 실행(로컬 어댑터).
- (b) **Supabase Edge Function / cron** — 클라우드 어댑터면 서버리스로 처리 가능.
- (c) **별도 소형 서버**(예: 저가 VPS) — 클라우드 어댑터 호출 전용.

---

## 5. 교사 UI 통합 (읽기 전용 — 최종 승인은 사람)

`app/(teacher)/queue/page.tsx`와 검사 아이템 컴포넌트에 **AI 블록**을 추가:

- 🤖 **AI 요약** 한 줄 + **OCR 전문 접기/펼치기**.
- **자동 반려사유**가 있으면 → 반려 입력창에 **프리필**(선생님이 그대로 쓰거나 수정·무시).
  없으면 → "통과 추천" 힌트만.
- `submission_ai_reviews`가 **없으면(워커 미가동/처리 전) 아무것도 안 보임** → 앱 완전 정상(무해).
  → **점진 도입 안전**: 워커를 켜기 전에도 UI는 그대로, 켜면 자동으로 정보가 붙음.

**보상 로직·트리거는 전혀 바뀌지 않습니다.** `approveSubmission`/`rejectSubmission`(status만 변경) →
`trg_award_on_approve`가 지급. AI는 정보 제공만, 클릭은 사람.

---

## 6. 프라이버시 · 동의

숙제 사진 = **미성년 개인정보**(개인정보보호법/PIPA). 얼굴·이름·필체가 담길 수 있음.

- **클라우드 경로**: 사진이 외부 벤더로 전송됨 →
  - 학부모 **동의** 필요(아래 문구 예시).
  - 벤더의 **무학습·제로리텐션 정책** 명시.
- **로컬 경로**: 사진이 내 GPU 밖으로 안 나감 → 동의 부담↓, 대신 24시간 GPU 운영 부담↑.

**학부모 동의 문구 예시(클라우드 경로):**

> 우리 학원은 숙제 검사 보조를 위해 제출된 숙제 사진을 AI 서비스로 자동 분석합니다.
> 분석은 선생님의 검사를 돕기 위한 것이며, 최종 확인·승인은 항상 선생님이 합니다.
> 사진은 AI 모델 학습에 사용되지 않으며 분석 후 보관되지 않습니다.
> 동의하지 않으실 경우 AI 분석 없이 기존 방식(선생님 직접 검사)으로 진행됩니다. □ 동의합니다

---

## 7. 로컬 vs 클라우드 — 장단 비교

| 항목 | 🖥️ 로컬 (NVIDIA/NIM) | ☁️ 클라우드 VLM (예: Claude) |
|---|---|---|
| 한글 손글씨/수식 정확도 | △ 오픈 모델은 아직 약함 (최대 리스크) | ◎ 프런티어 모델이 확실히 우위 |
| 미성년 데이터 프라이버시 | ◎ 사진이 내 손 밖으로 안 나감 | ○ 외부 전송 → 동의 + 무학습·제로리텐션 필요 |
| 비용 | 하드웨어값 + 24h 전기·유지. 규모 크면 건당 0 | 건당 저렴(Batch 50%↓·캐싱). 대량도 월 수~수십 달러 수준 |
| 운영 부담 | ✕ GPU 상시 가동·워커 유지·드라이버·정전 = 사실상 서버관리 | ◎ 운영 0 (GPU 없음) |
| 커스터마이즈 | ◎ 내 기준·손글씨로 파인튜닝 가능 | ○ 프롬프트·예시로 조정 |
| 벤더 종속 | ◎ 없음 | △ 있음 |

**핵심 판단**: 1인 학원·실험실 기준에서 가장 어려운 건 "모델"이 아니라 **"운영"**(24h GPU + 워커 유지)이고,
정작 중요한 **한글 손글씨 정확도는 클라우드가 유리**합니다. 프라이버시는 로컬의 진짜 장점이지만
클라우드도 **동의 + 무학습/제로리텐션**으로 관리 가능합니다.

---

## 8. 권장 로드맵 (나중 구현 순서)

1. `submission_ai_reviews` 테이블 + RLS 마이그레이션.
2. 워커 공통 인터페이스 + **클라우드 어댑터**(가장 빠른 검증 경로).
3. 교사 큐 UI에 AI 블록(요약·OCR·반려사유 프리필). 워커 없을 때 무해 확인.
4. **학부모 동의** 받고 **소수 반 파일럿** → *시간 절감*과 *정확도*를 실제 측정.
5. 파일럿 결과 + 프라이버시 요구에 따라 **필요 시 로컬 NIM 어댑터로 교체**(인터페이스 동일).

> **결론적 권장**: 하드웨어·운영에 투자하기 전에, **클라우드 어댑터로 워크플로가 실제로
> 선생님 시간을 줄여주는지 먼저 검증**하세요. 검증되면 프라이버시/규모 요구에 맞춰 로컬로 스왑.
> 처음부터 "사진 외부 전송 절대 불가"가 확정이면 로컬로 시작하되 운영 현실을 각오하세요.

---

## 9. 재사용할 기존 자산

- `submissions`(`photo_paths`/`status`/`reviewed_by`) + `trg_award_on_approve`(`supabase/migrations/0001_init.sql`) — **무변경**.
- `lib/actions/submissions.ts`(`approveSubmission`/`rejectSubmission`) — 승인/반려 흐름 그대로.
- `lib/supabase/admin.ts`(service-role 클라이언트) — 워커가 결과 기록할 때.
- 서명 URL 생성(`lib/storage`), `lib/image.ts`(업로드 압축 → 추론 비용·시간↓).
- RLS 헬퍼 `auth_role()` / `teaches_class()`(`0001_init.sql`).
- 문서 톤: `SETUP.md`(한국어·비개발자 친화).

---

## 10. 검증 (나중 구현 시 E2E 체크리스트)

- [ ] 워커가 pending 제출을 잡아 `submission_ai_reviews`에 `done` 기록(멱등: 재처리해도 1행).
- [ ] 교사 큐에 요약·OCR·반려사유 프리필이 표시됨.
- [ ] 워커를 꺼도 앱·큐가 정상(무해) — AI 블록만 사라짐.
- [ ] 승인 시 `trg_award_on_approve` 동작 **무변경**(경험치·코인·진화 그대로).
- [ ] 학생은 `submission_ai_reviews`를 못 읽음(RLS), 교사는 자기 반만 읽음.
- [ ] (클라우드) 사진이 무학습·제로리텐션 정책으로 처리되는지 확인 + 동의 플로우 존재.
