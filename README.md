# 공방 AI 비서 터치 목업

`docs/기능정의서/feature-spec.md`에 정의된 화면 29개를 휴대폰과 태블릿에서 손가락으로 직접 눌러 보도록 만든 목업이다. AI나 외부 연동은 실제로 부르지 않는다. 비서가 쓰는 답장 초안과 음성 인식, 발송 결과는 미리 넣어 둔 데이터로 흉내만 낸다. 페이지를 새로 고치면 처음 데이터로 되돌아간다.

## 실행

버전은 Bun 1.4.4로 고정했다. 같은 버전을 `node_modules/.bin/bun`에 설치한다.

```bash
cd mockup
bun install
bun run dev      # 개발 서버, http://localhost:4173
bun run build    # dist/에 압축본까지 만든다
bun run start    # dist/를 서빙한다, http://localhost:4173
bun run typecheck
```

`public/` 폴더는 개발 서버가 내보내지 않는다. 시작 화면의 네이버 로그인 버튼 이미지를 보려면 `bun run build` 다음에 `bun run start`로 열어야 한다. 같은 와이파이에 붙은 휴대폰에서는 `http://<맥 IP>:4173`으로 들어가면 된다.

## 둘러보기

- 휴대폰(700px 미만)에서는 하단 탭 5개와 "비서에게 말하기" 입력창이 나온다. 상세 화면이 오른쪽에서 밀려 들어온다. 시트는 아래로 끌어내려 닫는다.
- 태블릿(700px 이상)에서는 왼쪽 레일과 목록·상세 2분할 배치로 바뀐다. iPad mini 세로(744px)도 태블릿 배치를 쓴다.
- 더보기의 "목업 보기 설정"에서 사장님·직원·열람자 역할을 고르고 빈 상태와 불러오기 오류 화면도 바꿔 본다. "시작하기 화면 다시 보기"를 누르면 온보딩 6단계가 다시 열린다.

## 화면과 주소

| 화면 ID | 주소 |
|---|---|
| SCR-ONB-001~006 | `#/onboarding/welcome`, `shop`, `class`, `policy`, `channel`, `ready` |
| SCR-HOM-001 | `#/today` |
| SCR-INB-001, 002 | `#/inbox`, `#/inbox/i1` |
| SCR-RSV-001~005 | `#/booking`, `#/booking?status=unpaid`, `#/booking/b1`, `#/booking/import`, `#/booking/classes` |
| SCR-APR-001 | `#/approvals`, `#/approvals/t2`, `#/approvals/rules` |
| SCR-OPP-001, 002 | `#/opp`, `#/opp/o1` |
| SCR-MKT-001 | `#/mkt` |
| SCR-DLV-001 | `#/dlv` |
| SCR-RPT-001 | `#/rpt` |
| SCR-SET-001~007 | `#/settings/shop`, `policy`, `templates`, `connections`, `staff`, `activity`, `account` |
| SCR-HLP-001 | `#/help`, `#/help/security` |
| SCR-CMN-001 | 모든 화면 아래의 "비서에게 말하기" |

## 반응성을 위해 한 일

- 첫 화면에 쓰는 JS는 gzip으로 약 33KB다. Preact와 Signals 말고는 쓰지 않는다. 화면은 주소별로 쪼개 두었다가 필요할 때 내려받는다. 나머지 화면은 브라우저가 한가한 틈에 미리 받아 둔다.
- 한 번 열었던 탭은 언마운트하는 대신 `content-visibility: hidden`으로 숨겨 둔다. 그래서 돌아와도 스크롤 위치와 필터가 그대로이고 화면을 다시 그리지 않는다. 탭을 바꿀 때 다음 화면이 그려지기까지 중앙값으로 22ms 걸렸다.
- 상태는 컬렉션 단위 signal로 쪼갰다. 어떤 값이 바뀌면 그 값을 읽는 컴포넌트만 새로 그린다.
- 애니메이션에는 `transform`과 `opacity`만 쓴다. 긴 목록의 행에는 `content-visibility: auto`를 걸었다.
- `bun run build`가 CSS를 HTML 안에 넣고 모든 파일마다 zstd·brotli·gzip 압축본을 만든다. `serve.ts`는 이 압축본을 메모리에 올려 두었다가 곧바로 보낸다. 해시가 붙은 파일에는 1년 캐시를 건다.
- 빌드 산출물 전체를 서비스 워커가 미리 저장해 둔다. 서버가 꺼져 있어도 페이지가 다시 열린다.

디자인 규칙은 `DESIGN.md`에 따로 정리했다.
