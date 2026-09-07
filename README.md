# Frame · Shortform Studio

클라이언트 1명을 위한 독립 숏폼 제작 웹서비스의 P0 코드입니다. 이 폴더는 독립 프로젝트이며, 기존 대시보드와 데이터·로그인·배포를 공유하지 않습니다.

## 현재 상태

- 로그인 화면, 프로젝트 생성·저장, 이미지 업로드, 대본 생성·편집·승인, 전체 아바타 카탈로그, 음성·영상 생성·승인, 개별 재생성, 과거 영상 선택, 자막·상품 이미지·CTA·배경음 합성, MP4 다운로드를 구현했습니다.
- 프로젝트 10,000원 / 한국시간 달력 월 100,000원 한도는 SQLite 트랜잭션으로 함께 검사합니다. 진행 중 예약액과 실제 비용을 이중 계산하지 않습니다.
- 생성은 별도 worker가 처리합니다. 작업 ID가 확인된 요청은 조회하고, 요청 결과가 불명확하면 예약액을 유지한 채 운영 확인 상태로 전환합니다.
- 계정 정보는 아직 설정되지 않았습니다. **실계정 생성·실제 이메일 발송·공개 HTTPS 배포는 검증하지 않았으며 PRD의 출시 완료 상태가 아닙니다.**
- `/preview`는 별도 브라우저 미리보기입니다. 샘플 데이터와 편집만 로컬에 저장하고 유료 API·이메일·파일 생성에는 접근하지 않습니다. 테스트 영상은 AI 아바타 결과가 아닙니다.

## 빠르게 확인

Node.js 24 이상이 필요합니다.

```sh
npm ci
npm run dev
```

- 화면 미리보기: http://localhost:3100/preview
- 실제 로그인 화면: http://localhost:3100

프로젝트 위치: `C:\Users\user\Documents\ChatGPT\숏폼 자동화 생성기`. 이 폴더의 `node_modules`를 사용하며 기존 대시보드의 의존성을 참조하지 않습니다. 다른 위치로 복사할 경우 `npm ci`로 설치합니다.

## 실제 연결

`.env.example`을 `.env.local`로 복사하여 **클라이언트 소유 계정의 값**을 설정합니다. 키를 PRD·채팅·코드에 붙이지 마세요.

| 변수 | 용도 |
|---|---|
| `APP_URL` | 사용자와 Creatify가 접근할 HTTPS 기본 주소. 로컬 개발은 http://localhost:3100 |
| `CLIENT_EMAIL` | 허용할 클라이언트 이메일 하나 |
| `ADMIN_EMAIL` | 별도의 개발자 운영 이메일 |
| `SESSION_SECRET` | 무작위 32자 이상 비밀값. 음성 파일의 단기 전달 주소 서명에 사용 |
| `RESEND_API_KEY`, `MAIL_FROM` | 이메일 링크 전송용 계정과 인증된 발신 주소 |
| `CREATIFY_API_ID`, `CREATIFY_API_KEY` | Creatify 공식 API 인증값 |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Structured Outputs를 지원하는 대본 모델의 키와 모델 ID |
| `RATES_REVIEWED_AT` | 해당 계정의 가격·환산 기준을 확인한 날짜 |
| `KRW_PER_CREDIT` | 실제 계약과 환율을 반영한 Creatify 크레딧당 원화 |
| `SCRIPT_MAX_KRW` | 대본 요청 예약액의 최소 기준. 입력량·출력 한도를 이용한 보수적 계산값보다 작으면 계산값 적용 |
| `OPENAI_INPUT_KRW_PER_MILLION`, `OPENAI_OUTPUT_KRW_PER_MILLION` | 선택 모델의 입력·출력 백만 토큰당 원화 요율 |
| `CREATIFY_MODEL` | `standard`, `aurora_v1`, `aurora_v1_fast`. 기본값 standard |
| `MEDIA_HOSTS` | 공급자 결과 URL의 신뢰할 수 있는 정확한 호스트명 목록. 쉼표 구분, 와일드카드 미지원 |
| `FFMPEG_PATH`, `FFPROBE_PATH` | 미디어 도구 경로. FFPROBE_PATH가 없으면 FFmpeg로 길이를 측정 |
| `FONT_PATH`, `FONT_NAME` | 선택 사항. 로컬 한국어 폰트를 합성에 사용. Linux 이미지에는 Noto CJK 설치 |
| `DATA_DIR` | DB·비공개 파일을 보관할 영구 로컬 볼륨. 기본 `./data` |

설정 후 웹서버와 별도 worker를 실행합니다.

```sh
npm run dev
# 다른 터미널
npm run worker
```

`APP_URL`이 localhost이면 Creatify가 승인 음성을 내려받을 수 없습니다. 실제 영상 연동 검증에는 클라이언트 HTTPS 주소와 서명 파일 접근이 필요합니다. 공급자 파일 다운로드는 명시된 `MEDIA_HOSTS`만 허용하고 리디렉션은 따르지 않습니다.

## 배포 구성

- Next.js 16.3.1 + React / Node.js 24 SQLite + 별도 Node worker / FFmpeg.
- 1인 P0용 **단일 호스트·영구 볼륨** 구성입니다. 웹·worker가 같은 로컬 SQLite DB와 파일 볼륨을 공유합니다. 서버리스 임시 파일시스템이나 다중 호스트 복제 구성으로 배포하지 않습니다.
- `compose.yaml`은 웹과 worker를 함께 실행하는 구성입니다. 웹은 호스트의 `127.0.0.1:3100`에만 연결됩니다. 클라이언트 도메인을 사용하는 HTTPS 역방향 프록시를 앞에 설정해야 합니다.
- Railway의 단일 서비스 배포에서는 Docker entrypoint가 영구 Volume의 쓰기 권한을 준비한 뒤 웹과 worker를 함께 실행합니다. `DATA_DIR=/app/data`와 같은 경로에 Railway Volume을 연결하고 웹서버의 Target Port는 `3100`으로 설정합니다. 둘 중 하나가 비정상 종료되면 컨테이너를 종료하여 Railway가 전체 서비스를 재시작하도록 합니다.
- Railway 헬스체크 경로는 `/api/health`입니다. 웹과 worker가 모두 준비되면 HTTP 200과 `{"status":"ok","worker":true}`를 반환합니다.
- `Caddyfile.example`을 참고해 HTTPS를 구성할 수 있습니다. 실제 계정 생성·서버 계약·도메인 연결·배포는 수행하지 않았습니다.
- worker는 DB lease로 한 프로세스만 동작합니다. 비정상 종료 후 재시작은 최대 3분의 lease 만료를 기다릴 수 있습니다. 요청 중 종료된 작업은 자동 재발행하지 않습니다.
- 백업은 SQLite online backup으로 DB를 저장하고 관련 파일을 함께 보존해야 합니다. 실행 중인 DB 파일만 단순 복사하는 방식은 피합니다. 백업 보관 기간과 복구 책임은 유지보수 계약에서 정합니다.

## 동작상 주의할 실제 제한

1. **공급자 기능**: 아바타 Lipsync API는 승인한 오디오를 재사용합니다. 장면 설명은 기획 메모이며, 상품 이미지는 FFmpeg로 화면 위에 합성합니다. 장면 설명만으로 임의의 의상·배경·카메라 장면을 만드는 기능은 제공하지 않습니다.
2. **콘텐츠 품질**: 실제 한국어 음성·아바타 조합, 립싱크, 상품 스토리형 광고 품질은 클라이언트 자료로 검수해야 합니다. 카탈로그 미리보기 존재만으로 한국어·모델 사용 권한을 확정하지 않습니다.
3. **요율**: 원문의 ‘씬당 300원 이하’ 추정은 사용하지 않았습니다. 공식 문서에도 모델별 과금 수치가 서로 다른 페이지가 있어 계정 요율을 직접 확인해야 합니다. 실제 비용이 예약 추정을 초과하면 실제액을 기록하고 후속 생성을 제한합니다. 외부 청구액의 절대 상한을 보장하지 않습니다.
4. **음성·타이밍**: TTS 길이를 실제 측정하여 긴 음성의 승인을 막습니다. 기본 씬 자막은 씬 시작부터 종료까지 표시합니다. 단어별 강조·정밀 자막 편집은 후속 범위입니다.
5. **보관**: 파일별 업로드·생성 시각부터 30일. 활성 작업은 파일 삭제를 유예합니다. 사용자 삭제는 즉시 접근을 차단하고 worker가 파일을 정리합니다. 비용·승인·감사 기록의 장기 보관과 백업 삭제 정책은 운영 계약에 남아 있습니다.
6. **배경음**: 외부 음원 라이선스 없이 사용할 수 있도록 코드로 합성한 간단한 앰비언트 프리셋 1개와 미사용 옵션을 제공합니다.
7. **운영 복구**: 실패·결과 불명 작업의 예약액은 자동으로 0원 처리하지 않습니다. 공급자에서 완료·과금 여부를 확인한 뒤 운영 화면에서 실제액을 정산합니다. 작업 ID가 확인되면 `/api/operations`의 `providerId`로 기존 작업을 다시 조회할 수 있습니다. 기존 작업 종료를 확인하기 전에는 새 과금 작업을 실행하지 마세요.

## 검증

```sh
npm test
npm run typecheck
npm run build
node tests/browser.mjs  # localhost:3100 개발 서버와 Playwright 브라우저 필요
```

- 단위 테스트: 승인 순서, 근거 누락, 길이 초과, 프로젝트 소유권, 링크 만료·재사용, 중복 실행, 변경된 견적, 프로젝트·월간 한도.
- 브라우저: 대시보드·씬 편집·저장·재접속·모바일 가로 넘침·비로그인 API 차단.
- 미디어: 로컬 FFmpeg 테스트 소스로 1080×1920·30초·한국어 번인 자막·CTA·배경음 MP4 생성 및 프레임 육안 확인.
- 파이프라인: `tests/pipeline.mjs`는 외부 통신을 전부 차단·대체한 테스트입니다. 대본→승인→음성→승인→영상→승인→합성을 실제 DB와 worker, FFmpeg로 검증했습니다. `test-results/tools/ffmpeg.exe` 등 로컬 테스트 도구가 필요합니다.

## 공식 문서 확인 기록

2026-09-05~06 확인. 예제 백서의 `/v1/parser`, `/v1/video/avatar`, Bearer 인증을 구현에 사용하지 않았습니다.

- [Creatify TTS](https://docs.creatify.ai/api-reference/text-to-speech/post-text-to-speech): `/api/text_to_speech/`, X-API-ID / X-API-KEY.
- [Creatify Lipsync](https://docs.creatify.ai/api-reference/lipsyncs/post-apilipsyncs): `/api/lipsyncs/`, 승인 오디오의 `audio` URL과 `9x16` 사용.
- [아바타 카탈로그](https://docs.creatify.ai/api-reference/personas/get-apipersonas-paginated): 전체 페이지 탐색.
- [음성 목록](https://docs.creatify.ai/api-reference/voices/get-apivoices): 음성과 accent ID, 미리보기.
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Responses API의 JSON Schema 출력.

## 납품 전 남은 검증

- 클라이언트 API·이메일·서버 계정 연결, 계정별 원화 요율 설정.
- 실제 이메일 수신·로그인, HTTPS 서명 음성 전달, 공급자 결과 호스트 등록.
- 세 콘텐츠 유형의 실제 아바타 생성 완주 및 품질·비용 검수.
- 서버·저장소 백업·복구와 유지보수 계약 범위 확인.
