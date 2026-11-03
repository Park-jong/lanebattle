import Phaser from 'phaser';

/** 에셋이 없으므로 바로 전투 씬으로 넘어간다 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Battle');
  }
}
