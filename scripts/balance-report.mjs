import { createServer } from 'vite';

// Reproducible army-only encounters. The hero stays at the shrine; no skills,
// upgrades, income, or reinforcements affect the equal-budget comparisons.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { Battle } = await server.ssrLoadModule('/src/battle/battle.ts');
  const { SeededRng } = await server.ssrLoadModule('/src/battle/rng.ts');
  const { getAllyDef } = await server.ssrLoadModule('/src/data/allies.ts');
  const { WaveDirector } = await server.ssrLoadModule('/src/battle/wave.ts');
  const originalUpdate = WaveDirector.prototype.update;
  WaveDirector.prototype.update = () => [];
  const encounters = [
    { name: 'Swarm', stage: 0, enemy: 'eggGhost', count: 16, x: 1190, spread: 5, seconds: 12,
      armies: { cheap: [['clubGoblin', 6]], combined: [['clubGoblin', 2], ['gumiho', 1]] } },
    { name: 'Armor', stage: 5, enemy: 'jangseungSpirit', count: 3, x: 1120, spread: 8, seconds: 25,
      armies: { cheap: [['clubGoblin', 11]], specialist: [['bulgasari', 3]] } },
  ];
  const rows = [];
  for (const encounter of encounters) {
    for (const [name, roster] of Object.entries(encounter.armies)) {
      const battle = new Battle({ stage: encounter.stage, rng: new SeededRng(1) });
      battle.hero.x = 80;
      let cost = 0;
      for (const [id, count] of roster) {
        battle.spawnFreeAllies(id, count);
        cost += getAllyDef(id).cost * count;
      }
      battle.allies.forEach((a, i) => { a.x = 1000 - i * 4; });
      for (let i = 0; i < encounter.count; i++) {
        battle.spawnEnemy(encounter.enemy, false, encounter.x + i * encounter.spread);
      }
      battle.step(encounter.seconds);
      rows.push({ encounter: encounter.name, army: name, cost, seconds: encounter.seconds,
        kills: encounter.count - battle.enemies.length, survivors: battle.allies.length,
        enemyHp: Math.round(battle.enemies.reduce((n, e) => n + e.hp, 0)) });
    }
  }
  WaveDirector.prototype.update = originalUpdate;
  console.table(rows);
} finally {
  await server.close();
}
