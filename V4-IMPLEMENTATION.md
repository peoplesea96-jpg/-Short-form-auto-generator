# Frame v4 P0 구현 및 운영 연결 안내

작성일: 2026-10-12. 구현 위치는 이 문서가 있는 `Frame-v3` 폴더입니다. 기존 폴더명을 유지했습니다.

## 구현한 흐름

1. 새 프로젝트에서 이미지·영상 기본 모델을 따로 선택합니다. 기존 프로젝트는 기존 연결을 유지합니다.
2. 장면 이미지·영상 단계에서 `프로젝트 기본 모델 사용`을 해제하면 해당 씬만 다른 모델·규격을 저장할 수 있습니다.
3. 생성 전에 모델 버전, 규격, 씬 사용 길이, 공급자 생성 요청 길이와 예상 비용을 확인합니다.
4. 이미 결과가 있으면 `비교 후보 추가`로 생성합니다. 기존 선택과 승인 상태는 유지됩니다.
5. 후보를 나란히 확인한 뒤 직접 선택하고 승인합니다. 이미지 선택을 바꾸면 음성·영상 승인을 재검토하고 영상 선택을 해제합니다. 음성 파일은 보존합니다.
6. 연출·참고 자료·이미지·길이가 달라진 후보는 현재 결과로 선택하거나 승인할 수 없습니다. 기존 파일과 완성본은 보존됩니다.

기본 설정 변경은 재생성을 실행하지 않습니다. 개별·일괄 생성 모두 저장된 씬별 모델을 따릅니다. 기존 상품 시트, 공통 음성, 씬별 TTS/ElevenLabs, 15~180초 타임라인은 유지합니다.

## 연결 경로와 검증 수준

| 선택 항목 | 구현 경로 | 지원 조건 | 현재 확인 수준 |
|---|---|---|---|
| Nano Banana | 기존 Gemini Interactions 연결, `GEMINI_IMAGE_MODEL` | 기존 9:16·1K | 기존 연결 보존. 설정된 모델 버전의 공식 지원·계정 접근 재확인 필요 |
| GPT Image | OpenAI Images API, `gpt-image-1.5` | 1024×1536·high, 참조가 있으면 edits | 공식 요청 형식 확인, 모의 검증. 전체 상품을 보존하며 9:16 여백 처리 |
| Seedance | Higgsfield `bytedance/seedance-2.5/image-to-video` | 4~30초, 480p/720p/1080p, 생성 음성 끔 | 공식 요청 형식 확인, 모의 검증 |
| Kling | Higgsfield `kling-video/v3.0/std/image-to-video` | 3~15초, standard, 음성 끔 | 공식 요청 형식 확인, 모의 검증 |
| MiniMax | Higgsfield `minimax/hailuo-2.3/standard/image-to-video` | 6초 또는 10초, standard | 공식 요청 형식 확인, 모의 검증. 10초 초과 씬은 차단 |
| 기존 영상 | 기존 Gemini Interactions, `GEMINI_VIDEO_MODEL` | 기존 옵션 | 기존 연결 보존, 새 계정 접근 검증과 구분 |

Higgsfield의 공개 개발자 이미지 목록에서 지정한 두 이미지 계열의 경로를 확인하지 못해 임의 엔드포인트를 만들지 않았습니다. 이미지 직접 연결과 Higgsfield 영상 연결을 조합합니다. Higgsfield 웹 구독과 개발자 API 잔액·권한은 별도로 확인해야 합니다.

**실제 키·계정별 접근·공급자 청구액·유료 결과 품질은 이번 작업에서 검증하지 않았습니다.** 카탈로그도 설정 여부와 실제 생성 검증을 구분합니다.

## 배포 전 운영 설정

서버 비밀 변수로 설정하며 프런트 코드나 공유 HTML에 넣지 않습니다. `.env.example`에 빈 항목을 추가했습니다.

| 변수 | 값의 기준 |
|---|---|
| `HIGGSFIELD_API_KEY` | 공식 `Authorization: Key <credential>` 형식에서 `<credential>`에 들어갈 전체 자격 증명. `Key ` 접두어는 넣지 않음 |
| `HIGGSFIELD_UPLOAD_HOSTS` | 공식 signed upload 응답의 업로드 URL 호스트를 정확히 등록. 쉼표 구분, 와일드카드 없음 |
| `MEDIA_HOSTS` | 공급자 결과 영상 URL의 공식 파일 호스트. 쉼표 구분, 와일드카드 없음 |
| `GPT_IMAGE_RESERVE_USD_PER_IMAGE` | high 출력과 최대 참조 이미지·텍스트 입력 비용을 포함한 보수적 예약 단가 |
| `HIGGSFIELD_SEEDANCE_480P_USD_PER_SECOND` | 해당 해상도·입력 비율에 대해 계정에서 검토한 초당 단가 |
| `HIGGSFIELD_SEEDANCE_720P_USD_PER_SECOND` | 동일 |
| `HIGGSFIELD_SEEDANCE_1080P_USD_PER_SECOND` | 동일 |
| `HIGGSFIELD_KLING_USD_PER_SECOND` | standard, sound off 조건의 계정 검토 단가 |
| `HIGGSFIELD_MINIMAX_6S_USD_PER_CLIP` | 6초 클립 전체 단가 |
| `HIGGSFIELD_MINIMAX_10S_USD_PER_CLIP` | 10초 클립 전체 단가 |
| `USD_TO_KRW`, `RATES_REVIEWED_AT` | 검토한 환산율과 검토일. 기존 변수 재사용 |

새 요율은 임의 가격·프로모션 가격으로 채우지 않았습니다. 운영 계정의 공식 설정/응답으로 파일 호스트를 확인한 뒤 등록해야 합니다. 허용되지 않은 주소에는 인증 정보를 보내거나 파일을 다운로드하지 않습니다. 결과 호스트 차이로 수신에 실패하면 공급자 작업 ID와 비용 예약을 유지하고 운영자가 호스트를 검토한 후 같은 작업을 다시 조회합니다.

작업에 자격 증명 참조 `{owner: 'operator', provider: ...}`를 저장합니다. 개인 키 저장·선택 화면은 P1입니다. 진행 중에는 운영 키를 변경하지 않는 것을 전제로 하며, 교체가 필요하면 진행 작업부터 정리합니다.

## 비용·실패 처리

- 5초 씬에 MiniMax를 쓰면 6초 클립 단가, 2초 씬에 Kling을 쓰면 3초 단가로 예약합니다. 최종 편집 길이로 낮춰 계산하지 않습니다.
- 환율·단가·모델·규격·생성 길이는 접수 당시 스냅샷으로 저장합니다. 같은 금액이라도 견적 이후 모델 버전 등이 바뀌면 재확인을 요구합니다.
- 프로젝트 ₩10,000 / 월 ₩100,000의 기존 한도를 트랜잭션 안에서 확인합니다. 중복 요청 ID는 기존 작업을 반환합니다.
- 완료 시 기록하는 금액도 설정 단가에 따른 **추정액**입니다. 공급자 실제 청구 확인과 구분합니다.
- 유료 POST가 끊기거나 결과·과금이 불명확하면 자동 재생성하지 않고 예약을 유지합니다. 명확한 요청 거절은 실패로 처리합니다.
- Higgsfield 조회의 일시적 오류는 GET만 재시도합니다. 작업 ID가 저장된 불명확 작업은 운영 화면에서 `저장된 작업 다시 조회`를 사용할 수 있습니다.
- 최종 오류·시간 초과·결과 수신 실패는 운영 확인 대상으로 남깁니다. 공급자 기록을 확인한 후 비용을 정산하고 새 생성을 선택합니다.
- 이미지·영상 후보는 생성 당시 모델, 규격, 입력 버전·해시, 원본 작업 ID, 시각, 추정 비용, 만료일을 보존합니다. 파일 보관은 기존 30일입니다.

## 검증과 남은 인수

개발 검증 결과:

- 자동 테스트 44개 통과: 모델·옵션 검증, 길이별 비용, 같은 금액의 설정 변경 감지, 중복 접수, 후보 보존·선택, 소유권, 공식 요청 형식, 기존 인증·상품 시트·음성·타임라인 회귀.
- 타입 검사 통과. 프로덕션 빌드 통과.
- 브라우저 모의 검증 통과: 기본 모델, 씬별 예외, 비용 확인, 기존 승인 보존, 직접 후보 선택. 기존 상품 시트 승인·ElevenLabs 선택·음성 검토도 통과.
- 별도 모의 worker 검증 통과: POST 통신 단절 시 예약 유지, 명확한 거절은 0원 처리, 일시적인 조회 오류는 GET만 재시도, 성공한 비교 결과도 기존 승인 영상 보존.
- 기존 제작 파이프라인 모의 검증 통과: 대본→이미지→음성→영상→30초 합성, 각 단계 승인 포함. 15·30·47·90·180초는 타임라인 계산 검증이며 모든 길이의 실제 유료 출력 검증을 뜻하지 않음.
- 오프라인 공유 HTML 검증 통과: 상품 시트·목소리·씬 편집·예시 생성·현재 상태 내보내기/다시 열기, 외부 통신 0건.

모의 공급자 결과를 실제 모델의 품질·가격·계정 권한 증거로 사용하지 않습니다.

실제 연결 인수는 운영 계정·요율·파일 호스트 설정 후 별도 진행해야 합니다. 같은 상품과 승인 이미지를 사용해 모델당 후보 1개, 정확한 수량·총 예산을 먼저 정하고, 접수→조회→다운로드→선택→승인→합성 및 공급자 청구 내역을 확인합니다. 이 단계 전에는 5개 계열 전체 연결 완료 또는 품질 개선 완료로 간주하지 않습니다.

현재 Railway/GitHub Pages에는 이번 변경을 배포하지 않았습니다. 로컬 공유 HTML은 새로 생성했으며 실제 API를 호출하지 않는 시연용입니다.

P1의 씬 아래 샷 구성·스타일 자동 편집·개인 API 키, P2의 PDF·SNS 분석·대량 변형 생성은 이번 구현에 포함하지 않았습니다.

## 공식 참고 문서

- [Higgsfield 요청 수명 주기](https://docs.higgsfield.ai/docs/concepts/requests)
- [Higgsfield 파일 업로드](https://docs.higgsfield.ai/docs/concepts/file-uploads)
- [Seedance I2V API](https://open.higgsfield.ai/models/bytedance/seedance-2.5/image-to-video/api-reference)
- [Kling I2V API](https://open.higgsfield.ai/models/kling-video/v3.0/std/image-to-video/api-reference)
- [MiniMax I2V API](https://open.higgsfield.ai/models/minimax/hailuo-2.3/standard/image-to-video/api-reference)
- [OpenAI Images edits API](https://developers.openai.com/api/reference/resources/images/methods/edit)
