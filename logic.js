// Spidey Swing game rules. No DOM and no THREE, so Node can test it.
// You swing from tower to tower. Landing on a tower pays its zone's coins, once per run.
// The course is a straight line from the Base toward -Z. 1 world unit = 1 foot.
// The gap between towers grows every zone, so you need a longer jump (from the shop)
// to reach the next zone. The last zone never ends.
(function () {
  'use strict';

  // Gap = horizontal edge-to-edge distance between neighbouring tower tops.
  const ZONES = [
    { number: 1, name: 'EASY', gap: 5, coins: 1 },
    { number: 2, name: 'MEDIUM', gap: 10, coins: 2 },
    { number: 3, name: 'AVERAGE', gap: 15, coins: 4 },
    { number: 4, name: 'HARD', gap: 20, coins: 8 },
    { number: 5, name: 'IMPOSSIBLE', gap: 25, coins: 16 },
    { number: 6, name: 'INFINITE', gap: 30, coins: 32 },
  ];
  const TOWERS_PER_ZONE = 20; // zones 1-5; zone 6 goes on forever
  const TOWER_SIZE = 8; // square tower tops, 8 x 8 ft
  const BASE_SIZE = 24; // the start rooftop, 24 x 24 ft
  const STREET_Y = -80; // the street far below
  const MAX_JUMP_LEVEL = 5; // 5 + 5*5 = 30 ft reaches every zone
  const SPEED_PACKS = [
    { levels: 1, price: 10 },
    { levels: 5, price: 50 },
    { levels: 10, price: 100 },
  ];
  const REACH_EPS = 0.01; // a jump of exactly the gap is enough
  const TARGET_COS = Math.cos((35 * Math.PI) / 180); // stick aim: within 35 degrees
  const SAVE_PREFIX = 'spidey-swing.save.';
  const LAST_NAME_KEY = 'spidey-swing.lastName';

  const BASE = { kind: 'base', index: -1, zone: null, x: 0, y: 0, z: 0, size: BASE_SIZE };

  function zoneOfTower(i) {
    return ZONES[Math.min(Math.floor(i / TOWERS_PER_ZONE), ZONES.length - 1)];
  }

  // Sum of the gaps in front of towers 0..i (the gap in front of a tower is its zone's gap).
  function gapsUpTo(i) {
    const count = i + 1;
    let sum = 0;
    for (let k = 0; k < ZONES.length - 1; k++) {
      sum += Math.min(Math.max(count - k * TOWERS_PER_ZONE, 0), TOWERS_PER_ZONE) * ZONES[k].gap;
    }
    const last = ZONES[ZONES.length - 1];
    return sum + Math.max(count - (ZONES.length - 1) * TOWERS_PER_ZONE, 0) * last.gap;
  }

  // Tower top height: varies a little for looks (-4..+4 ft, steps of 0.5), same every time.
  function towerHeight(i) {
    const wave = Math.sin(i * 2.399 + 1) * 0.6 + Math.sin(i * 0.77) * 0.4;
    return Math.round(wave * 8) / 2;
  }

  // Tower i (0 = the first one after the Base). Works for any i >= 0.
  function tower(i) {
    const nearEdge = BASE_SIZE / 2 + gapsUpTo(i) + i * TOWER_SIZE;
    return {
      kind: 'tower',
      index: i,
      zone: zoneOfTower(i),
      x: 0,
      y: towerHeight(i),
      z: -(nearEdge + TOWER_SIZE / 2),
      size: TOWER_SIZE,
    };
  }

  // Horizontal edge-to-edge distance between two square platform tops.
  function gapBetween(a, b) {
    const dx = Math.max(0, Math.abs(a.x - b.x) - (a.size + b.size) / 2);
    const dz = Math.max(0, Math.abs(a.z - b.z) - (a.size + b.size) / 2);
    return Math.hypot(dx, dz);
  }

  function jumpDistance(level) {
    return 5 + 5 * level;
  }

  // Price of the next jump upgrade when you have `level` upgrades. null = MAX.
  function jumpPrice(level) {
    return level >= MAX_JUMP_LEVEL ? null : 100 * Math.pow(2, level);
  }

  function canReach(from, to, jumpLevel) {
    return gapBetween(from, to) <= jumpDistance(jumpLevel) + REACH_EPS;
  }

  // Speed multiplier for walking and swinging: 1 at level 0, grows slower and slower,
  // never more than 3, so even huge levels stay controllable.
  function speedFactor(level) {
    return 1 + 2 * (1 - Math.exp(-Math.max(0, level) / 25));
  }

  function samePlatform(a, b) {
    return a.kind === b.kind && a.index === b.index;
  }

  // Where does a jump go? Idle stick (dir null): the next tower forward.
  // Held stick: the nearest other platform whose centre is within 35 degrees of dir,
  // seen from the centre of the platform you stand on. null = nothing there.
  function pickTarget(from, candidates, dir) {
    if (!dir) return tower(from.kind === 'base' ? 0 : from.index + 1);
    const len = Math.hypot(dir.x, dir.z);
    if (len === 0) return null;
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (samePlatform(c, from)) continue;
      const dx = c.x - from.x;
      const dz = c.z - from.z;
      const dist = Math.hypot(dx, dz);
      if (dist === 0) continue;
      const cos = (dx * dir.x + dz * dir.z) / (dist * len);
      if (cos >= TARGET_COS - 1e-9 && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    return best;
  }

  function isFreeName(name) {
    return typeof name === 'string' && name.trim().toLowerCase() === 'aariz';
  }

  // 1-16 characters after trimming, else null.
  function cleanName(name) {
    if (typeof name !== 'string') return null;
    const n = name.trim();
    return n.length >= 1 && n.length <= 16 ? n : null;
  }

  function newPlayer(name) {
    return { name, coins: 0, jumpLevel: 0, speedLevel: 0, bestZone: 0 };
  }

  // What the player really pays: Aariz gets everything free.
  function priceFor(player, price) {
    return isFreeName(player.name) ? 0 : price;
  }

  function buyJump(player) {
    const base = jumpPrice(player.jumpLevel);
    if (base === null) return { ok: false, reason: 'max' };
    const cost = priceFor(player, base);
    if (player.coins < cost) return { ok: false, reason: 'coins' };
    player.coins -= cost;
    player.jumpLevel += 1;
    return { ok: true, cost };
  }

  function buySpeed(player, packIndex) {
    const pack = SPEED_PACKS[packIndex];
    if (!pack) return { ok: false, reason: 'pack' };
    const cost = priceFor(player, pack.price);
    if (player.coins < cost) return { ok: false, reason: 'coins' };
    player.coins -= cost;
    player.speedLevel += pack.levels;
    return { ok: true, cost };
  }

  // A run lasts until you fall or go back to Base. Each tower pays once per run.
  function createRun() {
    return { paid: new Set(), zonesSeen: new Set() };
  }

  function isPaid(run, towerIndex) {
    return run.paid.has(towerIndex);
  }

  // You landed on `platform`. Returns the coins paid and the zone number if this is
  // the first landing in that zone this run (for the big banner), else null.
  function landOn(run, player, platform) {
    if (platform.kind !== 'tower') return { coins: 0, newZone: null };
    const zone = platform.zone;
    let newZone = null;
    if (!run.zonesSeen.has(zone.number)) {
      run.zonesSeen.add(zone.number);
      newZone = zone.number;
    }
    let coins = 0;
    if (!run.paid.has(platform.index)) {
      run.paid.add(platform.index);
      coins = zone.coins;
      player.coins += coins;
    }
    player.bestZone = Math.max(player.bestZone, zone.number);
    return { coins, newZone };
  }

  // Storage that never throws. Writes always go to memory too, so when the real
  // storage is missing or throws (file:// or private mode), memory takes over.
  function createStore(backing) {
    const memory = {};
    return {
      get(key) {
        try {
          if (backing) {
            const v = backing.getItem(key);
            if (v !== null && v !== undefined) return v;
          }
        } catch (e) { /* fall back to memory */ }
        return key in memory ? memory[key] : null;
      },
      set(key, value) {
        memory[key] = value;
        try {
          if (backing) backing.setItem(key, value);
        } catch (e) { /* memory has it */ }
      },
    };
  }

  // One save per name; "Peter" and "peter" share it.
  function saveKey(name) {
    return SAVE_PREFIX + String(name).trim().toLowerCase();
  }

  function wholeNumber(v, min, max) {
    return Number.isInteger(v) && v >= min ? Math.min(v, max) : min;
  }

  function loadPlayer(store, name) {
    const n = String(name).trim();
    const p = newPlayer(n);
    let data = null;
    try {
      data = JSON.parse(store.get(saveKey(n)));
    } catch (e) { /* corrupt save: start fresh */ }
    if (!data || typeof data !== 'object') return p;
    p.coins = wholeNumber(data.coins, 0, Number.MAX_SAFE_INTEGER);
    p.jumpLevel = wholeNumber(data.jumpLevel, 0, MAX_JUMP_LEVEL);
    p.speedLevel = wholeNumber(data.speedLevel, 0, 1e9);
    p.bestZone = wholeNumber(data.bestZone, 0, ZONES.length);
    return p;
  }

  function savePlayer(store, p) {
    const data = { coins: p.coins, jumpLevel: p.jumpLevel, speedLevel: p.speedLevel, bestZone: p.bestZone };
    store.set(saveKey(p.name), JSON.stringify(data));
  }

  function loadLastName(store) {
    return cleanName(store.get(LAST_NAME_KEY)) || '';
  }

  function saveLastName(store, name) {
    store.set(LAST_NAME_KEY, name);
  }

  const api = {
    ZONES, TOWERS_PER_ZONE, TOWER_SIZE, BASE_SIZE, STREET_Y, MAX_JUMP_LEVEL, SPEED_PACKS, BASE,
    zoneOfTower, tower, gapBetween, jumpDistance, jumpPrice, canReach, speedFactor,
    pickTarget, samePlatform, isFreeName, cleanName, newPlayer, priceFor, buyJump, buySpeed,
    createRun, isPaid, landOn,
    createStore, saveKey, loadPlayer, savePlayer, loadLastName, saveLastName,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.SpideyLogic = api;
})();
