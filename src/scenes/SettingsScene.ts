import Phaser from 'phaser';
import { settings } from '../game/session';
import { FULLSCREEN_LAYOUT, GAME_HEIGHT, GAME_WIDTH, HUD_FONT, SETTINGS_PANEL } from './layout';
import { FullscreenButton } from './FullscreenButton';
import { KEY_MAP, KeyInput } from './input';
import { MenuButton } from './MenuButton';
import { Slider } from './Slider';
import { DEFAULT_UI as U } from '../ui/default/tokens';
import { panel } from '../ui/default/decor';

const DEPTH = 1000;
const PANEL = SETTINGS_PANEL;
const CONTROLS: readonly (readonly [string, string])[] = [
  ['영웅 이동', 'A / D 또는 ← / →'],
  ['유닛 소환', '1 ~ 0'],
  ['영웅 스킬', 'Q / W / E'],
  ['기운 모으기', 'R'],
  ['유닛 · 스킬 설명', 'I → 카드 또는 단축키'],
  ['일시정지 / 계속', 'Esc 또는 P'],
  ['결과: 다시 / 다음 / 지도', 'R / N / M'],
];

export class SettingsScene extends Phaser.Scene {
  private parentKey = '';
  private keyInput!: KeyInput;

  constructor() { super('Settings'); }
  init(data: { parent?: string }): void { this.parentKey = data.parent ?? ''; }

  create(): void {
    const cx = GAME_WIDTH / 2, left = cx - PANEL.w / 2, top = (GAME_HEIGHT - PANEL.h) / 2;
    const font = { fontFamily: HUD_FONT, color: U.darkText };
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050c18, 0.8).setDepth(DEPTH).setInteractive();
    panel(this, left, top, PANEL.w, PANEL.h, false, DEPTH + 1);
    this.add.text(cx, top + 18, '잠깐, 축제 준비', { ...font, fontSize: '28px', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setDepth(DEPTH + 2);

    const audioObjects: Phaser.GameObjects.Text[] = [];
    const sliders: Slider[] = [];
    const audioRows: [string, number, (v: number) => void][] = [
      ['배경음', settings.musicVolume, v => settings.setMusicVolume(v)],
      ['효과음', settings.sfxVolume, v => settings.setSfxVolume(v)],
    ];
    audioRows.forEach(([name, value, update], i) => {
      const y = top + 212 + i * 82;
      audioObjects.push(this.add.text(left + 42, y, name, { ...font, fontSize: '20px', fontStyle: 'bold' })
        .setOrigin(0, 0.5).setDepth(DEPTH + 2));
      sliders.push(new Slider(this, left + 170, y, 370, value, update, DEPTH + 2));
    });
    audioObjects.push(this.add.text(cx, top + 354, '원하는 소리 크기를 누르거나 끌어서 조절하세요.', {
      ...font, fontSize: '14px', color: '#77623b',
    }).setOrigin(0.5).setDepth(DEPTH + 2));

    const controls = [
      this.add.text(left + 42, top + 174, CONTROLS.map(([n]) => n).join('\n'), {
        ...font, fontSize: '16px', lineSpacing: 9,
      }).setDepth(DEPTH + 2),
      this.add.text(left + 338, top + 174, CONTROLS.map(([, k]) => k).join('\n'), {
        ...font, fontSize: '16px', fontStyle: 'bold', lineSpacing: 9,
      }).setDepth(DEPTH + 2),
      this.add.text(cx, top + 382, '터치: 화면 버튼으로 조작 · 설명 모드에서는 카드 행동이 실행되지 않습니다.', {
        ...font, fontSize: '13px', color: '#77623b',
      }).setOrigin(0.5).setDepth(DEPTH + 2),
    ];
    const showTab = (audio: boolean) => {
      for (const object of audioObjects) object.setVisible(audio);
      for (const slider of sliders) slider.setVisible(audio);
      for (const object of controls) object.setVisible(!audio);
      soundTab.setFill(audio ? U.gold : U.paper);
      controlsTab.setFill(audio ? U.paper : U.gold);
    };
    const soundTab = new MenuButton(this, cx - 148, top + 106, 280, 66, '소리', () => showTab(true), { fontSize: 18 }).setDepth(DEPTH + 2);
    const controlsTab = new MenuButton(this, cx + 148, top + 106, 280, 66, '조작 안내', () => showTab(false), { fontSize: 18 }).setDepth(DEPTH + 2);
    new MenuButton(this, cx, top + PANEL.h - 46, 250, 66, '축제로 돌아가기 (Esc)', () => this.close(), {
      tone: 'primary', fontSize: 18,
    }).setDepth(DEPTH + 2);
    new FullscreenButton(this, FULLSCREEN_LAYOUT.settings, 'icon', DEPTH + 10);
    showTab(true);
    this.keyInput = new KeyInput(window, code => { if (code === KEY_MAP.back) this.close(); });
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  private close(): void {
    if (this.parentKey) this.game.scene.resume(this.parentKey);
    this.game.scene.stop('Settings');
  }
}
