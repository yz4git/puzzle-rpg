import { ENEMIES } from "../app/rpg/data/enemies";
import { expForNextLevel, maxHpForLevel } from "../app/rpg/save";
import type { EnemyDefinition, PanelType } from "../app/rpg/types";

type Archetype = "STANDARD" | "ATK" | "HEAL" | "BAR" | "SKIP";
type RunMetric = { turns: number; fights: number; minHp: number; items: number; gameOvers: number; bossFirstWins: number; bosses: number; altAttempts: number; altWins: number; level: number; failures: Record<string, number> };

const ARCHETYPES: Archetype[] = ["STANDARD", "ATK", "HEAL", "BAR", "SKIP"];
const ROUTE = [
  "mossSlime", "roadFang", "thornBat", "forestWisp", "copperBeetle", "templeKeeper",
  "lakeImp", "copperBeetle", "marshLeech", "ashCrow", "scarletOracle",
  "ironSentry", "hollowMonk", "ashCrow", "ironTyrant", "mirrorMote", "lostKnight",
  "clockMoth", "gateMimic", "prismHound", "voidHerald", "prismHound", "citadelEye", "hollowMonk", "nullExecutioner", "prismSovereign",
] as const;
const WEIGHTS: Record<Archetype, Record<PanelType, number>> = {
  STANDARD: { attack: .38, heal: .20, barrier: .22, skip: .20 },
  ATK: { attack: .57, heal: .13, barrier: .15, skip: .15 },
  HEAL: { attack: .30, heal: .38, barrier: .17, skip: .15 },
  BAR: { attack: .30, heal: .14, barrier: .41, skip: .15 },
  SKIP: { attack: .32, heal: .14, barrier: .16, skip: .38 },
};

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function weightedType(weights: Record<PanelType, number>, roll: number): PanelType {
  let cursor = 0;
  for (const type of ["attack", "heal", "barrier", "skip"] as PanelType[]) {
    cursor += weights[type];
    if (roll <= cursor) return type;
  }
  return "attack";
}

function altProbability(archetype: Archetype, enemy: EnemyDefinition) {
  const hint = enemy.alt?.hint ?? "";
  if (/HEAL/.test(hint)) return archetype === "HEAL" ? .86 : archetype === "ATK" ? .28 : .55;
  if (/BAR|完全防御|重撃/.test(hint)) return archetype === "BAR" ? .84 : archetype === "ATK" ? .30 : .53;
  if (/SKIP/.test(hint)) return archetype === "SKIP" ? .86 : .46;
  if (/攻撃せず/.test(hint)) return archetype === "ATK" ? .22 : .72;
  if (/ATK/.test(hint)) return archetype === "ATK" ? .84 : .56;
  if (/ITEM/.test(hint)) return .70;
  if (/四つ/.test(hint)) return .76;
  return .50;
}

function levelAfter(level: number, exp: number, gain: number) {
  let nextLevel = level;
  let nextExp = exp + gain;
  while (nextLevel < 30 && nextExp >= expForNextLevel(nextLevel)) {
    nextExp -= expForNextLevel(nextLevel);
    nextLevel += 1;
  }
  return { level: nextLevel, exp: nextExp };
}

function simulate(archetype: Archetype, seed: number): RunMetric {
  const rng = random(seed);
  let level = 1;
  let exp = 0;
  let maxHp = maxHpForLevel(level);
  let hp = maxHp;
  let herbs = 7;
  const metric: RunMetric = { turns: 0, fights: 0, minHp: hp, items: 0, gameOvers: 0, bossFirstWins: 0, bosses: 0, altAttempts: 0, altWins: 0, level, failures: {} };

  for (let routeIndex = 0; routeIndex < ROUTE.length; routeIndex += 1) {
    const enemy = ENEMIES[ROUTE[routeIndex]]!;
    if (enemy.boss || [6, 11, 15, 18, 22].includes(routeIndex)) { hp = maxHp; herbs = Math.max(herbs, 4); }
    metric.fights += 1;
    if (enemy.boss) metric.bosses += 1;
    const altAttempt = Boolean(enemy.alt && rng() < altProbability(archetype, enemy));
    if (altAttempt) metric.altAttempts += 1;
    let released = false;
    let firstAttempt = true;
    let won = false;

    for (let attempt = 0; attempt < 3 && !won; attempt += 1) {
      let enemyHp = enemy.hp;
      let barrier = archetype === "BAR" && routeIndex > 8 ? 2 : 0;
      let free = 0;
      let intentStep = 0;
      let disrupted = 0;
      let battleTurns = 0;
      if (attempt > 0) hp = maxHp;

      while (hp > 0 && enemyHp > 0 && battleTurns < 44) {
        battleTurns += 1;
        metric.turns += 1;
        if (hp <= maxHp * .23 && herbs > 0) {
          hp = Math.min(maxHp, hp + 6); herbs -= 1; metric.items += 1;
        } else {
          const adaptive = { ...WEIGHTS[archetype] };
          if (hp <= maxHp * .58) { adaptive.heal += .32; adaptive.barrier += .24; adaptive.attack = Math.max(.06, adaptive.attack - .34); adaptive.skip = Math.max(.06, adaptive.skip - .22); }
          const total = adaptive.attack + adaptive.heal + adaptive.barrier + adaptive.skip;
          for (const key of Object.keys(adaptive) as PanelType[]) adaptive[key] /= total;
          const type = weightedType(adaptive, rng());
          const focus = type === "attack" && archetype === "ATK" || type === "heal" && archetype === "HEAL" || type === "barrier" && archetype === "BAR" || type === "skip" && archetype === "SKIP";
          let cluster = 3 + Math.floor(rng() * 5) + (focus && rng() < .58 ? 1 : 0) + (rng() < .12 ? 1 : 0) - disrupted;
          disrupted = 0;
          cluster = Math.max(1, Math.min(9, cluster));
          if (type === "attack") {
            let damage = cluster + (routeIndex >= 4 ? 1 : 0) + (archetype === "ATK" && routeIndex >= 8 ? 1 : 0);
            if (routeIndex >= 3 && cluster >= 6) damage += 2;
            if (routeIndex >= 6 && enemyHp <= enemy.hp / 2) damage += 2;
            if (routeIndex >= 11 && hp <= 8) damage += 2;
            if ((enemy.id === "ironSentry" || enemy.id === "ironTyrant") && cluster < 5) damage = Math.max(1, damage - 2);
            enemyHp = Math.max(0, enemyHp - damage);
          } else if (type === "heal") {
            const power = cluster + (cluster >= 6 && routeIndex >= 3 ? 2 : 0) + (archetype === "HEAL" && routeIndex >= 8 ? 2 : 0);
            const gain = Math.min(maxHp - hp, power);
            hp += gain;
            if (routeIndex >= 11) barrier = Math.min(30, barrier + Math.max(0, power - gain));
          } else if (type === "barrier") {
            const power = cluster + (cluster >= 6 && routeIndex >= 3 ? 2 : 0) + (archetype === "BAR" && routeIndex >= 8 ? 2 : 0) + (hp <= 8 && routeIndex >= 11 ? 3 : 0);
            barrier = Math.min(30, barrier + power);
          } else free += Math.max(1, cluster - 1 + (cluster >= 4 && routeIndex >= 3 ? 1 : 0) + (archetype === "SKIP" && routeIndex >= 8 ? 1 : 0));
        }

        if (altAttempt && enemy.alt && battleTurns >= 3 && rng() < .24) { enemyHp = 0; metric.altWins += 1; released = true; break; }
        if (enemyHp <= 0) break;
        if (free > 0) { free -= 1; continue; }

        const intent = enemy.intents[intentStep % enemy.intents.length]!;
        intentStep += 1;
        let power = intent.power;
        const ratio = enemyHp / enemy.hp;
        if (enemy.id === "prismSovereign") power += ratio <= .25 ? 2 : ratio <= .5 ? 1 : 0;
        if (enemy.id === "nullExecutioner" && hp <= 8 && intent.kind === "pierce") power += 2;
        let damage = power;
        if (intent.kind !== "pierce") { const blocked = Math.min(barrier, damage); barrier -= blocked; damage -= blocked; }
        hp = Math.max(0, hp - damage);
        if (intent.kind === "drain" && damage > 0) enemyHp = Math.min(enemy.hp, enemyHp + damage + (enemy.id === "scarletOracle" ? 2 : 0));
        if (intent.kind === "disrupt" || intent.kind === "seal") disrupted = 1;
        metric.minHp = Math.min(metric.minHp, hp);
      }

      won = hp > 0 && enemyHp <= 0;
      if (!won) { metric.gameOvers += 1; metric.failures[enemy.id] = (metric.failures[enemy.id] ?? 0) + 1; firstAttempt = false; }
    }

    if (won && enemy.boss && firstAttempt) metric.bossFirstWins += 1;
    if (won) {
      const rewardExp = released ? Math.max(1, Math.floor(enemy.exp * .35)) : enemy.exp;
      const progress = levelAfter(level, exp, rewardExp);
      level = progress.level; exp = progress.exp;
      const grown = maxHpForLevel(level);
      hp = Math.min(grown, hp + Math.max(0, grown - maxHp));
      maxHp = grown;
    }
    hp = Math.min(maxHp, hp + (archetype === "HEAL" ? 3 : 1));
  }
  metric.level = level;
  return metric;
}

const RUNS = 300;
console.log(`RPG BALANCE • ${RUNS} deterministic route runs per archetype`);
console.log("ARCHETYPE | AVG TURNS/FIGHT | AVG MIN HP | GAME OVER/ROUTE | BOSS FIRST CLEAR | ITEMS | ALT SUCCESS | END LV | TOP FAILURE");
for (const archetype of ARCHETYPES) {
  const runs = Array.from({ length: RUNS }, (_, index) => simulate(archetype, 0x52_50_47 + index * 97 + ARCHETYPES.indexOf(archetype) * 10_003));
  const average = (pick: (run: RunMetric) => number) => runs.reduce((sum, run) => sum + pick(run), 0) / runs.length;
  const turns = average((run) => run.turns / run.fights).toFixed(1);
  const minHp = average((run) => run.minHp).toFixed(1);
  const gameOvers = average((run) => run.gameOvers).toFixed(2);
  const bossClear = (runs.reduce((sum, run) => sum + run.bossFirstWins, 0) / runs.reduce((sum, run) => sum + run.bosses, 0) * 100).toFixed(1);
  const items = average((run) => run.items).toFixed(1);
  const alt = (runs.reduce((sum, run) => sum + run.altWins, 0) / Math.max(1, runs.reduce((sum, run) => sum + run.altAttempts, 0)) * 100).toFixed(1);
  const endLevel = average((run) => run.level).toFixed(1);
  const failures: Record<string, number> = {};
  runs.forEach((run) => Object.entries(run.failures).forEach(([id, count]) => { failures[id] = (failures[id] ?? 0) + count; }));
  const topFailure = Object.entries(failures).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";
  console.log(`${archetype} | ${turns} | ${minHp} | ${gameOvers} | ${bossClear}% | ${items} | ${alt}% | ${endLevel} | ${topFailure}`);
}
