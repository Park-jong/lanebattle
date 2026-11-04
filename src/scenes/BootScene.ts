import Phaser from 'phaser';

/** 에셋이 없으므로 바로 넘어간다. URL에 ?stage가 있으면 개발 확인용으로 전투부터, 없으면 타이틀 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const devBattle = new URLSearchParams(window.location.search).has('stage');
    this.scene.start(devBattle ? 'Battle' : 'Title');
  }
}
