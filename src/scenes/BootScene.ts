import Phaser from 'phaser';
import { ART_MANIFEST_KEY, artAssetUrl, artList } from '../render/art';
import { GAME_HEIGHT, GAME_WIDTH, HUD_FONT } from './layout';
import { DEFAULT_UI as U } from '../ui/default/tokens';
import { festivalNight, panel } from '../ui/default/decor';

/** 기본 캐릭터 아틀라스를 읽는다. 로딩 실패 시 전투의 도형 표시로 대체한다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    festivalNight(this);
    panel(this, 220, 192, 520, 156, true);
    this.add.text(GAME_WIDTH / 2, 218, '한밤의 축제가 곧 시작됩니다', {
      fontFamily: HUD_FONT, fontSize: '14px', color: U.goldText,
    }).setOrigin(0.5);
    const label = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '요괴 친구들을 부르는 중…', {
      fontFamily: HUD_FONT, fontSize: '22px', color: U.text,
    }).setOrigin(0.5);
    const meter = this.add.graphics();
    const drawMeter = (value: number) => {
      meter.clear().fillStyle(U.night).fillRoundedRect(258, 310, 444, 5, 2);
      if (value > 0) meter.fillStyle(U.gold).fillRoundedRect(258, 310, 444 * value, 5, 2);
    };
    drawMeter(0);
    this.load.json(ART_MANIFEST_KEY, artAssetUrl('manifest.json', import.meta.env.BASE_URL));
    this.load.once('complete', () => {
      const entries = artList(this.cache.json.get(ART_MANIFEST_KEY));
      for (const art of entries) this.load.atlas(art.texture,
        artAssetUrl(art.image, import.meta.env.BASE_URL), artAssetUrl(art.atlas, import.meta.env.BASE_URL));
      if (entries.length) {
        this.load.on('progress', (value: number) => {
          label.setText(`요괴 친구들을 부르는 중… ${Math.round(value * 100)}%`);
          drawMeter(value);
        });
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
