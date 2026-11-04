import Phaser from 'phaser';
import { FLOATER, HUD_FONT } from './layout';
import { CappedList, type FloaterStyle } from './floaterStyle';

interface Floater {
  text: Phaser.GameObjects.Text;
  age: number;
  y0: number;
}

/** 떠오르며 사라지는 데미지 숫자. 동시 표시 수에 상한을 두고, 밀려난 글자 객체는 다시 쓴다 */
export class DamageFloaters {
  private readonly active = new CappedList<Floater>(FLOATER.max);
  private readonly pool: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(x: number, y: number, style: FloaterStyle): void {
    const text = this.pool.pop() ?? this.create();
    text.setText(style.text).setColor(style.color).setScale(style.scale).setPosition(x, y).setAlpha(1).setVisible(true);
    for (const old of this.active.add({ text, age: 0, y0: y })) this.recycle(old);
  }

  /** 나이를 먹이고 위로 띄운다. 수명이 다한 것은 거둔다 */
  update(dt: number): void {
    this.active.forEach((f) => {
      f.age += dt;
      const t = Math.min(1, f.age / FLOATER.seconds);
      f.text.setY(f.y0 - FLOATER.rise * t).setAlpha(1 - t * t);
    });
    for (const f of this.active.keep((f) => f.age < FLOATER.seconds)) this.recycle(f);
  }

  private create(): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, '', {
        fontFamily: HUD_FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(70);
  }

  private recycle(f: Floater): void {
    f.text.setVisible(false);
    this.pool.push(f.text);
  }
}
