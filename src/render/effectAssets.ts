import type Phaser from 'phaser';
import { PIXELFX } from './pixelfxManifest';
import { gameSkin } from '../game/skin';

/** Load only the active skin's shared atlas (also usable in a static subdirectory build). */
export function loadEffectAssets(scene: Phaser.Scene): void {
  if (new URLSearchParams(window.location.search).get('vfx') === 'off') return;
  const base = `${import.meta.env.BASE_URL}assets/effects/`;
  for (const page of PIXELFX.pages) {
    if (page.skin === gameSkin.current && !scene.textures.exists(page.texture)) {
      scene.load.atlas(page.texture, `${base}${page.image}`, `${base}${page.atlas}`);
    }
  }
}
