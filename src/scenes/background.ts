import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';
import { NIGHT } from './palette';

/** 밤하늘 배경: 어두운 바탕과 고정된 별 점들 (난수 대신 고정 식으로 위치를 만든다) */
export function drawNightSky(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(NIGHT, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  for (let i = 0; i < 70; i++) {
    const x = (i * 137) % GAME_WIDTH;
    const y = (i * 71 + (i % 7) * 23) % (GAME_HEIGHT - 120);
    g.fillStyle(0xf5f0e0, 0.25 + (i % 4) * 0.12).fillCircle(x, y, i % 5 === 0 ? 1.8 : 1.1);
  }
}
