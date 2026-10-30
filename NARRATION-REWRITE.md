# 전체 내레이션 재생성 — 2026-10-30

스토리보드 상단에 전체 내레이션 다시 생성 버튼 추가. 기존 quote/generate/job/worker 흐름의 narration 작업으로 공통 카피 지침을 사용하여 대사·근거·검수정보 후보만 생성. 씬 ID/개수 검증, 시간/화면/샷 고정. 생성 전 예상 비용 확인 및 월간 한도 적용. 유료 자동 재시도 없음.

완료 결과는 narrationDraft 비교 패널에 저장되고 기존 씬을 즉시 바꾸지 않음. 전체 적용 시 revision+입력hash+소유권+활성작업 검증. 대사/evidence/copy/speechMode만 변경, image와 imageApproved 및 video파일 유지. script/copy/audio/video 승인은 초기화하고 음성은 재생성 대상으로 해제. 샷 영상 승인도 해제. 기존 씬 전체 상태를 narrationHistory에 최근10회 보관(별도 복원 UI 없음). 후보 닫기로 원본 유지 가능.

검증: 129개 테스트, 타입검사/프로덕션 빌드 통과. 실제 로컬 API/UI test-results/narration-rewrite-e2e-1793361196955/result.json. 비용 확인 전 큐0, narration접수, 후보 비교 전 원본보존, 적용 후 이미지/시간 보존 확인. 브라우저의 완료 후보는 fixture이며 실제 모델 호출/워커 실행/유료 생성0. provider요청은 모의 응답으로 공통지침/구조 확인. 실제 생성 품질 실험은 미실행.
