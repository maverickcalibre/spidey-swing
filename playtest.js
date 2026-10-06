// Browser autotest. Loaded by game.js only when the URL has ?autotest.
// Drives the game through window.__spidey and writes the results as JSON into <pre id="autotest">.
(function () {
  'use strict';

  const G = window.__spidey;
  const results = [];
  const S = () => G.getState();

  function check(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function scenario(name, fn) {
    try {
      const detail = fn();
      results.push({ name, pass: true, detail: detail || 'ok' });
    } catch (e) {
      results.push({ name, pass: false, detail: String(e && e.message ? e.message : e) });
    }
  }

  // Jump with the stick idle and wait until he has landed (or respawned).
  function hop(seconds) {
    G.setStick(0, 0);
    check(G.pressJump(), 'jump was not accepted');
    G.step(seconds || 3);
  }

  function run() {
    scenario('page boots with zero errors', () => {
      check(window.__errors.length === 0, 'errors: ' + window.__errors.join(' | '));
      const s = S();
      check(s.mode === 'name', 'name screen first, got ' + s.mode);
      check(!document.getElementById('nameScreen').classList.contains('hidden'), 'name screen hidden');
      return 'mode=name, towers loaded ' + s.towersLoaded;
    });

    scenario('new player Tester jumps from Base onto tower 1 and gets 1 coin', () => {
      check(G.setName('Tester'), 'setName failed');
      let s = S();
      check(s.mode === 'play' && s.platform.kind === 'base', 'not on Base');
      check(s.coins === 0 && s.jumpFt === 5 && s.speedLevel === 0, 'not a fresh player');
      check(s.hud.zone === 'HOME BASE', 'HUD zone ' + s.hud.zone);
      hop();
      s = S();
      check(s.platform.kind === 'tower' && s.platform.index === 0, 'landed on ' + JSON.stringify(s.platform));
      check(s.coins === 1, 'coins ' + s.coins);
      check(s.hud.coins === '1', 'HUD coins ' + s.hud.coins);
      check(s.hud.zone === 'ZONE 1 · EASY', 'HUD zone ' + s.hud.zone);
      check(s.lastPopup === '+1', 'popup ' + s.lastPopup);
      return 'coins=1 on tower 0';
    });

    scenario('hops all 20 zone-1 towers: 20 coins, zone 1 banner', () => {
      for (let i = 1; i < 20; i++) hop(2);
      const s = S();
      check(s.platform.index === 19, 'on tower ' + s.platform.index);
      check(s.coins === 20, 'coins ' + s.coins);
      check(s.banners.includes('ZONE 1 - EASY - 1 coin per tower'), 'banners ' + JSON.stringify(s.banners));
      check(s.coinsShown === s.towersLoaded - 20 + Math.max(0, s.towerMin), 'coin meshes ' + s.coinsShown);
      return 'coins=20, banner "' + s.banners[0] + '"';
    });

    scenario('jump toward zone 2 with 5 ft: falls, back on Base, coins kept, tower coins reset', () => {
      const towerY = S().pos.y;
      hop(0.01);
      let s = S();
      check(s.action === 'leap', 'expected a leap, got ' + s.action);
      G.step(0.9);
      s = S();
      check(s.action === 'fall' || s.action === 'leap', 'in the air, got ' + s.action);
      G.step(1.2);
      s = S();
      check(s.banners.includes('Oops!'), 'no Oops banner');
      G.step(2);
      s = S();
      check(s.platform.kind === 'base' && s.action === 'stand', 'not back on Base: ' + JSON.stringify(s.platform) + ' ' + s.action);
      check(s.coins === 20, 'coins ' + s.coins);
      check(s.paidCount === 0, 'run not reset, paid ' + s.paidCount);
      check(s.coinsShown === s.towersLoaded, 'coins not back: ' + s.coinsShown + '/' + s.towersLoaded);
      return 'fell from y=' + towerY + ', respawned on Base with 20 coins';
    });

    scenario('buy jump with 100 coins: 10 ft, next price 200, coins 0, zone 2 pays 2', () => {
      G.setCoins(100);
      G.openPanel();
      let s = S();
      check(s.shop.jump.price === '100' && !s.shop.jump.disabled, 'jump button ' + JSON.stringify(s.shop.jump));
      G.clickBuy('buyJump');
      s = S();
      check(s.jumpFt === 10, 'jump ' + s.jumpFt);
      check(s.coins === 0, 'coins ' + s.coins);
      check(s.shop.jump.price === '200' && s.shop.jump.disabled, 'next ' + JSON.stringify(s.shop.jump));
      G.closePanel();
      G.teleportTo(19);
      hop();
      s = S();
      check(s.platform.index === 20, 'on ' + s.platform.index);
      check(s.coins === 2, 'coins ' + s.coins);
      check(s.banners.includes('ZONE 2 - MEDIUM - 2 coins per tower'), 'no zone 2 banner');
      hop();
      s = S();
      check(s.platform.index === 21 && s.coins === 4, 'second zone-2 tower: ' + s.platform.index + ' coins ' + s.coins);
      return 'jump 10 ft, zone 2 pays 2 per tower';
    });

    scenario('speed packs cost 10/50/100 and add 1/5/10', () => {
      G.goBase();
      G.setCoins(160);
      const lv0 = S().speedLevel;
      let s = S();
      check(s.shop.speed.map((b) => b.price).join() === '10,50,100', 'prices ' + JSON.stringify(s.shop.speed));
      G.clickBuy('buySpeed0');
      s = S();
      check(s.coins === 150 && s.speedLevel === lv0 + 1, '+1: ' + s.coins + ' ' + s.speedLevel);
      G.clickBuy('buySpeed1');
      s = S();
      check(s.coins === 100 && s.speedLevel === lv0 + 6, '+5: ' + s.coins + ' ' + s.speedLevel);
      G.clickBuy('buySpeed2');
      s = S();
      check(s.coins === 0 && s.speedLevel === lv0 + 16, '+10: ' + s.coins + ' ' + s.speedLevel);
      check(s.hud.stats.indexOf('SPEED 16') >= 0, 'HUD stats ' + s.hud.stats);
      return 'speed level 16, coins 0';
    });

    scenario('buying without enough coins fails and changes nothing', () => {
      G.setCoins(9);
      const before = S();
      check(before.shop.jump.disabled && before.shop.speed.every((b) => b.disabled), 'buttons should be disabled');
      for (const id of ['buyJump', 'buySpeed0', 'buySpeed1', 'buySpeed2']) G.clickBuy(id);
      check(!G.buyJump().ok, 'buyJump should fail');
      check(!G.buySpeed(0).ok && !G.buySpeed(2).ok, 'buySpeed should fail');
      const after = S();
      check(after.coins === 9 && after.jumpLevel === before.jumpLevel && after.speedLevel === before.speedLevel,
        'changed: ' + JSON.stringify([after.coins, after.jumpLevel, after.speedLevel]));
      G.setCoins(10);
      check(!S().shop.speed[0].disabled && S().shop.speed[1].disabled, 'exactly 10 coins buys +1 only');
      return 'coins stay 9, buttons disabled';
    });

    scenario('name "AaRiZ " gets everything FREE, buying works at 0 coins', () => {
      G.closePanel();
      check(G.setName('AaRiZ '), 'setName failed');
      G.openPanel();
      let s = S();
      check(s.coins === 0, 'coins ' + s.coins);
      check(s.shop.jump.price === 'FREE' && !s.shop.jump.disabled, 'jump ' + JSON.stringify(s.shop.jump));
      check(s.shop.speed.every((b) => b.price === 'FREE' && !b.disabled), 'speed ' + JSON.stringify(s.shop.speed));
      G.clickBuy('buyJump');
      G.clickBuy('buySpeed2');
      s = S();
      check(s.jumpFt === 10 && s.speedLevel === 10 && s.coins === 0, 'after buying ' + JSON.stringify([s.jumpFt, s.speedLevel, s.coins]));
      return 'FREE everywhere, bought +5 ft and +10 speed at 0 coins';
    });

    scenario('jump at max shows MAX', () => {
      for (let i = 0; i < 4; i++) G.clickBuy('buyJump');
      const s = S();
      check(s.jumpFt === 30, 'jump ' + s.jumpFt);
      check(s.shop.jump.price === 'MAX' && s.shop.jump.disabled && s.shop.jump.text.indexOf('MAX') >= 0, JSON.stringify(s.shop.jump));
      const r = G.buyJump();
      check(!r.ok && r.reason === 'max', 'buy at max ' + JSON.stringify(r));
      check(S().jumpFt === 30, 'still 30');
      return 'MAX at 30 ft';
    });

    scenario('30 ft jump: zone 5 end through 45 zone-6 towers, 32 each, bounded scene', () => {
      G.closePanel();
      G.setName('Tester');
      G.setLevels(5, 0);
      G.teleportTo(99);
      const start = S();
      let maxObjects = start.sceneObjects;
      let maxLoaded = start.towersLoaded;
      for (let k = 0; k < 45; k++) {
        const before = S().coins;
        hop(2.5);
        const s = S();
        check(s.platform.index === 100 + k, 'hop ' + k + ' landed on ' + s.platform.index);
        check(s.coins === before + 32, 'hop ' + k + ' paid ' + (s.coins - before));
        check(s.towerMax >= s.platform.index + 10, 'no towers ahead at ' + s.platform.index);
        maxObjects = Math.max(maxObjects, s.sceneObjects);
        maxLoaded = Math.max(maxLoaded, s.towersLoaded);
      }
      const end = S();
      check(end.banners.includes('ZONE 6 - INFINITE - 32 coins per tower'), 'no zone 6 banner');
      check(maxLoaded <= 21, 'too many towers ' + maxLoaded);
      check(maxObjects <= start.sceneObjects + 12, 'scene grew ' + start.sceneObjects + ' -> ' + maxObjects);
      check(end.towerMin >= end.platform.index - 6, 'old towers kept, min ' + end.towerMin);
      return 'on tower ' + end.platform.index + ', +' + (end.coins - start.coins) + ' coins, scene objects ' +
        start.sceneObjects + ' -> max ' + maxObjects + ', towers ' + end.towerMin + '..' + end.towerMax;
    });

    scenario('jump pressed mid-air is ignored', () => {
      G.setLevels(0, 0);
      G.teleportTo(5);
      G.setStick(0, 0);
      check(G.pressJump(), 'first jump');
      G.step(0.3);
      let s = S();
      check(s.action === 'swing', 'expected swing, got ' + s.action);
      check(s.webVisible, 'web line not visible mid-swing');
      check(G.pressJump() === false, 'mid-air jump accepted');
      G.step(3);
      s = S();
      check(s.platform.index === 6 && s.action === 'stand', 'ended on ' + s.platform.index + ' ' + s.action);
      return 'landed on tower 6 only';
    });

    scenario('held stick aims: back swings to Base (no pay, run goes on); walking never falls', () => {
      G.teleportTo(0);
      const coins = S().coins;
      const paid = S().paidCount;
      G.setStick(0, -1);
      check(G.pressJump(), 'jump');
      G.step(3);
      G.setStick(0, 0);
      let s = S();
      check(s.platform.kind === 'base', 'on ' + JSON.stringify(s.platform));
      check(s.coins === coins && s.paidCount === paid, 'Base paid or reset the run');
      G.teleportTo(3);
      G.setStick(1, 0);
      G.step(4);
      G.setStick(0, 0);
      s = S();
      check(s.platform.index === 3 && s.action === 'stand' && Math.abs(s.pos.x) <= 4, 'walked off: ' + JSON.stringify(s.pos));
      G.setStick(1, 0);
      check(G.pressJump(), 'side jump');
      G.step(4);
      G.setStick(0, 0);
      s = S();
      check(s.platform.kind === 'base' && s.action === 'stand', 'side jump with nothing there should fall and respawn');
      return 'Base reached by stick, edge clamp holds, side leap falls';
    });

    scenario('Base button ends the run and opens the Base panel', () => {
      G.teleportTo(2);
      hop();
      check(S().paidCount > 0, 'nothing paid');
      G.goBase();
      const s = S();
      check(s.platform.kind === 'base' && s.panelOpen && s.paidCount === 0, JSON.stringify([s.platform, s.panelOpen, s.paidCount]));
      G.closePanel();
      return 'ok';
    });

    scenario('saves are per name and survive a reload from save', () => {
      G.setName('Alice');
      G.setCoins(123);
      G.setLevels(2, 7);
      G.setName('Bob');
      let s = S();
      check(s.coins === 0 && s.jumpLevel === 0 && s.speedLevel === 0, 'Bob not fresh ' + JSON.stringify([s.coins, s.jumpLevel]));
      G.setCoins(5);
      G.setName('alice');
      s = S();
      check(s.coins === 123 && s.jumpLevel === 2 && s.speedLevel === 7, 'Alice lost ' + JSON.stringify([s.coins, s.jumpLevel, s.speedLevel]));
      G.reloadFromSave();
      s = S();
      check(s.coins === 123 && s.jumpLevel === 2 && s.speedLevel === 7, 'after reload ' + JSON.stringify([s.coins, s.jumpLevel]));
      G.setName('Bob');
      check(S().coins === 5, 'Bob coins ' + S().coins);
      return 'Alice 123 coins / Bob 5 coins kept';
    });

    G.render();
    scenario('no errors during the whole run', () => {
      check(window.__errors.length === 0, window.__errors.join(' | '));
    });

    const out = {
      pass: results.every((r) => r.pass) && window.__errors.length === 0,
      results,
      errors: window.__errors.slice(),
    };
    let pre = document.getElementById('autotest');
    if (!pre) {
      pre = document.createElement('pre');
      pre.id = 'autotest';
      document.body.appendChild(pre);
    }
    pre.textContent = JSON.stringify(out, null, 1);
    document.title = out.pass ? 'AUTOTEST PASS' : 'AUTOTEST FAIL';
  }

  setTimeout(() => {
    try {
      run();
    } catch (e) {
      window.__errors.push('playtest crashed: ' + (e && e.stack ? e.stack : e));
      const pre = document.createElement('pre');
      pre.id = 'autotest';
      pre.textContent = JSON.stringify({ pass: false, results, errors: window.__errors });
      document.body.appendChild(pre);
    }
  }, 300);
})();
