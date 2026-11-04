import Phaser from 'phaser';
import { ART_MANIFEST_KEY, artAssetUrl, artList } from '../render/art';
import { GAME_HEIGHT, GAME_WIDTH, HUD_FONT } from './layout';

/** 기본 캐릭터 아틀라스를 읽는다. 로딩 실패 시 전투의 도형 표시로 대체한다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const label = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '요괴 친구들을 부르는 중…', {
      fontFamily: HUD_FONT, fontSize: '22px', color: '#f1e4cb',
    }).setOrigin(0.5);
    this.load.json(ART_MANIFEST_KEY, artAssetUrl('manifest.json', import.meta.env.BASE_URL));
    this.load.once('complete', () => {
      const entries = artList(this.cache.json.get(ART_MANIFEST_KEY));
      for (const art of entries) this.load.atlas(art.texture,
        artAssetUrl(art.image, import.meta.env.BASE_URL), artAssetUrl(art.atlas, import.meta.env.BASE_URL));
      if (entries.length) {
        this.load.on('progress', (value: number) => label.setText(`요괴 친구들을 부르는 중… ${Math.round(value * 100)}%`));
        this.load.once('complete', () => this.startGame());
        this.load.start();
      } else this.startGame();
    });
    this.load.start();
  }

  private startGame(): void {
    const devBattle = new URLSearchParams(window.location.search).has('stage');
    this.scene.start(devBattle ? 'Battle' : 'Title');
  }
}
