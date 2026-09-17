---
name: playground-deploy
description: Use whenever the user wants to deploy this app (or is planning ahead for deploying it) to the company's internal "Playground" platform, or needs to do database work tied to that move — e.g. "Playground에 배포해줘", "DB 옮겨야 하는데", provisioning a shared database, moving off Vercel, or anything that mentions the internal "Playground" platform. Also consult this when touching server/db connection code (server/src/db.js, env vars, the esbuild api bundle) since those directly affect the future platform migration.
---

# Playground 배포 & DB 마이그레이션

이 스킬은 이 프로젝트(SJC2 Capacity Schedule)를 사내 "Playground" 플랫폼으로
옮길 때 쓰는 러닝 런북이다. Playground 자체의 구체적인 배포 방식/DB는 아직
아무도 모르는 상태로 시작했으므로, 알게 되는 대로
[references/playground-platform.md](references/playground-platform.md)에
계속 채워 넣어서 다음번엔 다시 묻지 않아도 되게 만드는 것이 핵심이다.

## 이 프로젝트의 현재 배포/DB 구조 (코드 기준, README보다 최신)

- **DB**: 이미 로컬 sqlite가 아니라 **Supabase Postgres**로 전환 완료
  (`server/src/db.js`). `pg` Pool을 쓰고, 기존 sqlite 스타일 `?` / `@name`
  플레이스홀더를 Postgres `$1, $2...`로 변환해주는 얇은 래퍼가 있음.
  - `README.md`는 sqlite 시절 문서라 실제와 다르다 — 코드와 `server/.env`가
    진실이다. README를 신뢰하지 말 것.
  - `DATABASE_URL` 환경변수 필수 (Supabase pooler connection string).
- **배포**: 현재 Vercel. npm workspaces 모노레포에서 Vercel 원격 빌드가 서버
  의존성(express, jsonwebtoken 등)을 간헐적으로 누락시키는 문제가 있어서,
  `npm run build:api` (esbuild)로 `server/src` 전체를 의존성까지 포함해
  `api/index.generated.cjs` 하나로 미리 번들링해 커밋해두고 그걸 배포한다.
  **`server/src`를 고치면 반드시 `npm run build:api`를 다시 실행하고 결과물을
  같이 커밋해야 배포에 반영된다.**
- **필요한 env var**: `DATABASE_URL`, `ADMIN_PASSWORD`, `VIEWER_PASSWORD`,
  `JWT_SECRET`, `LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`.
- **시딩**: `npm run seed` (최초 1회). 강제 리셋은 `SEED_FORCE=1 npm run seed`
  — 기존 데이터를 전부 지우니 이미 운영 중인 DB에는 절대 실행하지 말 것.

## Playground 플랫폼 자체 정보

먼저 [references/playground-platform.md](references/playground-platform.md)를
읽어라. 아직 "(미정)"으로 비어있다면, 사실상 이번이 이 스킬의 첫 실전 실행이다.

### 첫 실행 절차 (references 파일이 비어있을 때)

Playground에 실제로 배포하거나 DB를 옮겨야 하는 시점이 오면, 진행 전에
AskUserQuestion이나 채팅으로 아래를 먼저 물어봐라. 짐작으로 커맨드를
지어내지 말 것 — 사내 플랫폼 세부사항은 사용자만 알 수 있다.

1. **배포 방식** — 웹 콘솔에서 git push? 전용 CLI 툴? Docker 이미지 업로드?
   CI/CD 연동? 관련 사내 가이드 문서나 URL이 있는지.
2. **데이터베이스** — Postgres/MySQL/Oracle/기타 중 무엇을 제공하는지, 프로비저닝은
   어떻게 하는지(콘솔 신청 등), 커넥션 스트링/자격증명을 어떻게 받는지.
3. **시크릿/환경변수 주입 방법** — 콘솔에 직접 입력? Vault 연동? `.env` 업로드?
4. **참고할 기존 배포 사례나 템플릿 레포**가 있는지.

답을 받으면 **그 자리에서 바로 `references/playground-platform.md`를 갱신해서
저장해라.** 다음번 이 스킬이 트리거될 때는 다시 묻지 않고 곧장 실행 단계로
넘어가는 것이 이 스킬의 존재 이유다.

## DB 마이그레이션 체크리스트 (Playground가 다른 DB를 요구하는 경우)

이미 Postgres(Supabase)로 되어 있으므로 갈아탈 DB 종류에 따라 다르다:

- **Playground도 Postgres라면**: `DATABASE_URL`만 새 값으로 바꾸면 됨. 스키마는
  `server/src/seed.js`와 각 `server/src/routes/*.js`의 `CREATE TABLE`/쿼리를
  참고해서 새 DB에 재적용.
- **MySQL/Oracle 등 다른 엔진이면**: `server/src/db.js`의 `normalize()`가
  Postgres 전용 `$1, $2...` 스타일이므로, 플레이스홀더 변환 로직과 드라이버
  (`pg` → 해당 DB 드라이버)를 함께 바꿔야 한다. `RETURNING id`, `ON CONFLICT`
  같은 Postgres 전용 문법이 라우트 코드에 쓰였는지도 확인.
- **커넥션 풀링**: Playground가 서버리스/멀티 인스턴스 구조라면 Supabase의
  pooler처럼 별도 pooler가 필요한지 확인 (동시 커넥션 수 제한 이슈).

## 배포 체크리스트 (Playground 방식이 확정된 후)

1. `references/playground-platform.md`에서 배포 명령/방식 확인.
2. `npm install` (workspaces 전체) → `server/src`를 고쳤다면 `npm run build:api`
   → `npm run build` (client).
3. env var 세팅 — 값은 `server/.env.example` 참고, 주입 방법은 references 파일 참고.
4. 배포 후 헬스체크: 로그인 API 호출해서 200 확인, 대시보드 화면 로드 확인.
5. 첫 배포가 아니라면 절대 `SEED_FORCE=1`로 재시딩하지 말 것 (기존 데이터 삭제됨).
