# Frame · Shortform Studio

클라이언트 1명을 위한 독립 숏폼 제작 웹서비스의 P0 코드입니다. 이 폴더는 독립 프로젝트이며 기존 대시보드와 데이터·로그인·배포를 공유하지 않습니다.

## 생성 흐름

1. 상품 정보와 참고 이미지를 등록합니다.
2. OpenAI가 30초 한국어 스토리보드를 생성합니다.
3. 각 대본을 검토·승인합니다.
4. Nano Banana가 상품 참고 이미지를 반영한 9:16 장면 이미지를 생성합니다.
5. 각 이미지를 검토·승인한 뒤 Gemini TTS로 한국어 내레이션을 생성합니다.
6. 내레이션 길이를 확인·승인한 뒤 Gemini Omni Flash가 승인 이미지를 영상으로 만듭니다.
7. FFmpeg가 영상, 승인 음성, 자막, CTA와 선택한 배경음을 합쳐 MP4를 생성합니다.

각 유료 생성 전에 원화 예상 비용을 표시하고 확인을 받습니다. 프로젝트 10,000원, 한국시간 달력 월 100,000원 한도에는 진행 중 예약액과 실제 사용액이 함께 반영됩니다.

## 로컬 실행

Node.js 24 이상이 필요합니다.

```sh
npm ci
npm run dev
npm run worker
```

- 화면 미리보기: http://localhost:3100/preview
- 실제 로그인 화면: http://localhost:3100
- 프로젝트 위치: `C:\Users\user\Documents\ChatGPT\숏폼 자동화 생성기`

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 클라이언트 소유 계정의 값을 설정합니다. 비밀 키를 코드나 문서에 저장하지 마세요.

| 변수 | 용도 |
|---|---|
| `APP_URL` | 서비스의 HTTPS 기본 주소 |
| `CLIENT_EMAIL`, `ADMIN_EMAIL` | 최초 가입을 허용할 클라이언트와 운영자 이메일 |
| `ALLOWED_EMAILS` | 추가 가입 허용 이메일. 여러 개는 쉼표로 구분 |
| `ALLOW_PUBLIC_SIGNUP` | 공개 회원가입 여부. 비용 악용 방지를 위해 기본 `false` |
| `SESSION_SECRET` | 32자 이상 세션·파일 서명 키 |
| `SMTP_USER` | 가입 인증 메일을 발송할 Gmail 주소 |
| `SMTP_APP_PASSWORD` | Gmail 2단계 인증에서 생성한 16자리 앱 비밀번호 |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | 구조화된 스토리보드 생성 |
| `GEMINI_API_KEY` | Nano Banana, Gemini TTS, Gemini Omni Flash 공용 키 |
| `GEMINI_IMAGE_MODEL` | 기본 `gemini-3.1-flash-lite-image` |
| `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE` | 한국어 음성 모델과 기본 음성 |
| `GEMINI_VIDEO_MODEL` | 기본 `gemini-omni-1.1-flash` |
| `RATES_REVIEWED_AT` | 요율을 마지막으로 확인한 날짜 |
| `USD_TO_KRW` | 견적에 적용할 달러 원화 환산율 |
| `GEMINI_IMAGE_USD_PER_IMAGE` | 이미지 한 장의 달러 비용 |
| `GEMINI_VIDEO_USD_PER_SECOND` | 영상 출력 1초의 달러 비용 |
| `GEMINI_TTS_USD_PER_MINUTE` | TTS 출력 1분의 달러 비용 |
| `GEMINI_VIDEO_RESERVE_SECONDS` | 영상 요청 1건의 보수적 예약 초. 기본 10초 권장 |
| `SCRIPT_MAX_KRW` | 대본 요청의 최소 예약액 |
| `OPENAI_INPUT_KRW_PER_MILLION`, `OPENAI_OUTPUT_KRW_PER_MILLION` | 대본 모델 백만 토큰당 원화 요율 |
| `FFMPEG_PATH`, `FFPROBE_PATH` | 미디어 처리 도구 경로 |
| `FONT_PATH`, `FONT_NAME` | 한국어 자막 폰트 |
| `DATA_DIR` | SQLite와 비공개 파일을 보관할 영구 볼륨 |

모델과 가격은 변경될 수 있으므로 배포 시 공식 가격표와 실제 결제 계정의 이용 가능 모델을 확인한 뒤 요율 날짜를 갱신해야 합니다.

## 배포

- Next.js 16.3.1, React, Node.js 24, SQLite, 별도 Node worker와 FFmpeg를 사용합니다.
- Railway에서는 웹과 worker를 단일 서비스에서 실행하고 `DATA_DIR=/app/data`에 영구 볼륨을 연결합니다.
- Target Port는 `3100`, 헬스체크는 `/api/health`입니다.
- 단일 호스트·단일 worker lease를 전제로 하며 서버리스 임시 파일시스템이나 다중 복제 환경은 P0 범위가 아닙니다.
- 재배포 중 요청 상태가 불명확해지면 자동 재요청하지 않습니다. 운영 화면에서 Gemini 작업 ID와 실제 과금을 확인해 정산합니다.

## 품질과 운영 제한

- Nano Banana 출력에서 상품 포장·로고·라벨이 달라질 수 있으므로 이미지 승인은 필수입니다.
- Omni 영상에는 별도 내레이션을 넣지 않습니다. 승인된 Gemini TTS 음성을 최종 합성에서 사용하므로 장면 영상과 내레이션이 독립적으로 재생성됩니다.
- 정확한 입 모양 동기화와 말하는 아바타는 현재 범위에 포함하지 않습니다.
- 생성 이미지와 영상에는 Google SynthID가 포함됩니다.
- 파일은 업로드·생성 후 30일 보관합니다. 활성 작업 중에는 삭제를 유예합니다.
- 배경음은 외부 라이선스가 필요 없는 코드 생성 앰비언트 프리셋과 미사용 옵션만 제공합니다.

## 검증

```sh
npm test
npm run typecheck
npm run build
node tests/browser.mjs
```

통합 테스트는 외부 통신을 차단하고 `대본 → 이미지 → 음성 → 영상 → 합성`과 각 승인 단계를 실제 DB, worker, FFmpeg로 검증합니다. 실제 Gemini 호출은 별도로 소액 장면 한 개부터 확인해야 합니다.

## 공식 문서

- [Nano Banana 이미지 생성](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini Omni Flash 영상 생성](https://ai.google.dev/gemini-api/docs/omni)
- [Gemini 한국어 TTS](https://ai.google.dev/gemini-api/docs/speech-generation?hl=ko)
- [Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
