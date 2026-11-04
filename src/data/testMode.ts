// 빌드 테스트 전용 페이지(test.html) 설정

export const TEST_MODE = {
  /** 테스트 전용 저장 키 (실제 키 kkoma-mudang-save와 분리) */
  saveKey: 'kkoma-mudang-save-test',
  /** 별·구매와 별개로 신명 총량에 더하는 값. 업그레이드 전체 비용(배타 그룹은 하나만 세어 248)보다 크다 */
  bonusSinmyeong: 300,
  /** 처음(또는 초기화 후) 엽전 */
  startYeopjeon: 100000,
  label: '테스트 모드',
  pageTitle: '꼬마 무당 대소동 (테스트)',
  resetButton: '테스트 데이터\n초기화',
  resetConfirm: '테스트 데이터를 모두 지우고 처음 재화로 되돌릴까요?\n(실제 게임 기록은 그대로입니다)',
} as const;
