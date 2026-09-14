# SJC2 Capacity Schedule — Web Application

`SJC2_Capacity_Schedule_v2_3_3.xlsx`를 대체하는 공유 웹 애플리케이션입니다.
Excel의 모든 시트(Capacity_Design, Lightup_Schedule, Funnel, Contracts, KPIs,
내부수요, Revenue_Monthly, Dashboard, Log)에 대응하는 기능을 제공하며, 여러
사용자가 하나의 데이터베이스를 함께 보고 수정할 수 있습니다.

## 구조

- `server/` — Node.js(Express) + 내장 `node:sqlite` 기반 REST API. 계약의
  파생값(대역폭, 만료일, USD 환산 매출 등)과 대시보드 집계를 Excel 수식과
  동일한 로직으로 서버에서 계산합니다.
- `client/` — React(Vite) 기반 SPA. 대시보드, 각 시트별 편집 화면, 매출 리포트,
  변경 이력, 설정 화면을 제공합니다.

## 실행 방법

```bash
npm install        # 루트에서 한 번만 (server + client workspace 전체 설치)
npm run seed        # 최초 1회: 첨부된 xlsx에서 추출한 데이터로 DB 시딩
npm run dev         # server(:4000) + client(:5173) 동시 실행
```

브라우저에서 `http://localhost:5173` 접속.

- DB 파일은 `server/data/app.db` (SQLite)에 저장되며, 최초 실행 시 자동 생성됩니다.
- 이미 시딩된 상태에서 다시 초기 데이터로 리셋하려면: `SEED_FORCE=1 npm run seed`
  (기존 데이터가 모두 삭제되니 주의)

## 주요 기능 (Excel 시트 대응)

| 화면 | Excel 시트 | 설명 |
|---|---|---|
| 대시보드 | Dashboard | KPI, Segment S/L 사용률·용량 상세, 매출/Funnel/Lightup 요약, 연도별 매출 차트 |
| Capacity Design | Capacity_Design | Segment 설계 용량 + 한-싱 단계별 증설 계획 |
| Lightup Schedule | Lightup_Schedule | 구축 일정/상태/예상비용 |
| Funnel | Funnel | 영업 파이프라인 (Prospect→Negotiation→Signed→Active) |
| Contracts | Contracts | 계약 목록 — 대역폭/만료일/월매출/총매출이 서버에서 자동 계산 |
| 수익성 / Revenue | Revenue_Monthly | 계약별 매출을 시작일~만료일 사이 월별로 비례 인식하여 연도별/월별 집계 |
| 내부수요 (Gap) | 내부수요 | IP백본 Segment S/L 반기별 수요 전망 |
| 변경 이력 | Log | 모든 추가/수정/삭제가 자동 기록 |
| 설정 | KPIs, 환율 | ₩/$ 기준환율, 연도별 KPI 메모 |

## 로그인 / 권한

admin/viewer 공유 비밀번호 기반 로그인이 있습니다 (`server/.env`의 `ADMIN_PASSWORD`,
`VIEWER_PASSWORD`, `JWT_SECRET`). 로그인 시 사번을 입력하고 admin/viewer 권한을 선택한 뒤,
선택한 권한에 해당하는 비밀번호를 입력합니다. 관리자는 "로그인 기록"
메뉴에서 누가 언제 로그인했는지 확인할 수 있습니다. viewer는 모든 화면을 조회만 할 수
있고 추가/수정/삭제는 admin만 가능합니다 (서버 API도 동일하게 제한됩니다).

## 케이블 프로젝트 / 외부 자료 / 챗봇

- 좌측 상단 SJC2 / E2A / PAE 버튼으로 케이블을 전환할 수 있습니다. E2A(2028 서비스 예정),
  PAE(2031 서비스 예정)는 간단 개요 페이지이며 admin이 내용을 입력/수정합니다.
- "외부 자료" 메뉴에 submarinecablemap.com, subtelforum.com 링크가 있습니다.
- 우하단 챗봇은 이 앱의 내부 데이터만 근거로 답변합니다. `LLM_PROVIDER`가 설정되지
  않으면 안내 메시지만 표시됩니다. 사내 LLM 연동 시 `server/.env`에
  `LLM_PROVIDER=internal`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`을 채우면 됩니다
  (Anthropic API를 쓰는 경우 `LLM_PROVIDER=anthropic`). Vercel 배포본에도 동일한 환경변수를
  추가해야 합니다.

## 데이터 정확성 참고사항

Contracts 시트를 그대로 베끼지 않고, 원본 컬럼(MRC/OTC/연O&M/기간/환율)에서
매번 새로 계산하도록 구현했습니다. 그 과정에서 원본 Excel의 실제 버그를
발견했습니다: 3개 Active Lease 계약(MS×2, AWS)의 헬퍼 수식 컬럼(W~AE)이
마지막까지 드래그되지 않아 Dashboard의 Lease MRC/누적매출 KPI에서 조용히
누락되고 있었습니다. 이 웹앱은 원본 필드에서 항상 다시 계산하므로 이런 종류의
누락이 구조적으로 발생하지 않습니다.
