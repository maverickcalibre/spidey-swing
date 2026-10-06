// Run with: node --test logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic.js');

test('zone table: gaps 5..30 ft, coins double from 1 to 32', () => {
  assert.deepStrictEqual(
    L.ZONES.map((z) => [z.number, z.name, z.gap, z.coins]),
    [
      [1, 'EASY', 5, 1],
      [2, 'MEDIUM', 10, 2],
      [3, 'AVERAGE', 15, 4],
      [4, 'HARD', 20, 8],
      [5, 'IMPOSSIBLE', 25, 16],
      [6, 'INFINITE', 30, 32],
    ]
  );
});

test('each of zones 1-5 has 20 towers, zone 6 never ends', () => {
  assert.strictEqual(L.zoneOfTower(0).number, 1);
  assert.strictEqual(L.zoneOfTower(19).number, 1);
  assert.strictEqual(L.zoneOfTower(20).number, 2);
  assert.strictEqual(L.zoneOfTower(99).number, 5);
  assert.strictEqual(L.zoneOfTower(100).number, 6);
  assert.strictEqual(L.zoneOfTower(123456).number, 6);
});

test('jump distance is 5 ft plus 5 ft per upgrade', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(L.jumpDistance), [5, 10, 15, 20, 25, 30]);
});

test('jump prices are 100, 200, 400, 800, 1600, then MAX (null) at 30 ft', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(L.jumpPrice), [100, 200, 400, 800, 1600]);
  assert.strictEqual(L.jumpPrice(5), null);
  assert.strictEqual(L.MAX_JUMP_LEVEL, 5);
});

test('buying jump upgrades: pays the price, adds 5 ft, stops at MAX', () => {
  const p = L.newPlayer('Tester');
  p.coins = 100 + 200 + 400 + 800 + 1600 + 50;
  for (const price of [100, 200, 400, 800, 1600]) {
    const before = p.coins;
    assert.deepStrictEqual(L.buyJump(p), { ok: true, cost: price });
    assert.strictEqual(p.coins, before - price);
  }
  assert.strictEqual(L.jumpDistance(p.jumpLevel), 30);
  assert.deepStrictEqual(L.buyJump(p), { ok: false, reason: 'max' });
  assert.strictEqual(p.coins, 50);
  assert.strictEqual(p.jumpLevel, 5);
});

test('speed packs: +1 for 10, +5 for 50, +10 for 100', () => {
  assert.deepStrictEqual(L.SPEED_PACKS, [
    { levels: 1, price: 10 },
    { levels: 5, price: 50 },
    { levels: 10, price: 100 },
  ]);
  const p = L.newPlayer('Tester');
  p.coins = 160;
  assert.deepStrictEqual(L.buySpeed(p, 0), { ok: true, cost: 10 });
  assert.deepStrictEqual(L.buySpeed(p, 1), { ok: true, cost: 50 });
  assert.deepStrictEqual(L.buySpeed(p, 2), { ok: true, cost: 100 });
  assert.strictEqual(p.speedLevel, 16);
  assert.strictEqual(p.coins, 0);
});

test('not enough coins: buying fails and nothing changes, coins never go negative', () => {
  const p = L.newPlayer('Tester');
  p.coins = 99;
  assert.deepStrictEqual(L.buyJump(p), { ok: false, reason: 'coins' });
  assert.deepStrictEqual(p, { name: 'Tester', coins: 99, jumpLevel: 0, speedLevel: 0, bestZone: 0 });
  p.coins = 9;
  assert.deepStrictEqual(L.buySpeed(p, 0), { ok: false, reason: 'coins' });
  assert.deepStrictEqual(L.buySpeed(p, 2), { ok: false, reason: 'coins' });
  assert.strictEqual(p.coins, 9);
  assert.strictEqual(p.speedLevel, 0);
  assert.deepStrictEqual(L.buySpeed(p, 7), { ok: false, reason: 'pack' });
});

test('speed factor: 1 at level 0, always going up, never above 3', () => {
  assert.strictEqual(L.speedFactor(0), 1);
  let last = 1;
  for (let lv = 1; lv <= 1000; lv++) {
    const f = L.speedFactor(lv);
    assert.ok(lv <= 200 ? f > last : f >= last, `level ${lv}`);
    assert.ok(f <= 3);
    last = f;
  }
  assert.ok(L.speedFactor(10) > 1.4 && L.speedFactor(10) < 2);
});

test('"aariz" in any case and with spaces gets everything free', () => {
  for (const n of ['aariz', 'Aariz', 'AARIZ', 'AaRiZ ', '  aariz  ']) {
    assert.strictEqual(L.isFreeName(n), true, n);
  }
  for (const n of ['Tester', 'aariz2', 'a ariz', 'Aari', '', null, undefined]) {
    assert.strictEqual(L.isFreeName(n), false, String(n));
  }
});

test('free player buys with 0 coins, cost 0; jump MAX still applies', () => {
  const p = L.newPlayer('AaRiZ ');
  for (let i = 0; i < 5; i++) assert.deepStrictEqual(L.buyJump(p), { ok: true, cost: 0 });
  assert.deepStrictEqual(L.buyJump(p), { ok: false, reason: 'max' });
  assert.deepStrictEqual(L.buySpeed(p, 2), { ok: true, cost: 0 });
  assert.strictEqual(p.coins, 0);
  assert.strictEqual(p.speedLevel, 10);
  assert.strictEqual(L.priceFor(p, 1600), 0);
  assert.strictEqual(L.priceFor(L.newPlayer('Bob'), 1600), 1600);
});

test('names: 1-16 characters after trimming', () => {
  assert.strictEqual(L.cleanName('  Peter '), 'Peter');
  assert.strictEqual(L.cleanName('1234567890123456'), '1234567890123456');
  assert.strictEqual(L.cleanName('12345678901234567'), null);
  assert.strictEqual(L.cleanName('   '), null);
  assert.strictEqual(L.cleanName(null), null);
});

test('layout: Base to tower 1 is 5 ft, then every gap is its zone gap', () => {
  assert.strictEqual(L.gapBetween(L.BASE, L.tower(0)), 5);
  for (let i = 0; i < 400; i++) {
    const want = L.zoneOfTower(i + 1).gap;
    assert.strictEqual(L.gapBetween(L.tower(i), L.tower(i + 1)), want, `tower ${i} -> ${i + 1}`);
  }
});

test('layout: zone boundaries use the gap of the zone you enter', () => {
  assert.strictEqual(L.gapBetween(L.tower(19), L.tower(20)), 10);
  assert.strictEqual(L.gapBetween(L.tower(39), L.tower(40)), 15);
  assert.strictEqual(L.gapBetween(L.tower(59), L.tower(60)), 20);
  assert.strictEqual(L.gapBetween(L.tower(79), L.tower(80)), 25);
  assert.strictEqual(L.gapBetween(L.tower(99), L.tower(100)), 30);
});

test('layout: towers far into zone 6 still exist with 30 ft gaps', () => {
  for (const i of [1000, 50000, 999999]) {
    const a = L.tower(i);
    const b = L.tower(i + 1);
    assert.strictEqual(a.zone.number, 6);
    assert.strictEqual(L.gapBetween(a, b), 30);
    assert.ok(b.z < a.z, 'course runs toward -Z');
  }
});

test('layout: straight line, 8 ft tops, heights vary by at most 4 ft, street far below', () => {
  assert.strictEqual(L.BASE.size, 24);
  assert.deepStrictEqual([L.BASE.x, L.BASE.z, L.BASE.y], [0, 0, 0]);
  const heights = new Set();
  for (let i = 0; i < 300; i++) {
    const t = L.tower(i);
    assert.strictEqual(t.x, 0);
    assert.strictEqual(t.size, 8);
    assert.ok(Math.abs(t.y) <= 4, `tower ${i} y=${t.y}`);
    assert.deepStrictEqual(L.tower(i), t, 'same tower every time');
    heights.add(t.y);
  }
  assert.ok(heights.size > 3, 'heights vary');
  assert.ok(L.STREET_Y <= -60);
});

test('reachability: a jump reaches a gap up to its distance, not more', () => {
  const p = L.newPlayer('Tester');
  assert.strictEqual(L.canReach(L.BASE, L.tower(0), 0), true);
  assert.strictEqual(L.canReach(L.tower(18), L.tower(19), 0), true);
  assert.strictEqual(L.canReach(L.tower(19), L.tower(20), 0), false);
  assert.strictEqual(L.canReach(L.tower(19), L.tower(20), 1), true);
  assert.strictEqual(L.canReach(L.tower(39), L.tower(40), 1), false);
  assert.strictEqual(L.canReach(L.tower(99), L.tower(100), 4), false);
  assert.strictEqual(L.canReach(L.tower(99), L.tower(100), 5), true);
  assert.strictEqual(L.canReach(L.tower(5000), L.tower(5001), 5), true);
  // Each upgrade opens exactly the next zone.
  for (let lv = 0; lv <= 5; lv++) {
    const zoneStart = 20 * (lv + 1);
    if (lv < 5) assert.strictEqual(L.canReach(L.tower(zoneStart - 1), L.tower(zoneStart), lv), false);
    assert.strictEqual(L.canReach(L.tower(zoneStart - 2), L.tower(zoneStart - 1), lv), true);
  }
  assert.strictEqual(p.jumpLevel, 0);
});

test('target: idle stick picks the next tower forward', () => {
  assert.strictEqual(L.pickTarget(L.BASE, [], null).index, 0);
  assert.strictEqual(L.pickTarget(L.tower(7), [], null).index, 8);
  assert.strictEqual(L.pickTarget(L.tower(99), [], null).index, 100);
});

test('target: held stick picks the nearest platform within 35 degrees', () => {
  const all = [L.BASE, L.tower(0), L.tower(1), L.tower(2), L.tower(3)];
  const fwd = { x: 0, z: -1 };
  const back = { x: 0, z: 1 };
  assert.strictEqual(L.pickTarget(L.tower(1), all, fwd).index, 2);
  assert.strictEqual(L.pickTarget(L.tower(1), all, back).index, 0);
  assert.strictEqual(L.pickTarget(L.tower(0), all, back).kind, 'base');
  assert.strictEqual(L.pickTarget(L.BASE, all, fwd).index, 0);
  assert.strictEqual(L.pickTarget(L.tower(1), all, { x: 1, z: 0 }), null, 'nothing to the side');
  // 30 degrees off still counts, 40 degrees does not.
  const a30 = (30 * Math.PI) / 180;
  const a40 = (40 * Math.PI) / 180;
  assert.strictEqual(L.pickTarget(L.tower(1), all, { x: Math.sin(a30), z: -Math.cos(a30) }).index, 2);
  assert.strictEqual(L.pickTarget(L.tower(1), all, { x: Math.sin(a40), z: -Math.cos(a40) }), null);
});

test('coins: landing pays the zone coins once per run, Base never pays', () => {
  const p = L.newPlayer('Tester');
  const run = L.createRun();
  assert.deepStrictEqual(L.landOn(run, p, L.BASE), { coins: 0, newZone: null });
  assert.deepStrictEqual(L.landOn(run, p, L.tower(0)), { coins: 1, newZone: 1 });
  assert.deepStrictEqual(L.landOn(run, p, L.tower(1)), { coins: 1, newZone: null });
  assert.deepStrictEqual(L.landOn(run, p, L.tower(0)), { coins: 0, newZone: null }, 'paid already');
  assert.deepStrictEqual(L.landOn(run, p, L.tower(20)), { coins: 2, newZone: 2 });
  assert.deepStrictEqual(L.landOn(run, p, L.tower(100)), { coins: 32, newZone: 6 });
  assert.strictEqual(p.coins, 36);
  assert.strictEqual(p.bestZone, 6);
  assert.strictEqual(L.isPaid(run, 0), true);
  assert.strictEqual(L.isPaid(run, 2), false);
});

test('coins: a new run brings all tower coins back, earned coins are kept', () => {
  const p = L.newPlayer('Tester');
  let run = L.createRun();
  for (let i = 0; i < 20; i++) L.landOn(run, p, L.tower(i));
  assert.strictEqual(p.coins, 20);
  run = L.createRun();
  assert.strictEqual(L.isPaid(run, 0), false);
  assert.deepStrictEqual(L.landOn(run, p, L.tower(0)), { coins: 1, newZone: 1 });
  assert.strictEqual(p.coins, 21);
  assert.strictEqual(p.bestZone, 1);
});

function fakeStorage() {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

test('saves: round trip, one save per name (case-insensitive), last name kept', () => {
  const store = L.createStore(fakeStorage());
  const p = L.newPlayer('Peter');
  Object.assign(p, { coins: 321, jumpLevel: 2, speedLevel: 15, bestZone: 3 });
  L.savePlayer(store, p);
  L.saveLastName(store, 'Peter');
  assert.deepStrictEqual(L.loadPlayer(store, 'peter '), { name: 'peter', coins: 321, jumpLevel: 2, speedLevel: 15, bestZone: 3 });
  assert.deepStrictEqual(L.loadPlayer(store, 'Miles'), L.newPlayer('Miles'));
  assert.strictEqual(L.loadLastName(store), 'Peter');
});

test('saves: corrupt or nonsense data falls back to a fresh player', () => {
  const backing = fakeStorage();
  const store = L.createStore(backing);
  backing.data[L.saveKey('Peter')] = '{not json';
  assert.deepStrictEqual(L.loadPlayer(store, 'Peter'), L.newPlayer('Peter'));
  backing.data[L.saveKey('Peter')] = JSON.stringify({ coins: -5, jumpLevel: 99, speedLevel: 'x', bestZone: 2.5 });
  assert.deepStrictEqual(L.loadPlayer(store, 'Peter'), { name: 'Peter', coins: 0, jumpLevel: 5, speedLevel: 0, bestZone: 0 });
  backing.data[L.saveKey('Peter')] = 'null';
  assert.deepStrictEqual(L.loadPlayer(store, 'Peter'), L.newPlayer('Peter'));
  assert.strictEqual(L.loadLastName(L.createStore(fakeStorage())), '');
});

test('saves: storage that throws or is missing never crashes, memory takes over', () => {
  const throwing = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  for (const backing of [throwing, null, undefined]) {
    const store = L.createStore(backing);
    const p = L.newPlayer('Gwen');
    p.coins = 42;
    L.savePlayer(store, p);
    L.saveLastName(store, 'Gwen');
    assert.strictEqual(L.loadPlayer(store, 'Gwen').coins, 42);
    assert.strictEqual(L.loadLastName(store), 'Gwen');
  }
});
