import * as THREE from 'three';

// ============================================================
//  TPP — Container Warfare  (polished mobile FPS feel)
//  Left joystick = move (auto-sprint near max).  Drag screen = look.
//  FIRE / JUMP / SLIDE / GLOO WALL.  Hipfire only.
// ============================================================

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
scene.fog = new THREE.Fog(0x9fb4c4, 45, 140);

const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 500);

const TMP = new THREE.Vector3();   // scratch vector (avoid per-frame allocs)

// ------------------------------------------------------------
//  Lighting
// ------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 150 });
scene.add(sun);

// ------------------------------------------------------------
//  Ground + hazard lanes
// ------------------------------------------------------------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x9b8e72, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function addLane(x, z, w, d) {
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0xe8c93a, roughness: 1 })
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(x, 0.02, z);
  scene.add(lane);
}
addLane(0, 0, 3, 60);
addLane(0, 0, 60, 3);

// ------------------------------------------------------------
//  Shipping containers (map)
// ------------------------------------------------------------
const colliders = [];                 // {x,z,hx,hz,top, gloo?}
const CONTAINER_COLORS = [0x2f6fb0, 0xc24a2f, 0x3a8f5a, 0xc7a23a, 0x8a8f96];

function makeContainerTexture(base) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(base);
  ctx.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`;
  ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 128; i += 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(i, 0, 3, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(i + 3, 0, 2, 64);
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(40,25,10,${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 64, Math.random() * 10, Math.random() * 20);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addContainer(x, y, z, ry, color) {
  const W = 6, H = 2.6, D = 2.5;
  const tex = makeContainerTexture(color);
  const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.15 });
  const endMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.2 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
    [endMat, endMat, sideMat, sideMat, sideMat, sideMat]);
  box.position.set(x, y + H / 2, z);
  box.rotation.y = ry;
  box.castShadow = true; box.receiveShadow = true;
  scene.add(box);
  const hx = Math.abs(Math.cos(ry)) * W / 2 + Math.abs(Math.sin(ry)) * D / 2;
  const hz = Math.abs(Math.sin(ry)) * W / 2 + Math.abs(Math.cos(ry)) * D / 2;
  colliders.push({ x, z, hx, hz, top: y + H });
}

function buildMap() {
  let ci = 0;
  const pick = () => CONTAINER_COLORS[(ci++) % CONTAINER_COLORS.length];
  for (const z of [-22, -14, 14, 22]) {
    for (let x = -24; x <= 24; x += 9) {
      if (Math.random() < 0.15) continue;
      addContainer(x, 0, z, 0, pick());
      if (Math.random() < 0.45) addContainer(x, 2.6, z, 0, pick());
    }
  }
  addContainer(-8, 0, -4, Math.PI / 2, pick());
  addContainer(8, 0, 4, Math.PI / 2, pick());
  addContainer(-6, 0, 7, 0, pick());
  addContainer(7, 0, -7, 0, pick());
  addContainer(0, 0, -9, Math.PI / 2, pick());
  addContainer(-18, 0, 0, Math.PI / 2, pick());
  addContainer(-18, 2.6, 0, Math.PI / 2, pick());
  addContainer(18, 0, 0, Math.PI / 2, pick());
  addContainer(18, 2.6, 0, Math.PI / 2, pick());
  for (let x = -27; x <= 27; x += 6) {
    addContainer(x, 0, -30, 0, 0x6a6f76);
    addContainer(x, 0, 30, 0, 0x6a6f76);
  }
  for (let z = -27; z <= 27; z += 2.5) {
    addContainer(-30, 0, z, Math.PI / 2, 0x6a6f76);
    addContainer(30, 0, z, Math.PI / 2, 0x6a6f76);
  }
}
buildMap();

// ------------------------------------------------------------
//  Animated avatar rig (shared by the player and bots)
// ------------------------------------------------------------
function buildAvatar(opt = {}) {
  const cloth = opt.cloth ?? 0x3c4a2e, skin = opt.skin ?? 0x8d5a3b, pack = opt.pack ?? 0x6b4a2a;
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 }));
  torso.position.y = 1.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
  head.position.y = 1.78;
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), new THREE.MeshStandardMaterial({ color: pack, roughness: 1 }));
  backpack.position.set(0, 1.25, -0.26);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 1 });
  const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.14, 0.9, 0); legL.geometry.translate(0, -0.35, 0);
  const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.14, 0.9, 0); legR.geometry.translate(0, -0.35, 0);
  const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.18); armGeo.translate(0, -0.25, 0);
  const armMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 });
  const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-0.37, 1.5, 0);
  const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(0.37, 1.5, 0.05);
  [torso, head, backpack, legL, legR, armL, armR].forEach((m) => { m.castShadow = true; g.add(m); });
  const handAnchor = new THREE.Group();
  handAnchor.position.set(0.34, 1.2, 0.32);
  g.add(handAnchor);
  return { group: g, parts: { torso, head, legL, legR, armL, armR, handAnchor }, phase: 0 };
}

function lerpRot(obj, axis, target, dt, rate = 10) {
  obj.rotation[axis] += (target - obj.rotation[axis]) * Math.min(1, dt * rate);
}

// state: 'idle' | 'walk' | 'sprint' | 'jump' | 'slide'
function poseAvatar(a, state, dt) {
  const P = a.parts;
  if (state === 'walk' || state === 'sprint') {
    const spd = state === 'sprint' ? 15 : 10.5;
    const amp = state === 'sprint' ? 0.85 : 0.5;
    a.phase += dt * spd;
    const s = Math.sin(a.phase) * amp;
    P.legL.rotation.x = s; P.legR.rotation.x = -s;
    P.armL.rotation.x = -s * 0.9;
    lerpRot(P.armR, 'x', -0.25, dt, 8);                 // right arm braces the gun
    lerpRot(P.torso, 'x', state === 'sprint' ? -0.28 : -0.08, dt, 8);
    lerpRot(P.head, 'x', 0, dt);
  } else if (state === 'jump') {
    lerpRot(P.legL, 'x', -0.55, dt, 12); lerpRot(P.legR, 'x', -0.3, dt, 12);
    lerpRot(P.armL, 'x', -0.4, dt, 12);
    lerpRot(P.torso, 'x', -0.12, dt, 10); lerpRot(P.head, 'x', 0, dt);
  } else if (state === 'slide') {
    lerpRot(P.torso, 'x', -0.7, dt, 12); lerpRot(P.head, 'x', 0.35, dt, 12);
    lerpRot(P.legL, 'x', 0.55, dt, 12); lerpRot(P.legR, 'x', 0.1, dt, 12);
    lerpRot(P.armL, 'x', -0.3, dt, 10);
  } else { // idle — gentle breathing
    a.phase += dt * 2;
    lerpRot(P.legL, 'x', 0, dt, 8); lerpRot(P.legR, 'x', 0, dt, 8);
    lerpRot(P.armL, 'x', 0, dt, 8); lerpRot(P.armR, 'x', -0.1, dt, 8);
    P.torso.rotation.x += (Math.sin(a.phase) * 0.025 - P.torso.rotation.x) * Math.min(1, dt * 4);
    lerpRot(P.head, 'x', 0, dt);
  }
}

// ------------------------------------------------------------
//  Player
// ------------------------------------------------------------
const avatar = buildAvatar();
const player = avatar.group;
const handAnchor = avatar.parts.handAnchor;
player.scale.setScalar(1.15);
player.position.set(0, 0, 18);
scene.add(player);
const EYE = 1.75;                     // pivot height (scaled-ish)

// ------------------------------------------------------------
//  Weapon meshes
// ------------------------------------------------------------
const matMetal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.6 });
const matMatte = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

function buildKatana() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.04, 0.04, 1.0), matMetal(0xd7dbe0), 0, 0, 0.55));
  g.add(part(new THREE.BoxGeometry(0.12, 0.04, 0.04), matMatte(0x222222), 0, 0, 0.05));
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.22), matMatte(0x111111), 0, 0, -0.08));
  g.userData.muzzle = 0;
  return g;
}
function buildAK47() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.08, 0.14, 0.7), matMatte(0x3a2a18), 0, 0, 0.2));
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.5), matMetal(0x2b2b2b), 0, 0.05, 0.55));
  g.add(part(new THREE.BoxGeometry(0.07, 0.22, 0.12), matMatte(0x222018), 0, -0.16, 0.12));
  g.add(part(new THREE.BoxGeometry(0.06, 0.16, 0.1), matMatte(0x3a2a18), 0, -0.12, -0.18));
  g.userData.muzzle = 0.82;
  return g;
}
function buildAK117() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.08, 0.12, 0.66), matMatte(0x2d3138), 0, 0, 0.2));
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.46), matMetal(0x4a4f57), 0, 0.04, 0.52));
  g.add(part(new THREE.BoxGeometry(0.07, 0.2, 0.1), matMatte(0x1d2025), 0, -0.15, 0.1));
  g.add(part(new THREE.BoxGeometry(0.06, 0.15, 0.1), matMatte(0x2d3138), 0, -0.11, -0.16));
  g.userData.muzzle = 0.76;
  return g;
}
function buildFennec() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.07, 0.11, 0.42), matMatte(0x222222), 0, 0, 0.12));
  g.add(part(new THREE.BoxGeometry(0.04, 0.04, 0.22), matMetal(0x3a3a3a), 0, 0.03, 0.34));
  g.add(part(new THREE.BoxGeometry(0.06, 0.24, 0.08), matMatte(0x161616), 0, -0.16, 0.05));
  g.add(part(new THREE.BoxGeometry(0.05, 0.14, 0.09), matMatte(0x222222), 0, -0.1, -0.14));
  g.userData.muzzle = 0.46;
  return g;
}

const WEAPONS = {
  katana: { name: 'Katana', label: '🗡 Katana', type: 'melee', build: buildKatana },
  ak47:   { name: 'AK47',   label: '🔫 AK47',   type: 'gun', build: buildAK47,   rate: 0.105, recoil: 0.022, spread: 0.012 },
  ak117:  { name: 'AK117',  label: '🔫 AK117',  type: 'gun', build: buildAK117,  rate: 0.080, recoil: 0.015, spread: 0.010 },
  fennec: { name: 'Fennec', label: '🔫 Fennec', type: 'gun', build: buildFennec, rate: 0.052, recoil: 0.011, spread: 0.020 },
};

// ------------------------------------------------------------
//  Loadout + weapon switching (holster animation)
// ------------------------------------------------------------
const slots = [null, null];
let heldKey = 'katana', heldMesh = null, switchT = 1, pendingKey = null;
let muzzleZ = 0;

function spawnHeld(key) {
  if (heldMesh) handAnchor.remove(heldMesh);
  heldMesh = WEAPONS[key].build();
  handAnchor.add(heldMesh);
  heldKey = key;
  muzzleZ = heldMesh.userData.muzzle || 0;
  updateLoadoutUI();
}
function equip(key) { if (key === heldKey && switchT >= 1) return; pendingKey = key; switchT = 0; }
function tapSlot(i) { const gun = slots[i]; if (!gun) return; equip(heldKey === gun ? 'katana' : gun); }
function giveWeapon(key) {
  let idx = slots.indexOf(null), dropped = null;
  if (idx === -1) { idx = slots.indexOf(heldKey); if (idx === -1) idx = 0; dropped = slots[idx]; }
  slots[idx] = key; equip(key); updateLoadoutUI();
  return dropped;
}

// ------------------------------------------------------------
//  Floor guns (pickups)
// ------------------------------------------------------------
const floorGuns = [];
function dropGun(key, x, z) {
  const g = WEAPONS[key].build();
  g.scale.setScalar(1.1); g.position.set(x, 0.5, z); g.rotation.z = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z);
  scene.add(g); scene.add(ring);
  floorGuns.push({ key, mesh: g, ring, x, z });
}
dropGun('ak47', 4, 10);
dropGun('ak117', -10, 2);
dropGun('fennec', 9, -6);

// ------------------------------------------------------------
//  Bot ("other player") — shows idle/walk/sprint/jump/slide
// ------------------------------------------------------------
const bots = [];
function spawnBot(x, z) {
  const a = buildAvatar({ cloth: 0x5a2f2f, skin: 0x9a6b4b, pack: 0x333 });
  a.group.scale.setScalar(1.15);
  a.group.position.set(x, 0, z);
  const gun = buildAK47(); a.parts.handAnchor.add(gun);
  scene.add(a.group);
  const bot = {
    av: a, pos: a.group.position, vy: 0, onGround: true,
    state: 'idle', stateT: 0, dir: Math.random() * Math.PI * 2, hp: 100, hitFlash: 0,
  };
  bots.push(bot);
  return bot;
}
spawnBot(-4, -6);
spawnBot(12, 8);

function updateBot(b, dt) {
  b.stateT -= dt;
  if (b.stateT <= 0 && b.onGround) {
    // pick a new behaviour
    const r = Math.random();
    if (r < 0.30) { b.state = 'idle'; b.stateT = 0.8 + Math.random(); }
    else if (r < 0.65) { b.state = 'walk'; b.stateT = 1.2 + Math.random() * 1.5; b.dir = Math.random() * Math.PI * 2; }
    else if (r < 0.85) { b.state = 'sprint'; b.stateT = 1.0 + Math.random(); b.dir = Math.random() * Math.PI * 2; }
    else if (r < 0.93) { b.state = 'jump'; b.vy = 6.5; b.onGround = false; b.stateT = 0.6; }
    else { b.state = 'slide'; b.stateT = 1.0; }
  }
  let speed = 0;
  if (b.state === 'walk') speed = 2.6;
  else if (b.state === 'sprint') speed = 6.0;
  else if (b.state === 'slide') speed = 7.5 * Math.max(0, b.stateT);   // decays
  if (speed > 0) {
    b.pos.x += Math.sin(b.dir) * speed * dt;
    b.pos.z += Math.cos(b.dir) * speed * dt;
    b.av.group.rotation.y += (b.dir - b.av.group.rotation.y) * Math.min(1, dt * 8);
  }
  // gravity
  b.vy -= 20 * dt; b.pos.y += b.vy * dt;
  const fl = groundHeightAt(b.pos.x, b.pos.z);
  if (b.pos.y <= fl) { b.pos.y = fl; b.vy = 0; if (!b.onGround && b.state === 'jump') { b.onGround = true; b.state = 'idle'; b.stateT = 0; } b.onGround = true; }
  else b.onGround = false;
  resolveCollisions(b.pos);
  b.pos.x = Math.max(-29, Math.min(29, b.pos.x));
  b.pos.z = Math.max(-29, Math.min(29, b.pos.z));
  poseAvatar(b.av, b.onGround ? b.state : 'jump', dt);
  // hit flash recovery
  if (b.hitFlash > 0) { b.hitFlash -= dt; b.av.parts.torso.material.emissive?.setScalar(Math.max(0, b.hitFlash)); }
}

// ------------------------------------------------------------
//  Camera / look state
// ------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.02, dist: 4.6 };     // pitch ~level
const LOOK_X = 0.0115, LOOK_Y = 0.0095;                   // high sensitivity
let recoilPitch = 0, recoilYaw = 0;
let fovTarget = 64;

function applyLook(dx, dy) {
  cam.yaw -= dx * LOOK_X;
  cam.pitch -= dy * LOOK_Y;     // drag up -> look up
  cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch));
}

// ------------------------------------------------------------
//  Movement joystick
// ------------------------------------------------------------
function createJoystick(zoneId, knobId) {
  const zone = document.getElementById(zoneId);
  const knob = document.getElementById(knobId);
  const state = { x: 0, y: 0, mag: 0, id: null };
  const radius = 46;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const reset = () => { state.x = state.y = state.mag = 0; state.id = null; zone.classList.remove('active'); setKnob(0, 0); };
  const move = (cx, cy) => {
    const r = zone.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    setKnob(dx, dy);
    state.x = dx / radius; state.y = dy / radius; state.mag = Math.min(1, len / radius);
  };
  const start = (id, cx, cy) => { state.id = id; zone.classList.add('active'); move(cx, cy); };
  zone.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; start(t.identifier, t.clientX, t.clientY); }, { passive: false });
  zone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === state.id) move(t.clientX, t.clientY); }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === state.id) reset(); };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  zone.addEventListener('mousedown', (e) => start('mouse', e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => { if (state.id === 'mouse') move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (state.id === 'mouse') reset(); });
  return state;
}
const moveStick = createJoystick('move-zone', 'move-knob');

// ------------------------------------------------------------
//  Look: drag anywhere on the canvas
// ------------------------------------------------------------
let lookId = null, lastLX = 0, lastLY = 0;
window.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches)
    if (t.target === canvas && lookId === null) { lookId = t.identifier; lastLX = t.clientX; lastLY = t.clientY; }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches)
    if (t.identifier === lookId) { applyLook(t.clientX - lastLX, t.clientY - lastLY); lastLX = t.clientX; lastLY = t.clientY; }
}, { passive: true });
const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
window.addEventListener('touchend', endLook); window.addEventListener('touchcancel', endLook);
let mouseLook = false;
canvas.addEventListener('mousedown', (e) => { mouseLook = true; lastLX = e.clientX; lastLY = e.clientY; });
window.addEventListener('mousemove', (e) => { if (mouseLook) { applyLook(e.clientX - lastLX, e.clientY - lastLY); lastLX = e.clientX; lastLY = e.clientY; } });
window.addEventListener('mouseup', () => { mouseLook = false; });

// ------------------------------------------------------------
//  Movement + actions state
// ------------------------------------------------------------
const vel = new THREE.Vector3();         // horizontal velocity
let verticalVel = 0, onGround = true;
let sliding = false, slideTime = 0;
let firing = false;
const WALK = 4.6, SPRINT = 8.8;

function jump() {
  if (!onGround) return;
  verticalVel = 7.4;
  onGround = false;
  if (sliding) { sliding = false; vel.multiplyScalar(1.12); }   // slide-jump keeps & boosts momentum
}
function startSlide() {
  if (!onGround || sliding) return;
  sliding = true; slideTime = 0;
  // launch forward along current facing; momentum will bleed off naturally
  const f = player.rotation.y;
  vel.set(Math.sin(f), 0, Math.cos(f)).multiplyScalar(11.5);
}

const bind = (id, fn) => {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
  el.addEventListener('click', fn);
};
bind('btn-jump', jump);
bind('btn-slide', startSlide);
document.getElementById('slot-0').addEventListener('click', () => tapSlot(0));
document.getElementById('slot-1').addEventListener('click', () => tapSlot(1));

// FIRE button — hold to auto-fire (low input delay via pointer/touch down)
const shootBtn = document.getElementById('btn-shoot');
const setFiring = (v) => { firing = v; };
shootBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setFiring(true); }, { passive: false });
shootBtn.addEventListener('touchend', (e) => { e.preventDefault(); setFiring(false); }, { passive: false });
shootBtn.addEventListener('mousedown', () => setFiring(true));
window.addEventListener('mouseup', () => setFiring(false));

// Pickup
let nearGun = null;
const pickupBtn = document.getElementById('pickup-prompt');
function doPickup() {
  if (!nearGun) return;
  const dropped = giveWeapon(nearGun.key);
  scene.remove(nearGun.mesh); scene.remove(nearGun.ring);
  const i = floorGuns.indexOf(nearGun); if (i >= 0) floorGuns.splice(i, 1);
  nearGun = null;
  if (dropped) dropGun(dropped, player.position.x + 1, player.position.z);
  pickupBtn.classList.add('hidden');
}
pickupBtn.addEventListener('click', doPickup);
pickupBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doPickup(); }, { passive: false });

// ------------------------------------------------------------
//  Gloo Wall ability
// ------------------------------------------------------------
const glooWalls = [];
let glooReady = true;
const glooBtn = document.getElementById('btn-shield');
function deployGloo() {
  if (!glooReady) return;
  glooReady = false; glooBtn.classList.add('cooldown');
  setTimeout(() => { glooReady = true; glooBtn.classList.remove('cooldown'); }, 6000);
  // place ~2.4 units in front of where the camera looks (horizontal)
  const f = cam.yaw;
  const fx = -Math.sin(f), fz = -Math.cos(f);
  const wx = player.position.x + fx * 2.4;
  const wz = player.position.z + fz * 2.4;
  const W = 3.2, H = 2.6, D = 0.5;
  const mat = new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.85, emissive: 0x2080a0, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat);
  mesh.position.set(wx, H / 2, wz);
  mesh.rotation.y = f;
  mesh.castShadow = true;
  scene.add(mesh);
  const hx = Math.abs(Math.cos(f)) * W / 2 + Math.abs(Math.sin(f)) * D / 2;
  const hz = Math.abs(Math.sin(f)) * W / 2 + Math.abs(Math.cos(f)) * D / 2;
  const col = { x: wx, z: wz, hx, hz, top: H, gloo: true };
  colliders.push(col);
  const wall = { mesh, col, life: 9, t: 0 };
  glooWalls.push(wall);
}
bind('btn-shield', deployGloo);

// ------------------------------------------------------------
//  Loadout UI
// ------------------------------------------------------------
function updateLoadoutUI() {
  for (let i = 0; i < 2; i++) {
    const el = document.getElementById('slot-' + i);
    const key = slots[i];
    el.querySelector('.wname').textContent = key ? WEAPONS[key].label : '— empty —';
    el.classList.toggle('empty', !key);
    el.classList.toggle('active', !!key && heldKey === key);
  }
  document.getElementById('melee-ind').classList.toggle('active', heldKey === 'katana');
  document.getElementById('crosshair').classList.toggle('show', WEAPONS[heldKey].type === 'gun');
}

// ------------------------------------------------------------
//  Collisions
// ------------------------------------------------------------
const PLAYER_R = 0.45;
function resolveCollisions(pos) {
  for (const c of colliders) {
    if (pos.y > c.top - 0.1) continue;
    const minX = c.x - c.hx - PLAYER_R, maxX = c.x + c.hx + PLAYER_R;
    const minZ = c.z - c.hz - PLAYER_R, maxZ = c.z + c.hz + PLAYER_R;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const pl = pos.x - minX, pr = maxX - pos.x, pf = pos.z - minZ, pb = maxZ - pos.z;
      const m = Math.min(pl, pr, pf, pb);
      if (m === pl) pos.x = minX; else if (m === pr) pos.x = maxX;
      else if (m === pf) pos.z = minZ; else pos.z = maxZ;
    }
  }
}
function groundHeightAt(x, z) {
  let h = 0;
  for (const c of colliders)
    if (x > c.x - c.hx && x < c.x + c.hx && z > c.z - c.hz && z < c.z + c.hz && c.top > h) h = c.top;
  return h;
}

// ------------------------------------------------------------
//  Combat effects (pooled): muzzle flash, tracers, shells, sparks
// ------------------------------------------------------------
const tracerGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
tracerGeo.rotateX(Math.PI / 2);     // align to +Z
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const tracers = [];

const flashGeo = new THREE.SphereGeometry(0.18, 6, 6);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
muzzleFlash.visible = false; muzzleFlash.scale.set(1, 1, 1.8);
scene.add(muzzleFlash);
let flashTime = 0;

const shellGeo = new THREE.BoxGeometry(0.05, 0.05, 0.11);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.8, roughness: 0.3 });
const shells = [];

const sparkGeo = new THREE.SphereGeometry(0.05, 4, 4);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const sparks = [];

function spawnTracer(from, to) {
  let t = tracers.find((x) => !x.mesh.visible);
  if (!t) { t = { mesh: new THREE.Mesh(tracerGeo, tracerMat.clone()) }; scene.add(t.mesh); tracers.push(t); }
  t.mesh.visible = true;
  t.from = from.clone(); t.to = to.clone();
  t.len = t.from.distanceTo(t.to);
  t.head = 0; t.speed = 180;            // m/s
  return t;
}
function spawnImpact(p, n) {
  for (let i = 0; i < 5; i++) {
    let s = sparks.find((x) => !x.mesh.visible);
    if (!s) { s = { mesh: new THREE.Mesh(sparkGeo, sparkMat.clone()), vel: new THREE.Vector3() }; scene.add(s.mesh); sparks.push(s); }
    s.mesh.visible = true; s.mesh.position.copy(p);
    s.mesh.material.opacity = 1;
    s.vel.set((Math.random() - 0.5) * 4 + n.x * 2, Math.random() * 3 + 1, (Math.random() - 0.5) * 4 + n.z * 2);
    s.life = 0.35;
  }
}
function ejectShell(origin, right) {
  let s = shells.find((x) => !x.mesh.visible);
  if (!s) { s = { mesh: new THREE.Mesh(shellGeo, shellMat), vel: new THREE.Vector3(), spin: new THREE.Vector3() }; scene.add(s.mesh); shells.push(s); }
  s.mesh.visible = true; s.mesh.position.copy(origin);
  s.vel.set(right.x * 2 + (Math.random() - 0.5), 2.5 + Math.random(), right.z * 2 + (Math.random() - 0.5));
  s.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
  s.life = 1.1;
}

// Ray vs world (containers/gloo + ground + bots). Returns {point, normal, bot}
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
function rayHit(origin, dir, maxDist = 200) {
  let best = maxDist, point = null, normal = new THREE.Vector3(0, 1, 0), bot = null;
  // ground (y=0)
  if (dir.y < -0.0001) {
    const t = -origin.y / dir.y;
    if (t > 0 && t < best) { best = t; point = origin.clone().addScaledVector(dir, t); normal.set(0, 1, 0); bot = null; }
  }
  // AABB containers / gloo
  for (const c of colliders) {
    const minX = c.x - c.hx, maxX = c.x + c.hx, minZ = c.z - c.hz, maxZ = c.z + c.hz, minY = 0, maxY = c.top;
    let tmin = 0, tmax = best;
    let nx = 0, ny = 0, nz = 0;
    // X slab
    if (Math.abs(dir.x) < 1e-6) { if (origin.x < minX || origin.x > maxX) continue; }
    else {
      let t1 = (minX - origin.x) / dir.x, t2 = (maxX - origin.x) / dir.x, sign = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sign = 1; }
      if (t1 > tmin) { tmin = t1; nx = sign; ny = nz = 0; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    // Y slab
    if (Math.abs(dir.y) < 1e-6) { if (origin.y < minY || origin.y > maxY) continue; }
    else {
      let t1 = (minY - origin.y) / dir.y, t2 = (maxY - origin.y) / dir.y, sign = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sign = 1; }
      if (t1 > tmin) { tmin = t1; nx = 0; ny = sign; nz = 0; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    // Z slab
    if (Math.abs(dir.z) < 1e-6) { if (origin.z < minZ || origin.z > maxZ) continue; }
    else {
      let t1 = (minZ - origin.z) / dir.z, t2 = (maxZ - origin.z) / dir.z, sign = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sign = 1; }
      if (t1 > tmin) { tmin = t1; nx = 0; ny = 0; nz = sign; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    if (tmin > 0 && tmin < best) { best = tmin; point = origin.clone().addScaledVector(dir, tmin); normal.set(nx, ny, nz); bot = null; }
  }
  // bots (sphere around chest)
  for (const b of bots) {
    _ro.copy(origin).sub(b.pos); _ro.y -= 1.1;
    const r = 0.7;
    const bq = _rd.copy(dir);
    const proj = -_ro.dot(bq);
    if (proj < 0) continue;
    const d2 = _ro.lengthSq() - proj * proj;
    if (d2 > r * r) continue;
    const thc = Math.sqrt(r * r - d2);
    const t = proj - thc;
    if (t > 0 && t < best) { best = t; point = origin.clone().addScaledVector(dir, t); normal.copy(dir).multiplyScalar(-1); bot = b; }
  }
  return { dist: best, point: point || origin.clone().addScaledVector(dir, maxDist), normal, bot };
}

// ------------------------------------------------------------
//  Fire
// ------------------------------------------------------------
let fireCooldown = 0;
const _muzzleWorld = new THREE.Vector3(), _look = new THREE.Vector3(), _right = new THREE.Vector3();
function tryFire(dt) {
  fireCooldown -= dt;
  const w = WEAPONS[heldKey];
  if (!firing || w.type !== 'gun' || switchT < 0.6) return;
  if (fireCooldown > 0) return;
  fireCooldown = w.rate;

  // camera look direction (with current recoil baked in)
  const ty = cam.yaw + recoilYaw, tp = cam.pitch + recoilPitch;
  const cp = Math.cos(tp);
  _look.set(-Math.sin(ty) * cp, Math.sin(tp), -Math.cos(ty) * cp).normalize();
  _right.set(Math.cos(ty), 0, -Math.sin(ty));

  // muzzle position from the gun in hand
  handAnchor.getWorldPosition(_muzzleWorld);
  _muzzleWorld.addScaledVector(_look, muzzleZ * player.scale.x + 0.1).addScaledVector(_right, 0.05);

  // small bullet spread
  const spread = w.spread;
  const dir = _look.clone();
  dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread;
  dir.normalize();

  const hit = rayHit(_muzzleWorld, dir);
  spawnTracer(_muzzleWorld, hit.point);
  if (hit.bot) { hit.bot.hp -= 18; hit.bot.hitFlash = 0.6; if (hit.bot.av.parts.torso.material.emissive) hit.bot.av.parts.torso.material.emissive.setScalar(0.6); }
  spawnImpact(hit.point, hit.normal);

  // muzzle flash
  muzzleFlash.position.copy(_muzzleWorld);
  muzzleFlash.visible = true; flashTime = 0.045;
  muzzleFlash.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1.6 + Math.random());

  // shell ejection
  ejectShell(_muzzleWorld.clone().addScaledVector(_right, 0.1).addScaledVector(_look, -0.15), _right);

  // recoil kick (up + slight random yaw), recovers in update()
  recoilPitch += w.recoil;
  recoilYaw += (Math.random() - 0.5) * w.recoil * 0.6;
  // visual gun kick
  handAnchor.position.z -= 0.06;
}

function updateEffects(dt) {
  // tracers
  for (const t of tracers) {
    if (!t.mesh.visible) continue;
    t.head += t.speed * dt;
    const tail = Math.max(0, t.head - 6);
    if (tail >= t.len) { t.mesh.visible = false; continue; }
    const a = Math.min(t.len, t.head), b = Math.min(t.len, tail);
    const mid = (a + b) / 2;
    TMP.copy(t.to).sub(t.from).normalize();
    t.mesh.position.copy(t.from).addScaledVector(TMP, mid);
    t.mesh.scale.set(1, 1, Math.max(0.2, a - b));
    t.mesh.lookAt(t.to);
  }
  // muzzle flash
  if (muzzleFlash.visible) { flashTime -= dt; if (flashTime <= 0) muzzleFlash.visible = false; }
  // shells
  for (const s of shells) {
    if (!s.mesh.visible) continue;
    s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.vel.y -= 14 * dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt;
    if (s.mesh.position.y < 0.05) { s.mesh.position.y = 0.05; s.vel.set(0, 0, 0); }
  }
  // sparks
  for (const s of sparks) {
    if (!s.mesh.visible) continue;
    s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.vel.y -= 12 * dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.material.opacity = Math.max(0, s.life / 0.35);
  }
  // gun kick recovery
  handAnchor.position.z += (0.32 - handAnchor.position.z) * Math.min(1, dt * 12);
}

// ------------------------------------------------------------
//  Game loop
// ------------------------------------------------------------
const clock = new THREE.Clock();

function update(dt) {
  // camera basis (no recoil) for movement
  const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw);
  const rightX = Math.cos(cam.yaw), rightZ = -Math.sin(cam.yaw);

  // ---- input -> desired velocity ----
  const stickMag = moveStick.mag;
  const sprinting = stickMag > 0.85 && !sliding && onGround;
  let moveState = 'idle';
  let inDir = null;

  if (stickMag > 0.08 && !sliding) {
    const dx = fwdX * (-moveStick.y) + rightX * moveStick.x;
    const dz = fwdZ * (-moveStick.y) + rightZ * moveStick.x;
    const len = Math.hypot(dx, dz) || 1;
    inDir = { x: dx / len, z: dz / len };
    const targetSpeed = (sprinting ? SPRINT : WALK) * (sprinting ? 1 : Math.min(1, stickMag / 0.85));
    // accelerate toward target velocity (responsive)
    const tvx = inDir.x * targetSpeed, tvz = inDir.z * targetSpeed;
    const acc = Math.min(1, dt * 12);
    vel.x += (tvx - vel.x) * acc;
    vel.z += (tvz - vel.z) * acc;
    moveState = sprinting ? 'sprint' : 'walk';
  } else if (!sliding) {
    // decelerate to a stop smoothly
    const dec = Math.min(1, dt * 10);
    vel.x += (0 - vel.x) * dec;
    vel.z += (0 - vel.z) * dec;
  }

  // ---- slide: strong initial momentum that bleeds off (stops naturally) ----
  if (sliding) {
    slideTime += dt;
    vel.x *= Math.pow(0.05, dt);   // ~frame-rate independent friction
    vel.z *= Math.pow(0.05, dt);
    if (slideTime >= 0.95 || (vel.x * vel.x + vel.z * vel.z) < 1.2) sliding = false;
    moveState = 'slide';
  }

  // apply horizontal velocity
  player.position.x += vel.x * dt;
  player.position.z += vel.z * dt;

  // ---- face direction ----
  if (firing && WEAPONS[heldKey].type === 'gun') {
    // face where the camera aims so the gun lines up with the crosshair
    let diff = cam.yaw - player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    player.rotation.y += diff * Math.min(1, dt * 16);
  } else if (inDir) {
    const targetRot = Math.atan2(inDir.x, inDir.z);
    let diff = targetRot - player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    player.rotation.y += diff * Math.min(1, dt * 10);
  }

  // ---- gravity / jump / ground ----
  verticalVel -= 20 * dt;
  player.position.y += verticalVel * dt;
  const floor = groundHeightAt(player.position.x, player.position.z);
  if (player.position.y <= floor) { player.position.y = floor; verticalVel = 0; onGround = true; }
  else { onGround = false; }

  resolveCollisions(player.position);
  player.position.x = Math.max(-29, Math.min(29, player.position.x));
  player.position.z = Math.max(-29, Math.min(29, player.position.z));

  // ---- avatar animation ----
  poseAvatar(avatar, onGround ? moveState : 'jump', dt);

  // ---- weapon switch animation ----
  if (switchT < 1) {
    switchT = Math.min(1, switchT + dt * 4.5);
    if (pendingKey && switchT >= 0.5) { spawnHeld(pendingKey); pendingKey = null; }
    const lowerAmt = switchT < 0.5 ? switchT * 2 : (1 - switchT) * 2;
    handAnchor.rotation.x = -lowerAmt * 1.2;
  } else handAnchor.rotation.x += (0 - handAnchor.rotation.x) * Math.min(1, dt * 8);

  // ---- shooting + effects ----
  tryFire(dt);
  updateEffects(dt);

  // recoil recovery
  recoilPitch += (0 - recoilPitch) * Math.min(1, dt * 7);
  recoilYaw += (0 - recoilYaw) * Math.min(1, dt * 7);

  // ---- bots ----
  for (const b of bots) updateBot(b, dt);

  // ---- gloo walls lifetime ----
  for (let i = glooWalls.length - 1; i >= 0; i--) {
    const g = glooWalls[i];
    g.t += dt;
    if (g.t < 0.25) { const s = g.t / 0.25; g.mesh.scale.set(s, s, s); }       // pop in
    if (g.life - g.t < 1) g.mesh.material.opacity = 0.85 * Math.max(0, g.life - g.t);
    if (g.t >= g.life) {
      scene.remove(g.mesh);
      const ci = colliders.indexOf(g.col); if (ci >= 0) colliders.splice(ci, 1);
      glooWalls.splice(i, 1);
    }
  }

  // ---- floor guns ----
  let best = null, bestD = 2.6;
  for (const fg of floorGuns) {
    fg.mesh.rotation.y += dt * 1.5;
    fg.mesh.position.y = 0.5 + Math.sin(performance.now() / 400 + fg.x) * 0.08;
    const d = Math.hypot(player.position.x - fg.x, player.position.z - fg.z);
    fg.ring.material.opacity = d < 6 ? 0.7 : 0.25;
    if (d < bestD) { bestD = d; best = fg; }
  }
  nearGun = best;
  if (best) { pickupBtn.classList.remove('hidden'); document.getElementById('pk-name').textContent = WEAPONS[best.key].name; }
  else pickupBtn.classList.add('hidden');

  // ---- camera (over-the-shoulder, look-up correct) ----
  const ty = cam.yaw + recoilYaw, tp = cam.pitch + recoilPitch;
  const cpp = Math.cos(tp);
  _look.set(-Math.sin(ty) * cpp, Math.sin(tp), -Math.cos(ty) * cpp);
  _right.set(Math.cos(ty), 0, -Math.sin(ty));
  // pivot: head height + slight shoulder offset so the body sits lower-left
  const pivotX = player.position.x + _right.x * 0.5;
  const pivotY = player.position.y + EYE;
  const pivotZ = player.position.z + _right.z * 0.5;
  // camera distance with collision pull-in
  let dist = cam.dist;
  for (let d = cam.dist; d > 0.8; d -= 0.35) {
    const px = pivotX - _look.x * d, py = pivotY - _look.y * d, pz = pivotZ - _look.z * d;
    if (py < 0.25) { dist = d; continue; }
    let blocked = false;
    for (const c of colliders) { if (px > c.x - c.hx && px < c.x + c.hx && pz > c.z - c.hz && pz < c.z + c.hz && py < c.top) { blocked = true; break; } }
    if (!blocked) { dist = d; break; }
  }
  TMP.set(pivotX - _look.x * dist, pivotY - _look.y * dist, pivotZ - _look.z * dist);
  camera.position.lerp(TMP, Math.min(1, dt * 18));
  camera.lookAt(camera.position.x + _look.x, camera.position.y + _look.y, camera.position.z + _look.z);

  // FOV kick for sprint
  fovTarget = sprinting ? 72 : 64;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 6);
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------
//  Match timer (cosmetic)
// ------------------------------------------------------------
let matchTime = 11;
const timerEl = document.getElementById('timer');
setInterval(() => { matchTime = matchTime > 0 ? matchTime - 1 : 30; timerEl.textContent = '00:' + String(matchTime).padStart(2, '0'); }, 1000);

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ------------------------------------------------------------
//  Orientation + fullscreen + resize
// ------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

async function goFullscreenLandscape() {
  try {
    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (_) { /* iOS ignores; rotate overlay covers it */ }
  resize();
}
document.getElementById('fs-btn').addEventListener('click', goFullscreenLandscape);
window.addEventListener('touchend', function once() { goFullscreenLandscape(); window.removeEventListener('touchend', once); }, { once: true });

// ------------------------------------------------------------
//  Boot
// ------------------------------------------------------------
spawnHeld('katana');
updateLoadoutUI();
requestAnimationFrame(() => {
  document.getElementById('loader').classList.add('hidden');
  document.body.classList.add('playing');
  animate();
});
