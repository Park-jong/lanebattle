import Phaser from 'phaser';
import { TEST_MODE } from '../data/testMode';
import { isTestMode } from '../game/session';
import { BATTLE_LAYOUT, GAME_HEIGHT, GAME_WIDTH, HUD_FONT } from './layout';

/** 테스트 모드일 때만 화면 구석에 "테스트 모드" 표시를 띄운다 (기본 오른쪽 아래, 왼쪽 아래 선택) */
export function addTestBadge(scene: Phaser.Scene, corner: 'right' | 'left' = 'right'): void {
  if (!isTestMode) return;
  const left = corner === 'left';
  const battle = scene.sys.settings.key === 'Battle';
  scene.add
    .text(battle ? 12 : left ? 8 : GAME_WIDTH - 8, battle ? BATTLE_LAYOUT.topStrip.h : GAME_HEIGHT - 4, TEST_MODE.label, {
      fontFamily: HUD_FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#b3302a', padding: { x: 6, y: 2 },
    })
    .setOrigin(battle || left ? 0 : 1, battle ? 0 : 1)
    .setScrollFactor(0)
    .setDepth(1000);
}
