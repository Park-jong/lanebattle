import { clipSeconds, type CharacterArt } from './art';

/** Presentation clock; never delays movement or attacks in the simulation. */
export class Locomotion {
  private moving = false;
  private facing: number;
  private transition = '';
  private age = 0;
  constructor(facing: number) { this.facing = facing; }
  update(art: CharacterArt, dt: number, moving: boolean, facing: number): { clip: string; age: number } {
    this.age += dt;
    const edge = facing !== this.facing ? 'turn' : moving !== this.moving ? moving ? 'start' : 'stop' : '';
    if (edge) { this.transition = edge; this.age = 0; }
    this.moving = moving; this.facing = facing;
    const clip = this.transition && this.age < clipSeconds(art, this.transition)
      ? this.transition : moving ? 'walk' : 'idle';
    return { clip, age: this.age };
  }
}
