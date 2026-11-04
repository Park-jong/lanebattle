/** 게임 모드: normal은 index.html, test는 test.html (빌드 테스트 전용) */
export type GameMode = 'normal' | 'test';

/** 페이지의 <html data-mode="test"> 로 모드를 정한다. 없으면 일반 */
export function detectGameMode(): GameMode {
  if (typeof document === 'undefined') return 'normal';
  return document.documentElement.dataset.mode === 'test' ? 'test' : 'normal';
}
