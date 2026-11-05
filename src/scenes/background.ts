import Phaser from 'phaser';
import { festivalNight } from '../ui/default/decor';

/** 밤하늘 배경: 어두운 바탕과 고정된 별 점들 (난수 대신 고정 식으로 위치를 만든다) */
export function drawNightSky(scene: Phaser.Scene): void {
  festivalNight(scene);
}
