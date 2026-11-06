import type Phaser from 'phaser';
import { COMBAT } from '../data/combat';
import { STAGES } from '../data/stages';
import { gameSkin } from '../game/skin';
import { GAME_WIDTH, BATTLE_LAYOUT } from '../scenes/layout';

export function loadMilitaryScenery(scene: Phaser.Scene): void {
  const base = `${import.meta.env.BASE_URL}assets/military/`;
  scene.load.image('military-shion-title', `${base}shion-title.png`);
  for (let chapter = 1; chapter <= 5; chapter++) {
    scene.load.image(`military-chapter-${chapter}`, `${base}chapter-${chapter}.jpg`);
    for (const team of ['ally', 'enemy']) for (let phase = 0; phase <= 3; phase++) {
      const key = `base-${chapter}-${team}-${phase}`;
      scene.load.image(`military-${key}`, `${base}${key}.png`);
    }
  }
}

export function drawMilitaryBattlefield(scene: Phaser.Scene, stage: number): boolean {
  const key = `military-chapter-${STAGES[stage].chapter}`;
  if (gameSkin.current !== 'military' || !scene.textures.exists(key)) return false;
  // The authored horizon meets the back of the playable lane; the HUD covers the foreground.
  scene.add.tileSprite(0, 0, COMBAT.battlefieldLength, BATTLE_LAYOUT.panel.y, key)
    .setOrigin(0).setTileScale(GAME_WIDTH / 1280, BATTLE_LAYOUT.panel.y / 720).setDepth(0);
  return true;
}
