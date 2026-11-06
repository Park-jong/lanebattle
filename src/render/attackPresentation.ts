import type { Body } from '../battle/entities';
import { Hero } from '../battle/hero';
import { HERO } from '../data/hero';
import type { ArtClip, CharacterArt } from './art';

function contactIndex(clip: ArtClip | undefined): number | undefined {
  const index = clip?.contactFrame;
  return index !== undefined && Number.isInteger(index) && index >= 0 && index < clip!.frames.length
    ? index : undefined;
}

function anticipationWindow(art: CharacterArt, interval: number): number {
  return Math.max(0, Math.min(art.clips.attack?.anticipationSeconds ?? 0, interval * .35));
}

/** Reserve room for the next wind-up without changing the actual attack interval. */
export function attackDuration(art: CharacterArt, interval: number): number {
  const clip = art.clips.attack;
  if (contactIndex(clip) === undefined || !clip?.recoverySeconds) return Math.max(.1, Math.min(.35, interval * .75));
  return Math.max(.01, Math.min(clip.recoverySeconds, interval - anticipationWindow(art, interval)));
}

/** On the real attack event show contact immediately, then hold and recover. */
export function attackFrameAge(art: CharacterArt, age: number, duration: number): number {
  const clip = art.clips.attack;
  const count = clip?.frames.length ?? 1;
  const contact = contactIndex(clip);
  if (contact === undefined) return (1 + (count - 1) * age / Math.max(.01, duration)) / (clip?.fps ?? 6);
  const hold = Math.min(duration * .5,
    (clip!.contactHoldSeconds ?? 0) * duration / (clip!.recoverySeconds ?? duration));
  const index = age < hold ? contact
    : contact + 1 + (count - contact - 1) * (age - hold) / Math.max(.001, duration - hold);
  return index / clip!.fps;
}

/** Optional wind-up uses existing cooldown/targets and never writes combat state. */
export function anticipationFrame(art: CharacterArt, body: Body, targets: readonly Body[]): number | undefined {
  const contact = contactIndex(art.clips.attack);
  if (contact === undefined || contact === 0 || !(body instanceof Hero) || body.possessedId ||
      !body.alive || body.visualMoving || body.status?.stunned || body.attackCooldown <= 0) return undefined;
  const interval = HERO.attack.interval / (1 + (body.status?.attackSpeedBonus ?? 0));
  const window = anticipationWindow(art, interval);
  if (window <= 0 || body.attackCooldown > window) return undefined;
  let target: Body | undefined;
  let distance = Infinity;
  for (const candidate of targets) {
    const d = Math.abs(candidate.x - body.x);
    if (candidate.team !== body.team && candidate.alive && !candidate.flying &&
        d - candidate.radius <= HERO.attack.range && d < distance) {
      target = candidate;
      distance = d;
    }
  }
  if (!target || (target.x < body.x ? -1 : 1) !== body.facing) return undefined;
  return Math.min(contact - 1, Math.floor(contact * (1 - body.attackCooldown / window)));
}
