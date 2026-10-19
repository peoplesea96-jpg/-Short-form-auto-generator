# GPT Image 2.5 전환 · 2026-10-19

## 변경

- 기존 `gpt-image` 선택 ID는 유지하고, 새 생성 요청의 모델을 `gpt-image-1.5`에서 `gpt-image-2.5-sunburst`로 변경한다. 상품 참고 이미지를 활용하는 작업이므로 편집 정밀도를 우선하는 Sunburst를 선택했다.
- 화면과 공유 데모에도 `GPT Image 2.5 Sunburst`를 표시한다. Gemini 기본 선택은 유지한다.
- 참고 이미지가 없으면 Images generations, 있으면 multipart Images edits를 호출한다. 2.5에는 구형 모델 전용 `input_fidelity`를 보내지 않는다. high 품질, PNG, 1024×1536 생성 후 전체 이미지를 보존하는 1080×1920 여백 맞춤을 유지한다.
- 기존 생성 결과·승인·후보의 1.5 이력은 변경하지 않는다. 이미 접수된 작업도 저장된 모델 스냅샷을 따른다. 새 견적에는 2.5를 기록하므로, 이전 1.5 견적으로 실행하려면 비용을 다시 확인해야 한다. 2.5 실패 시 1.5로 자동 재시도하지 않는다.

## Railway 설정과 비용

- 기존 `OPENAI_API_KEY`를 서버에서 재사용한다. 별도 이미지 API 키나 Higgsfield 키가 필요하지 않다. 계정의 모델 접근 권한·조직 인증·API 결제 가능 여부는 별도 확인 대상이다.
- `GPT_IMAGE_RESERVE_USD_PER_IMAGE`는 운영자가 정한 장당 내부 예상액이다. 공급자의 고정 요금, 결제 상한, 확정 청구액이 아니다. `RATES_REVIEWED_AT`, `USD_TO_KRW`와 함께 기존 예상 비용 확인 절차에서 사용한다.
- 앞서 안내한 $0.20은 1.5의 특정 출력 규격 기준이므로 2.5 공식 장당 단가로 사용하면 안 된다. 2.5는 실제 텍스트 입력·이미지 입력·이미지 출력 토큰으로 과금된다. 현재 Frame은 이 토큰을 이용한 확정 청구 정산을 구현하지 않았으며 장당 설정 예상액을 집계한다.
- 공식 Standard 요율은 100만 토큰당 텍스트 입력 $5, 이미지 입력 $8, 이미지 출력 $30이다. 예상액은 실제 사용 내역을 확인해 조정한다. 실제 생성 테스트나 계정 비용이 발생하는 요청은 이번 검증에서 실행하지 않는다.
- 다른 모델·메일·호스트 설정과 API 키 값은 변경하지 않는다.

## 검증

실제 외부 API를 호출하지 않는 테스트로 새 요청 모델 ID, 참고 이미지 edits 전송, 구형 파라미터 누락, PNG 출력 크기, 기존 1.5 작업 스냅샷 호환, 이전 견적 거부, 기존 후보·승인 보존을 확인한다. 브라우저 테스트는 프로젝트·씬 모델 선택과 1.5/2.5 후보 비교를 확인한다.

## 공식 근거

- https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- https://developers.openai.com/api/reference/resources/images/methods/edit
- https://developers.openai.com/api/docs/guides/image-generation
