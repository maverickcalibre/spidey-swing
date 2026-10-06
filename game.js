// Spidey Swing: the 3D scene, Spider-Man, controls, camera and screens.
// The rules (zones, prices, coins, saves) live in logic.js.
// The game moves in fixed steps of 1/60 s (update), separate from drawing (render),
// so the autotest can step it exactly.
(function () {
  'use strict';

  const L = window.SpideyLogic;
  const params = new URLSearchParams(location.search);
  const AUTOTEST = params.has('autotest');
  const SHOT = params.get('shot'); // name | play | swing | base: set up a scene for a screenshot
  const STEP = 1 / 60;
  const WALK_SPEED = 9; // ft per second at speed level 0
  const FALL_TIME = 1.0; // the "Oops!" moment before you are back on the Base
  const BANNER_TIME = 2.6;
  const TOWERS_AHEAD = 14; // towers built in front of you; far-behind ones are removed
  const TOWERS_BEHIND = 6;
  const SPAWN = { x: 0, z: -4 }; // where you stand on the Base
  const PAD = { x: 7, z: 5, size: 5 }; // the SHOP pad on the Base
  const FORWARD = { x: 0, z: -1 }; // the course runs toward -Z

  const $ = (id) => document.getElementById(id);

  // Real saves only in normal play; autotest and screenshots use memory only.
  let backing = null;
  if (!AUTOTEST && !SHOT) {
    try { backing = window.localStorage; } catch (e) { backing = null; }
  }
  const store = L.createStore(backing);

  // ---------- Game state ----------
  const game = {
    mode: 'name', // name | play
    panelOpen: false,
    player: L.newPlayer('Player'),
    run: L.createRun(),
    platform: L.BASE, // the platform you stand on (or last stood on)
    pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z),
    facing: Math.PI, // model looks toward +Z at 0, so PI looks down the course
    action: 'stand', // stand | swing | leap | fall
    move: null, // the swing or leap in progress
    walkPhase: 0,
    time: 0,
    padArmed: true,
    banner: '',
    bannerTime: 0,
    banners: [], // every banner shown (the autotest reads this)
    lastPopup: '',
    hintOn: true,
    frozen: false, // screenshots: stop the simulation, keep drawing
  };
  const stick = { x: 0, y: 0, pointer: null }; // joystick: x right, y forward, length 0..1
  const keys = new Set();

  // ---------- Renderer, scene, camera ----------
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!SHOT });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900);
  const SKY_HORIZON = 0xd6efff;
  scene.fog = new THREE.Fog(SKY_HORIZON, 110, 380);

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  scene.background = canvasTexture(2, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f8cff');
    grad.addColorStop(0.55, '#8cc8ff');
    grad.addColorStop(1, '#d6efff');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a99, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 90, 50);
  scene.add(sun);

  // A seeded random so the city looks the same every time.
  let seed = 12345;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Building walls with lit windows, drawn on a canvas (no image files).
  function windowTexture(wall, lit, dark, cols, rows) {
    const t = canvasTexture(64, 256, (g, w, h) => {
      g.fillStyle = wall;
      g.fillRect(0, 0, w, h);
      const cw = w / cols;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          g.fillStyle = rand() < 0.45 ? lit : dark;
          g.fillRect(c * cw + cw * 0.2, r * rh + rh * 0.22, cw * 0.6, rh * 0.56);
        }
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ---------- Zone looks ----------
  const ZONE_LOOKS = [
    { wall: '#3fae5a', trim: 0xffe14d, roof: 0x9fd6a8 }, // EASY: green
    { wall: '#3a7be0', trim: 0xffffff, roof: 0xa9c6f2 }, // MEDIUM: blue
    { wall: '#8a4fd8', trim: 0x6ff0ff, roof: 0xc8b0ee }, // AVERAGE: purple
    { wall: '#e8862a', trim: 0xfff0b0, roof: 0xf2c69a }, // HARD: orange
    { wall: '#d8323a', trim: 0xffd0d0, roof: 0xeea0a0 }, // IMPOSSIBLE: red
    { wall: '#2b2b3a', trim: 0xffc400, roof: 0x77778a }, // INFINITE: dark with gold
  ];
  const zoneMats = ZONE_LOOKS.map((look) => {
    const tex = windowTexture(look.wall, '#fff3a0', '#1d2a4a', 3, 8);
    tex.repeat.set(1, 3);
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const roof = new THREE.MeshLambertMaterial({ color: look.roof });
    return {
      body: [side, side, roof, roof, side, side], // box faces: +x -x +y -y +z -z
      trim: new THREE.MeshLambertMaterial({ color: look.trim }),
    };
  });

  // Shared geometry: tower bodies are a 1 ft tall box with its top at y=0, scaled down to the street.
  const bodyGeo = new THREE.BoxGeometry(L.TOWER_SIZE, 1, L.TOWER_SIZE).translate(0, -0.5, 0);
  const trimGeo = new THREE.BoxGeometry(L.TOWER_SIZE + 0.8, 0.7, L.TOWER_SIZE + 0.8).translate(0, -0.2, 0);
  const coinGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 24).rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffc81e, emissive: 0x7a5200 });
  const coinRimGeo = new THREE.TorusGeometry(1.3, 0.14, 6, 24);
  const coinRimMat = new THREE.MeshLambertMaterial({ color: 0xe09a00, emissive: 0x553300 });

  // Floating sign at the start of each zone.
  const signGeo = new THREE.PlaneGeometry(12, 4.5);
  const signMats = L.ZONES.map((z, k) => {
    const tex = canvasTexture(512, 192, (g, w, h) => {
      g.fillStyle = '#ffffff';
      roundRect(g, 0, 0, w, h, 36);
      g.fillStyle = ZONE_LOOKS[k].wall;
      roundRect(g, 12, 12, w - 24, h - 24, 28);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = '900 72px "Comic Sans MS", "Trebuchet MS", sans-serif';
      g.fillText('ZONE ' + z.number, w / 2, 88);
      g.font = '900 46px "Comic Sans MS", "Trebuchet MS", sans-serif';
      g.fillText(z.name + '  ' + z.coins + (z.coins === 1 ? ' coin' : ' coins'), w / 2, 156);
    });
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false });
  });

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.fill();
  }

  // ---------- Towers (built ahead, removed behind, so zone 6 can go on forever) ----------
  const towers = new Map(); // index -> { data, group, coin }

  function buildTower(i) {
    const data = L.tower(i);
    const k = data.zone.number - 1;
    const group = new THREE.Group();
    group.position.set(data.x, data.y, data.z);
    const body = new THREE.Mesh(bodyGeo, zoneMats[k].body);
    body.scale.y = data.y - L.STREET_Y;
    group.add(body);
    group.add(new THREE.Mesh(trimGeo, zoneMats[k].trim));
    const coin = new THREE.Group();
    coin.add(new THREE.Mesh(coinGeo, coinMat));
    coin.add(new THREE.Mesh(coinRimGeo, coinRimMat));
    coin.position.y = 3.2;
    coin.visible = !L.isPaid(game.run, i);
    group.add(coin);
    if (i % L.TOWERS_PER_ZONE === 0 && i <= L.TOWERS_PER_ZONE * (L.ZONES.length - 1)) {
      const sign = new THREE.Mesh(signGeo, signMats[k]);
      sign.position.set(12, 8, 0);
      sign.rotation.y = -0.35;
      group.add(sign);
    }
    scene.add(group);
    towers.set(i, { data, group, coin });
  }

  // Which tower are we around? The one we stand on, or the one we swing to.
  function progressIndex() {
    let i = game.platform.kind === 'tower' ? game.platform.index : 0;
    if (game.move && game.move.target && game.move.target.kind === 'tower') i = Math.max(i, game.move.target.index);
    return i;
  }

  function updateTowers() {
    const c = progressIndex();
    const lo = Math.max(0, c - TOWERS_BEHIND);
    const hi = c + TOWERS_AHEAD;
    for (const [i, t] of towers) {
      if (i < lo || i > hi) {
        scene.remove(t.group); // geometry and materials are shared, nothing else to free
        towers.delete(i);
      }
    }
    for (let i = lo; i <= hi; i++) if (!towers.has(i)) buildTower(i);
  }

  function refreshCoins() {
    for (const [i, t] of towers) t.coin.visible = !L.isPaid(game.run, i);
  }

  // ---------- The Base rooftop ----------
  const baseGroup = new THREE.Group();
  {
    const tex = windowTexture('#c9b28f', '#fff3a0', '#3a3550', 6, 8);
    tex.repeat.set(1, 3);
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const roof = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(L.BASE_SIZE, -L.STREET_Y, L.BASE_SIZE).translate(0, L.STREET_Y / 2, 0),
      [side, side, roof, roof, side, side]);
    baseGroup.add(body);
    // Low red wall around the roof edge.
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd0141c });
    const s = L.BASE_SIZE;
    for (const [w, d, x, z] of [[s + 1, 1, 0, s / 2], [s + 1, 1, 0, -s / 2], [1, s + 1, s / 2, 0], [1, s + 1, -s / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), wallMat);
      m.position.set(x, 0.1, z);
      baseGroup.add(m);
    }
    // Big BASE sign on two posts at the front-left corner.
    const signTex = canvasTexture(512, 220, (g, w, h) => {
      g.fillStyle = '#ffffff';
      roundRect(g, 0, 0, w, h, 40);
      g.fillStyle = '#d0141c';
      roundRect(g, 14, 14, w - 28, h - 28, 30);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = '900 150px "Comic Sans MS", "Trebuchet MS", sans-serif';
      g.fillText('BASE', w / 2, 165);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.3), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
    sign.position.set(-7.5, 7.5, -9);
    sign.rotation.y = 0.35;
    baseGroup.add(sign);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x555a66 });
    for (const dx of [-3.5, 3.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6), postMat);
      post.position.set(-7.5 + dx * Math.cos(0.35), 3, -9 - dx * Math.sin(0.35));
      baseGroup.add(post);
    }
  }
  // The glowing SHOP pad.
  const padMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#18d6ff';
      roundRect(g, 0, 0, w, h, 40);
      g.fillStyle = '#ffffff';
      roundRect(g, 14, 14, w - 28, h - 28, 30);
      g.fillStyle = '#18a8ff';
      roundRect(g, 26, 26, w - 52, h - 52, 22);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = '900 78px "Comic Sans MS", "Trebuchet MS", sans-serif';
      g.fillText('SHOP', w / 2, 156);
    }),
    transparent: true,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(PAD.size, PAD.size).rotateX(-Math.PI / 2), padMat);
  pad.position.set(PAD.x, 0.06, PAD.z);
  baseGroup.add(pad);
  const padGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD.size * 0.5, PAD.size * 0.62, 3, 24, 1, true).translate(0, 1.5, 0),
    new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
  );
  padGlow.position.set(PAD.x, 0, PAD.z);
  baseGroup.add(padGlow);
  scene.add(baseGroup);

  // ---------- The street and the far city (they follow you along the course) ----------
  const streetTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#5a5f6b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd84a';
    g.fillRect(w / 2 - 3, 0, 6, h * 0.5);
  });
  streetTex.wrapS = streetTex.wrapT = THREE.RepeatWrapping;
  streetTex.repeat.set(1, 40);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(40, 1600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: streetTex }));
  street.position.y = L.STREET_Y;
  scene.add(street);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8b93a3 }));
  ground.position.y = L.STREET_Y - 0.2;
  scene.add(ground);

  const CITY_COUNT = 150;
  const CITY_SPAN = 700; // buildings live from 520 ft ahead to 180 ft behind you
  const cityTex = windowTexture('#9aa8c0', '#fff6c8', '#55607a', 4, 8);
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ map: cityTex }), CITY_COUNT);
  const cityData = [];
  const cityColors = [0xffffff, 0xffd9c2, 0xcfe0ff, 0xe6d3ff, 0xd2f2d8];
  const tmpM = new THREE.Matrix4();
  const tmpColor = new THREE.Color();
  for (let n = 0; n < CITY_COUNT; n++) {
    const side = n % 2 ? 1 : -1;
    const b = {
      x: side * (70 + rand() * 180),
      z: 180 - rand() * CITY_SPAN,
      w: 14 + rand() * 18,
      d: 14 + rand() * 18,
      h: 40 + rand() * 90, // most tops stay below the course
    };
    cityData.push(b);
    city.setColorAt(n, tmpColor.setHex(cityColors[n % cityColors.length]));
  }
  function placeCity(n) {
    const b = cityData[n];
    tmpM.makeScale(b.w, b.h, b.d).setPosition(b.x, L.STREET_Y, b.z);
    city.setMatrixAt(n, tmpM);
  }
  for (let n = 0; n < CITY_COUNT; n++) placeCity(n);
  city.frustumCulled = false;
  scene.add(city);

  // Wrap far buildings around so the city never runs out.
  function updateCity() {
    const pz = game.pos.z;
    let moved = false;
    for (let n = 0; n < CITY_COUNT; n++) {
      const b = cityData[n];
      if (b.z > pz + 180) { b.z -= CITY_SPAN; placeCity(n); moved = true; }
      else if (b.z < pz + 180 - CITY_SPAN) { b.z += CITY_SPAN; placeCity(n); moved = true; }
    }
    if (moved) city.instanceMatrix.needsUpdate = true;
    const snap = Math.round(pz / 40) * 40; // street texture repeats every 40 ft
    street.position.z = snap;
    ground.position.z = snap;
  }

  // ---------- Spider-Man from simple shapes ----------
  const webRedTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#e3262e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,0,0,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke();
    }
  });
  const red = new THREE.MeshLambertMaterial({ color: 0xffffff, map: webRedTex });
  const plainRed = new THREE.MeshLambertMaterial({ color: 0xe3262e });
  const blue = new THREE.MeshLambertMaterial({ color: 0x1f4fd8 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });

  function mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  const spidey = new THREE.Group(); // feet at y=0, looks toward +Z
  const body = new THREE.Group(); // tilts during swings
  spidey.add(body);
  const parts = {};
  {
    const torso = mesh(new THREE.CapsuleGeometry(0.62, 0.9, 4, 12), red, 0, 3.35, 0);
    torso.scale.set(1.1, 1, 0.8);
    body.add(torso);
    // Blue sides of the suit.
    for (const sx of [-1, 1]) {
      const sideM = mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 8), blue, sx * 0.5, 3.25, 0);
      sideM.scale.set(0.7, 1, 1.4);
      body.add(sideM);
    }
    body.add(mesh(new THREE.CylinderGeometry(0.66, 0.6, 0.25, 12), plainRed, 0, 2.6, 0)); // belt
    // Spider emblem on the chest and back.
    for (const sz of [-1, 1]) {
      const emblem = new THREE.Group();
      emblem.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), black));
      for (let i = 0; i < 4; i++) {
        const leg = mesh(new THREE.BoxGeometry(0.62, 0.05, 0.03), black);
        leg.rotation.z = -0.75 + i * 0.5;
        emblem.add(leg);
      }
      emblem.position.set(0, 3.7, sz * 0.5);
      emblem.scale.z = 0.5;
      body.add(emblem);
    }
    const head = new THREE.Group();
    head.position.set(0, 4.75, 0);
    const skull = mesh(new THREE.SphereGeometry(0.62, 16, 12), red);
    skull.scale.set(1, 1.12, 1);
    head.add(skull);
    for (const sx of [-1, 1]) {
      const rim = mesh(new THREE.SphereGeometry(0.26, 12, 8), black, sx * 0.25, 0.08, 0.5);
      rim.scale.set(1, 1.3, 0.35);
      rim.rotation.z = sx * 0.5;
      head.add(rim);
      const eye = mesh(new THREE.SphereGeometry(0.2, 12, 8), white, sx * 0.26, 0.09, 0.56);
      eye.scale.set(1, 1.3, 0.35);
      eye.rotation.z = sx * 0.5;
      head.add(eye);
    }
    body.add(head);
    // Arms: pivot at the shoulder.
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.82, 4.0, 0);
      arm.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), red));
      arm.add(mesh(new THREE.CapsuleGeometry(0.22, 1.05, 4, 8), blue, 0, -0.75, 0));
      const hand = mesh(new THREE.SphereGeometry(0.25, 10, 8), plainRed, 0, -1.5, 0);
      arm.add(hand);
      body.add(arm);
      parts[sx < 0 ? 'armL' : 'armR'] = arm;
      parts[sx < 0 ? 'handL' : 'handR'] = hand;
    }
    // Legs: pivot at the hip.
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.33, 2.55, 0);
      leg.add(mesh(new THREE.CapsuleGeometry(0.27, 1.25, 4, 8), blue, 0, -0.85, 0));
      const boot = mesh(new THREE.CapsuleGeometry(0.28, 0.35, 4, 8), plainRed, 0, -1.95, 0.08);
      leg.add(boot);
      body.add(leg);
      parts[sx < 0 ? 'legL' : 'legR'] = leg;
    }
  }
  spidey.scale.setScalar(1.15);
  scene.add(spidey);

  // Round shadow under Spider-Man while he stands on a roof.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  scene.add(shadow);

  // The web: a thin white stick from his hand to the anchor high above.
  const web = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 6).translate(0, 0.5, 0), white);
  web.visible = false;
  scene.add(web);

  // ---------- Helpers ----------
  function player() { return game.player; }

  function stickHeld() {
    return Math.hypot(stick.x, stick.y) >= 0.3;
  }

  // Stick direction in the world. The camera looks down the course (-Z),
  // so stick up = forward along the course and stick right = +X.
  function stickWorldDir() {
    const len = Math.hypot(stick.x, stick.y);
    if (len < 0.001) return null;
    return { x: stick.x / len, z: -stick.y / len };
  }

  function loadedPlatforms() {
    const list = [L.BASE];
    for (const t of towers.values()) list.push(t.data);
    return list;
  }

  function clampToPlatform(p, platform, margin) {
    const h = platform.size / 2 - margin;
    p.x = Math.min(platform.x + h, Math.max(platform.x - h, p.x));
    p.z = Math.min(platform.z + h, Math.max(platform.z - h, p.z));
  }

  function save() {
    L.savePlayer(store, game.player);
  }

  // ---------- Jumping ----------
  function pressJump() {
    if (game.mode !== 'play' || game.panelOpen || game.action !== 'stand') return false; // no jumps in the air
    const from = game.platform;
    const dir = stickHeld() ? stickWorldDir() : null;
    const target = L.pickTarget(from, loadedPlatforms(), dir);
    if (target && L.canReach(from, target, player().jumpLevel)) startSwing(target);
    else startLeap(dir || FORWARD);
    game.hintOn = false;
    return true;
  }

  // Swing in a smooth arc to the target, hanging from a web anchored high above the middle.
  function startSwing(target) {
    const from = game.pos.clone();
    const to = new THREE.Vector3(target.x, target.y, target.z);
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const mid = from.clone().lerp(to, 0.5);
    game.move = {
      kind: 'swing',
      target,
      from,
      to,
      u: 0,
      duration: (0.55 + dist * 0.022) / L.speedFactor(player().speedLevel),
      dip: Math.min(7, Math.max(2, dist * 0.18)),
      anchor: new THREE.Vector3(mid.x, Math.max(from.y, to.y) + 24, mid.z),
    };
    game.action = 'swing';
    if (dist > 0.01) game.facing = Math.atan2(to.x - from.x, to.z - from.z);
  }

  // Too far: leap exactly the jump distance past the roof edge, then fall to the street.
  function startLeap(dir) {
    const p = game.platform;
    const h = p.size / 2;
    // Where the line from you along dir leaves the roof.
    let t = Infinity;
    if (dir.x > 0) t = Math.min(t, (p.x + h - game.pos.x) / dir.x);
    if (dir.x < 0) t = Math.min(t, (p.x - h - game.pos.x) / dir.x);
    if (dir.z > 0) t = Math.min(t, (p.z + h - game.pos.z) / dir.z);
    if (dir.z < 0) t = Math.min(t, (p.z - h - game.pos.z) / dir.z);
    if (!isFinite(t)) t = 0;
    const reach = t + L.jumpDistance(player().jumpLevel);
    const from = game.pos.clone();
    const to = new THREE.Vector3(from.x + dir.x * reach, from.y, from.z + dir.z * reach);
    game.move = {
      kind: 'leap',
      target: null,
      from,
      to,
      dir,
      u: 0,
      duration: (0.45 + reach * 0.02) / L.speedFactor(player().speedLevel),
    };
    game.action = 'leap';
    game.facing = Math.atan2(dir.x, dir.z);
  }

  function land(target) {
    game.platform = target;
    game.pos.set(target.x, target.y, target.z);
    game.action = 'stand';
    game.move = null;
    const result = L.landOn(game.run, player(), target);
    if (result.coins > 0) {
      const t = towers.get(target.index);
      if (t) t.coin.visible = false;
      popup('+' + result.coins);
      save();
    }
    if (result.newZone) {
      const z = L.ZONES[result.newZone - 1];
      showBanner('ZONE ' + z.number + ' - ' + z.name, z.coins + (z.coins === 1 ? ' coin' : ' coins') + ' per tower');
    }
  }

  function startFall() {
    game.action = 'fall';
    game.move = { kind: 'fall', t: 0, vx: game.move.dir.x * 6, vz: game.move.dir.z * 6, vy: 0, from: game.pos.clone() };
    showBanner('Oops!', '', 'oops');
  }

  // A run ends (fall or Base): back to the Base, all tower coins come back. Coins earned are kept.
  function endRun() {
    game.run = L.createRun();
    game.platform = L.BASE;
    game.pos.set(SPAWN.x, 0, SPAWN.z);
    game.facing = Math.PI;
    game.action = 'stand';
    game.move = null;
    game.padArmed = false; // spawn is not on the pad, this just avoids instant reopen
    updateTowers();
    refreshCoins();
    save();
    snapCamera();
  }

  // ---------- Simulation step ----------
  function update(dt) {
    game.time += dt;
    if (game.bannerTime > 0) {
      game.bannerTime -= dt;
      if (game.bannerTime <= 0) $('banner').classList.remove('show');
    }
    if (game.mode !== 'play') return;
    const speed = L.speedFactor(player().speedLevel);

    if (game.action === 'stand') {
      let sx = 0;
      let sy = 0;
      if (!game.panelOpen) {
        if (stick.pointer !== null) { sx = stick.x; sy = stick.y; }
        else {
          sx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
          sy = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
          const len = Math.hypot(sx, sy);
          if (len > 1) { sx /= len; sy /= len; }
          stick.x = sx;
          stick.y = sy;
        }
      }
      const mag = Math.hypot(sx, sy);
      if (mag > 0.15) {
        const dx = sx;
        const dz = -sy;
        game.pos.x += dx * WALK_SPEED * speed * dt;
        game.pos.z += dz * WALK_SPEED * speed * dt;
        clampToPlatform(game.pos, game.platform, 0.8); // walking never makes you fall
        game.facing = Math.atan2(dx, dz);
        game.walkPhase += dt * 9 * speed * Math.min(1, mag);
      } else {
        game.walkPhase = 0;
      }
      // Standing on the SHOP pad opens the Base panel (step off and back on to open it again).
      if (game.platform.kind === 'base') {
        const onPad = Math.abs(game.pos.x - PAD.x) < PAD.size / 2 && Math.abs(game.pos.z - PAD.z) < PAD.size / 2;
        if (onPad && game.padArmed && !game.panelOpen) openPanel();
        if (!onPad) game.padArmed = true;
      }
    } else if (game.action === 'swing') {
      const m = game.move;
      m.u = Math.min(1, m.u + dt / m.duration);
      const e = (1 - Math.cos(Math.PI * m.u)) / 2; // slow-fast-slow, like a pendulum
      game.pos.lerpVectors(m.from, m.to, e);
      game.pos.y -= m.dip * Math.sin(Math.PI * e);
      if (m.u >= 1) land(m.target);
    } else if (game.action === 'leap') {
      const m = game.move;
      m.u = Math.min(1, m.u + dt / m.duration);
      game.pos.lerpVectors(m.from, m.to, m.u);
      game.pos.y += 4 * Math.sin(Math.PI * m.u); // a small hop
      if (m.u >= 1) startFall();
    } else if (game.action === 'fall') {
      const m = game.move;
      m.t += dt;
      m.vy -= 60 * dt;
      game.pos.x += m.vx * dt;
      game.pos.z += m.vz * dt;
      game.pos.y = Math.max(L.STREET_Y + 1, game.pos.y + m.vy * dt);
      if (m.t >= FALL_TIME) endRun();
    }
    updateTowers();
  }

  // ---------- Drawing ----------
  const camLook = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function cameraGoal(outPos, outLook) {
    const portrait = camera.aspect < 0.8;
    // Look between Spider-Man and the next tower so the next tower stays in view.
    let next = null;
    if (game.move && game.move.target) next = game.move.target;
    else if (game.action === 'stand') next = L.pickTarget(game.platform, [], null);
    const ref = tmpV.copy(game.pos);
    if (game.action === 'fall') ref.copy(game.move.from); // let him drop away from the camera
    outLook.copy(ref);
    if (next) {
      outLook.x += (next.x - ref.x) * 0.3;
      outLook.z += (next.z - ref.z) * 0.3;
      outLook.y = ref.y + (next.y - ref.y) * 0.3;
    }
    outLook.y += 2.5;
    outLook.z -= 4;
    outPos.set(ref.x + 5, ref.y + (portrait ? 14 : 11), ref.z + (portrait ? 26 : 20));
  }

  function snapCamera() {
    cameraGoal(camera.position, camLook);
    camera.lookAt(camLook);
  }

  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  function updateCamera(dt) {
    cameraGoal(goalPos, goalLook);
    const k = 1 - Math.exp(-dt * 5);
    camera.position.lerp(goalPos, k);
    camLook.lerp(goalLook, k);
    camera.lookAt(camLook);
  }

  function poseSpidey() {
    spidey.position.copy(game.pos);
    spidey.rotation.y = game.facing;
    const a = game.action;
    const p = parts;
    body.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0);
    if (a === 'stand') {
      const s = Math.sin(game.walkPhase);
      p.legL.rotation.set(s * 0.7, 0, 0);
      p.legR.rotation.set(-s * 0.7, 0, 0);
      p.armL.rotation.set(-s * 0.6, 0, -0.18);
      p.armR.rotation.set(s * 0.6, 0, 0.18);
      body.position.y = Math.abs(Math.cos(game.walkPhase)) * 0.15 * (game.walkPhase ? 1 : 0);
    } else if (a === 'swing') {
      const u = game.move.u;
      p.armR.rotation.set(-Math.PI + 0.25, 0, 0.15); // right hand up on the web
      p.armL.rotation.set(-0.9, 0, -0.5);
      p.legL.rotation.set(0.5 + Math.sin(u * Math.PI) * 0.4, 0, 0);
      p.legR.rotation.set(0.9 + Math.sin(u * Math.PI) * 0.3, 0, 0);
      body.rotation.x = -0.35 + Math.sin(u * Math.PI) * 0.5;
    } else if (a === 'leap') {
      p.armL.rotation.set(-2.6, 0, -0.3);
      p.armR.rotation.set(-2.6, 0, 0.3);
      p.legL.rotation.set(0.6, 0, 0);
      p.legR.rotation.set(-0.3, 0, 0);
      body.rotation.x = 0.3;
    } else if (a === 'fall') {
      const w = Math.sin(game.time * 22);
      p.armL.rotation.set(-2.8 + w * 0.4, 0, -0.6);
      p.armR.rotation.set(-2.8 - w * 0.4, 0, 0.6);
      p.legL.rotation.set(w * 0.6, 0, 0);
      p.legR.rotation.set(-w * 0.6, 0, 0);
    }
    // Web line during the swing (let go just before landing).
    const m = game.move;
    if (a === 'swing' && m.u < 0.9) {
      spidey.updateMatrixWorld(true);
      const hand = parts.handR.getWorldPosition(tmpV);
      const dir = tmpV2.subVectors(m.anchor, hand);
      const len = dir.length();
      web.position.copy(hand);
      web.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      web.scale.set(1, len, 1);
      web.visible = true;
    } else {
      web.visible = false;
    }
    shadow.visible = a === 'stand';
    shadow.position.set(game.pos.x, game.pos.y + 0.05, game.pos.z);
  }

  function animate(t) {
    for (const tw of towers.values()) {
      tw.coin.rotation.y = t * 2.5 + tw.data.index;
      tw.coin.position.y = 3.2 + Math.sin(t * 2 + tw.data.index) * 0.3;
    }
    padGlow.material.opacity = 0.18 + 0.12 * Math.sin(t * 3);
    padGlow.scale.y = 1 + 0.15 * Math.sin(t * 3);
  }

  // ---------- HUD and panels ----------
  const hudCache = {};
  function setText(id, text) {
    if (hudCache[id] === text) return;
    hudCache[id] = text;
    $(id).textContent = text;
  }

  function currentZoneLabel() {
    const p = game.move && game.move.target ? game.move.target : game.platform;
    if (p.kind !== 'tower') return 'HOME BASE';
    return 'ZONE ' + p.zone.number + ' · ' + p.zone.name;
  }

  function updateHud() {
    const p = player();
    setText('coins', String(p.coins));
    setText('stats', 'JUMP ' + L.jumpDistance(p.jumpLevel) + ' ft · SPEED ' + p.speedLevel);
    setText('zoneName', currentZoneLabel());
    const hint = game.mode === 'play' && !game.panelOpen && game.hintOn && game.platform.kind === 'base' && game.action === 'stand';
    $('hint').classList.toggle('hidden', !hint);
  }

  function showBanner(title, sub, kind) {
    const b = $('banner');
    b.className = 'outline show' + (kind ? ' ' + kind : '');
    b.textContent = title;
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      b.appendChild(s);
    }
    game.banner = title + (sub ? ' - ' + sub : '');
    game.banners.push(game.banner);
    game.bannerTime = kind === 'oops' ? FALL_TIME : BANNER_TIME;
  }

  // "+N" rises from Spider-Man's head.
  function popup(text) {
    game.lastPopup = text;
    const v = tmpV.copy(game.pos);
    v.y += 7;
    v.project(camera);
    const el = document.createElement('div');
    el.className = 'popup outline';
    el.innerHTML = '<span class="coin"></span>';
    el.appendChild(document.createTextNode(text));
    el.style.left = Math.round((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    el.style.top = Math.round((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // Price shown on a shop button: FREE for Aariz, else the coins.
  function setBuyButton(btn, label, price) {
    const p = player();
    const free = L.isFreeName(p.name);
    btn.querySelector('b').textContent = label;
    const span = btn.querySelector('span');
    if (price === null) {
      span.textContent = '';
      btn.disabled = true;
      btn.classList.remove('free');
      btn.dataset.price = 'MAX';
      return;
    }
    if (free) {
      span.textContent = 'FREE';
      btn.dataset.price = 'FREE';
    } else {
      span.innerHTML = '<span class="coin"></span>';
      span.appendChild(document.createTextNode(String(price)));
      btn.dataset.price = String(price);
    }
    btn.classList.toggle('free', free);
    btn.disabled = !free && p.coins < price;
  }

  function renderPanel() {
    const p = player();
    $('pName').textContent = p.name;
    $('pCoins').textContent = String(p.coins);
    $('pJump').textContent = L.jumpDistance(p.jumpLevel) + ' ft';
    $('pSpeed').textContent = String(p.speedLevel);
    $('pBest').textContent = p.bestZone ? p.bestZone + ' ' + L.ZONES[p.bestZone - 1].name : '-';
    const price = L.jumpPrice(p.jumpLevel);
    setBuyButton($('buyJump'), price === null ? 'MAX' : '+5 ft', price);
    $('jumpNote').textContent = price === null
      ? 'Your jump is 30 ft. Every zone is open!'
      : 'Jump further: ' + L.jumpDistance(p.jumpLevel) + ' ft to ' + L.jumpDistance(p.jumpLevel + 1) + ' ft';
    L.SPEED_PACKS.forEach((pack, i) => setBuyButton($('buySpeed' + i), '+' + pack.levels, pack.price));
    updateHud();
  }

  function openPanel() {
    game.panelOpen = true;
    game.padArmed = false;
    renderPanel();
    $('panel').classList.remove('hidden');
  }

  function closePanel() {
    game.panelOpen = false;
    $('panel').classList.add('hidden');
  }

  // The Base button works anywhere: ends the run and opens the Base panel.
  function goBase() {
    if (game.mode !== 'play') return;
    endRun();
    openPanel();
  }

  function buyJump() {
    const r = L.buyJump(player());
    if (r.ok) save();
    renderPanel();
    return r;
  }

  function buySpeed(i) {
    const r = L.buySpeed(player(), i);
    if (r.ok) save();
    renderPanel();
    return r;
  }

  // ---------- Name screen ----------
  function showNameScreen() {
    game.mode = 'name';
    closePanel();
    $('nameScreen').classList.remove('hidden');
    $('nameInput').value = L.loadLastName(store);
    $('nameHint').textContent = '';
    if (!AUTOTEST && !SHOT) setTimeout(() => $('nameInput').focus(), 50);
  }

  // Start playing as `name` (loads that name's save). Returns false if the name is not 1-16 characters.
  function startAs(name) {
    const n = L.cleanName(name);
    if (!n) {
      $('nameHint').textContent = 'Type a name (1 to 16 letters)';
      return false;
    }
    game.player = L.loadPlayer(store, n);
    L.saveLastName(store, n);
    $('nameScreen').classList.add('hidden');
    $('nameInput').blur();
    game.mode = 'play';
    game.hintOn = true;
    closePanel();
    endRun();
    return true;
  }

  // ---------- Input ----------
  const stickEl = $('stick');
  const knob = $('knob');
  const STICK_RANGE = 52; // px the knob can move

  function setStickFromPointer(e) {
    const r = stickEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RANGE) { dx *= STICK_RANGE / len; dy *= STICK_RANGE / len; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    stick.x = dx / STICK_RANGE;
    stick.y = -dy / STICK_RANGE;
  }

  function releaseStick() {
    stick.pointer = null;
    stick.x = 0;
    stick.y = 0;
    knob.style.transform = '';
  }

  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (stick.pointer !== null) return;
    stick.pointer = e.pointerId;
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    setStickFromPointer(e);
  });
  stickEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.pointer) setStickFromPointer(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stickEl.addEventListener(type, (e) => {
      if (e.pointerId === stick.pointer) releaseStick();
    });
  }

  const jumpBtn = $('jumpBtn');
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { jumpBtn.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    jumpBtn.classList.add('down');
    pressJump();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    jumpBtn.addEventListener(type, () => jumpBtn.classList.remove('down'));
  }

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (game.mode === 'name') {
      if (e.key === 'Enter') { e.preventDefault(); startAs($('nameInput').value); }
      return;
    }
    if (game.panelOpen) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closePanel(); }
      if (e.code === 'Space') e.preventDefault(); // no surprise shopping with Space
      return;
    }
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) pressJump();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
  });
  window.addEventListener('blur', () => { keys.clear(); releaseStick(); });

  // No long-press menu, no text selection, no pinch zoom.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => { if (e.target !== $('nameInput')) e.preventDefault(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest || !e.target.closest('.card')) e.preventDefault();
  }, { passive: false });

  function tap(id, fn) {
    $(id).addEventListener('click', (e) => {
      fn();
      e.currentTarget.blur();
    });
  }
  tap('baseBtn', goBase);
  tap('playBtn', () => startAs($('nameInput').value));
  tap('buyJump', buyJump);
  L.SPEED_PACKS.forEach((pack, i) => tap('buySpeed' + i, () => buySpeed(i)));
  tap('changeName', showNameScreen);
  tap('closePanel', closePanel);

  // ---------- Size and main loop ----------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 72 : camera.aspect < 1.3 ? 62 : 55; // wider view on tall screens
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = 0;
  let acc = 0;
  function frame(ms) {
    const t = ms / 1000;
    const dt = last ? Math.min(0.1, t - last) : 0;
    last = t;
    if (!AUTOTEST && !game.frozen) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    }
    render(dt, t);
    requestAnimationFrame(frame);
  }

  function render(dt, t) {
    poseSpidey();
    updateCity();
    animate(t);
    updateCamera(dt);
    updateHud();
    renderer.render(scene, camera);
  }

  // ---------- Start ----------
  updateTowers();
  snapCamera();
  showNameScreen();
  requestAnimationFrame(frame);

  function countSceneObjects() {
    let n = 0;
    scene.traverse(() => { n++; });
    return n;
  }

  // ---------- Screenshot setups (?shot=name|play|swing|base) ----------
  if (SHOT && SHOT !== 'name') {
    startAs('Peter');
    if (SHOT === 'play' || SHOT === 'swing') {
      game.player.coins = 7;
      for (let i = 0; i <= 2; i++) land(L.tower(i)); // three coins collected this run
      game.player.coins = 7;
      $('banner').classList.remove('show');
      game.bannerTime = 0;
      $('popups').innerHTML = '';
      game.hintOn = false;
      if (SHOT === 'swing') {
        pressJump();
        for (let i = 0; i < 30; i++) update(STEP);
        while (game.move && game.move.u < 0.4) update(STEP);
      }
    } else if (SHOT === 'base') {
      Object.assign(game.player, { coins: 250, jumpLevel: 1, speedLevel: 6, bestZone: 2 });
      openPanel();
    }
    game.frozen = true;
    poseSpidey();
    snapCamera();
  }

  // ---------- Autotest hook (?autotest) ----------
  if (AUTOTEST) {
    const buttonInfo = (id) => ({ price: $(id).dataset.price, disabled: $(id).disabled, text: $(id).textContent.trim() });
    window.__spidey = {
      getState() {
        const idx = [...towers.keys()];
        let coinsShown = 0;
        for (const tw of towers.values()) if (tw.coin.visible) coinsShown++;
        return {
          mode: game.mode,
          panelOpen: game.panelOpen,
          name: player().name,
          coins: player().coins,
          jumpLevel: player().jumpLevel,
          jumpFt: L.jumpDistance(player().jumpLevel),
          speedLevel: player().speedLevel,
          bestZone: player().bestZone,
          platform: { kind: game.platform.kind, index: game.platform.index },
          action: game.action,
          pos: { x: game.pos.x, y: game.pos.y, z: game.pos.z },
          paidCount: game.run.paid.size,
          coinsShown,
          towersLoaded: idx.length,
          towerMin: Math.min(...idx),
          towerMax: Math.max(...idx),
          sceneObjects: countSceneObjects(),
          banner: game.banner,
          banners: game.banners.slice(),
          lastPopup: game.lastPopup,
          webVisible: web.visible,
          hud: { coins: $('coins').textContent, zone: $('zoneName').textContent, stats: $('stats').textContent },
          shop: { jump: buttonInfo('buyJump'), speed: [0, 1, 2].map((i) => buttonInfo('buySpeed' + i)) },
        };
      },
      setName: (n) => startAs(n),
      setStick(x, y) { stick.x = x; stick.y = y; stick.pointer = x || y ? 'test' : null; },
      pressJump,
      step(seconds) {
        const n = Math.round(seconds / STEP);
        for (let i = 0; i < n; i++) update(STEP);
        poseSpidey();
        updateHud();
      },
      teleportTo(i) {
        const target = i < 0 ? L.BASE : L.tower(i);
        game.platform = target;
        game.pos.set(target.x, target.y, target.z);
        game.action = 'stand';
        game.move = null;
        updateTowers();
      },
      setCoins(n) { player().coins = n; save(); renderPanel(); },
      setLevels(jumpLevel, speedLevel) { Object.assign(player(), { jumpLevel, speedLevel }); save(); renderPanel(); },
      buyJump,
      buySpeed,
      clickBuy(id) { $(id).click(); return player().coins; },
      goBase,
      openPanel,
      closePanel,
      reloadFromSave() { game.player = L.loadPlayer(store, player().name); renderPanel(); },
      render() { render(0, game.time); },
    };
    const s = document.createElement('script');
    s.src = 'playtest.js';
    document.body.appendChild(s);
  }
})();
