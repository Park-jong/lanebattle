import type Phaser from 'phaser';
import { addArtImage } from '../../render/CharacterRenderer';
import type { BuildSkin } from './theme';

export const BUILD_PORTRAIT_TEXTURE = 'build-military-portraits-v1';

/** Load independently of combat manifests, including when entering with the original UI skin. */
export function loadBuildPortraits(scene: Phaser.Scene): void {
  if (scene.textures.exists(BUILD_PORTRAIT_TEXTURE)) return;
  const base = `${import.meta.env.BASE_URL}assets/ui/build/military-portraits`;
  scene.load.atlas(BUILD_PORTRAIT_TEXTURE, `${base}.png`, `${base}.json`);
}

/** A missing texture/frame deliberately returns undefined so the caller can draw its emblem. */
export function addBuildPortrait(scene: Phaser.Scene, skin: BuildSkin, unitId: string, x: number, y: number, size: number): Phaser.GameObjects.Image | undefined {
  if (skin === 'default') return addArtImage(scene, `ally:${unitId}`, 'icon', x, y, size, size);
  if (!scene.textures.exists(BUILD_PORTRAIT_TEXTURE) || !scene.textures.get(BUILD_PORTRAIT_TEXTURE).has(unitId)) return undefined;
  return scene.add.image(x, y, BUILD_PORTRAIT_TEXTURE, unitId).setDisplaySize(size, size);
}
