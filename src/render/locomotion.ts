import { clipSeconds, type CharacterArt } from './art';

/** Presentation clock; never delays movement or attacks in the simulation. */
export class Locomotion {
  private moving = false;
  private facing: number;
  private transition = '';
  private age = 0;
  private walkCycles = 0;
  constructor(facing: number) { this.facing = facing; }
  update(art: CharacterArt, dt: number, moving: boolean, facing: number,
    travel?: { distance: number; displayScale: number }): { clip: string; age: number } {
    this.age += dt;
    const edge = facing !== this.facing ? 'turn' : moving !== this.moving ? moving ? 'start' : 'stop' : '';
    if (edge) { this.transition = edge; this.age = 0; this.walkCycles = 0; }
    this.moving = moving; this.facing = facing;
    const clip = this.transition && this.age < clipSeconds(art, this.transition)
      ? this.transition : moving ? 'walk' : 'idle';
    const stride = art.clips.walk?.strideLength;
    if (clip === 'walk' && stride && stride > 0 && travel && travel.displayScale > 0) {
      // A stationary/blocked body cannot walk in place. Scaling changes stride
      // distance rather than character speed; status slow follows actual travel.
      if (dt > 0) this.walkCycles = (this.walkCycles + Math.max(0, travel.distance) / (stride * travel.displayScale)) % 1;
      return { clip, age: this.walkCycles * clipSeconds(art, 'walk') };
    }
    return { clip, age: this.age };
  }
}
