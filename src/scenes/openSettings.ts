import type Phaser from 'phaser';

/** 설정 오버레이를 열고 부모 씬을 멈춘다. 부모는 멈춰 있는 동안 키 입력을 무시해야 한다 */
export function openSettings(parent: Phaser.Scene): void {
  parent.scene.pause();
  parent.scene.launch('Settings', { parent: parent.scene.key });
}

/** 설정 오버레이가 열려 있어(부모가 멈춰) 키 입력을 무시해야 하는지 */
export function isBlockedByOverlay(scene: Phaser.Scene): boolean {
  return scene.scene.isPaused();
}
