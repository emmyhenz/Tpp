import * as THREE from 'three';

// ============================================================
//  TPP — Container Warfare  (mobile third-person)
//  Left joystick = move.  Drag the screen = look (CODM / Free Fire style).
//  Weapon slots, katana melee, slide + slide-jump, rewind ability,
//  and pick-up-able guns on the floor.
// ============================================================

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
scene.fog = new THREE.Fog(0x9fb4c4, 40, 130);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);

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
const colliders = [];
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
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [endMat, endMat, sideMat, sideMat, sideMat, sideMat]
  );
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
//  Player character
// ------------------------------------------------------------
const player = new THREE.Group();
const cloth = 0x3c4a2e, skin = 0x8d5a3b, pack = 0x6b4a2a;
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 }));
torso.position.y = 1.25;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
head.position.y = 1.78;
const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), new THREE.MeshStandardMaterial({ color: pack, roughness: 1 }));
backpack.position.set(0, 1.25, -0.26);
const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 1 });
const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.14, 0.55, 0);
const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.14, 0.55, 0);
const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.18);
const armMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 });
const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-0.37, 1.28, 0);
const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(0.37, 1.28, 0.05);
[torso, head, backpack, legL, legR, armL, armR].forEach((m) => { m.castShadow = true; player.add(m); });

// Hand anchor that holds the current weapon (in front of the right hand)
const handAnchor = new THREE.Group();
handAnchor.position.set(0.34, 1.2, 0.32);
player.add(handAnchor);

player.position.set(0, 0, 18);
scene.add(player);

// ------------------------------------------------------------
//  Weapon meshes
// ------------------------------------------------------------
const matMetal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.6 });
const matMatte = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });

function part(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }

function buildKatana() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.04, 0.04, 1.0), matMetal(0xd7dbe0), 0, 0, 0.55)); // blade
  g.add(part(new THREE.BoxGeometry(0.12, 0.04, 0.04), matMatte(0x222222), 0, 0, 0.05)); // guard
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.22), matMatte(0x111111), 0, 0, -0.08)); // handle
  return g;
}
function buildAK47() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.08, 0.14, 0.7), matMatte(0x3a2a18), 0, 0, 0.2)); // body (wood)
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.5), matMetal(0x2b2b2b), 0, 0.05, 0.55)); // barrel
  g.add(part(new THREE.BoxGeometry(0.07, 0.22, 0.12), matMatte(0x222018), 0, -0.16, 0.12)); // mag
  g.add(part(new THREE.BoxGeometry(0.06, 0.16, 0.1), matMatte(0x3a2a18), 0, -0.12, -0.18)); // grip
  return g;
}
function buildAK117() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.08, 0.12, 0.66), matMatte(0x2d3138), 0, 0, 0.2)); // body (gray)
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.46), matMetal(0x4a4f57), 0, 0.04, 0.52)); // barrel
  g.add(part(new THREE.BoxGeometry(0.07, 0.2, 0.1), matMatte(0x1d2025), 0, -0.15, 0.1)); // mag
  g.add(part(new THREE.BoxGeometry(0.06, 0.15, 0.1), matMatte(0x2d3138), 0, -0.11, -0.16)); // grip
  return g;
}
function buildFennec() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.07, 0.11, 0.42), matMatte(0x222222), 0, 0, 0.12)); // compact body
  g.add(part(new THREE.BoxGeometry(0.04, 0.04, 0.22), matMetal(0x3a3a3a), 0, 0.03, 0.34)); // short barrel
  g.add(part(new THREE.BoxGeometry(0.06, 0.24, 0.08), matMatte(0x161616), 0, -0.16, 0.05)); // long mag
  g.add(part(new THREE.BoxGeometry(0.05, 0.14, 0.09), matMatte(0x222222), 0, -0.1, -0.14)); // grip
  return g;
}

const WEAPONS = {
  katana: { name: 'Katana', label: '🗡 Katana', type: 'melee', build: buildKatana },
  ak47:   { name: 'AK47',   label: '🔫 AK47',   type: 'gun',   build: buildAK47 },
  ak117:  { name: 'AK117',  label: '🔫 AK117',  type: 'gun',   build: buildAK117 },
  fennec: { name: 'Fennec', label: '🔫 Fennec', type: 'gun',   build: buildFennec },
};

// ------------------------------------------------------------
//  Loadout state + switching (with holster animation)
// ------------------------------------------------------------
const slots = [null, null];     // gun keys held in slot 0 / 1
let heldKey = 'katana';         // currently equipped weapon
let heldMesh = null;
let switchT = 1;                // 0..1 holster animation progress (1 = settled)
let pendingKey = null;          // weapon to raise after the lower phase

function spawnHeld(key) {
  if (heldMesh) handAnchor.remove(heldMesh);
  heldMesh = WEAPONS[key].build();
  handAnchor.add(heldMesh);
  heldKey = key;
  updateLoadoutUI();
}

// Begin a switch: lower current weapon, then raise the new one.
function equip(key) {
  if (key === heldKey && switchT >= 1) return;
  pendingKey = key;
  switchT = 0;
}

function tapSlot(i) {
  const gun = slots[i];
  if (!gun) return;                       // empty slot
  if (heldKey === gun) equip('katana');   // tap held weapon -> melee
  else equip(gun);                        // otherwise hold that gun
}

function giveWeapon(key) {
  // Put gun into first empty slot, else replace currently held slot.
  let idx = slots.indexOf(null);
  let dropped = null;
  if (idx === -1) {
    idx = slots.indexOf(heldKey);
    if (idx === -1) idx = 0;
    dropped = slots[idx];
  }
  slots[idx] = key;
  equip(key);
  updateLoadoutUI();
  return dropped;
}

// ------------------------------------------------------------
//  Floor guns (pickups)
// ------------------------------------------------------------
const floorGuns = [];
function dropGun(key, x, z) {
  const g = WEAPONS[key].build();
  g.scale.setScalar(1.1);
  g.position.set(x, 0.5, z);
  g.rotation.z = Math.PI / 2;            // lay flat-ish
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  scene.add(g); scene.add(ring);
  floorGuns.push({ key, mesh: g, ring, x, z });
}
dropGun('ak47', 4, 10);
dropGun('ak117', -10, 2);
dropGun('fennec', 9, -6);

// ------------------------------------------------------------
//  Camera look state
// ------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.35, dist: 6.5 };

// ------------------------------------------------------------
//  Movement joystick (touch + mouse)
// ------------------------------------------------------------
function createJoystick(zoneId, knobId) {
  const zone = document.getElementById(zoneId);
  const knob = document.getElementById(knobId);
  const state = { x: 0, y: 0, id: null };
  const radius = 46;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const reset = () => { state.x = 0; state.y = 0; state.id = null; zone.classList.remove('active'); setKnob(0, 0); };
  const move = (cx, cy) => {
    const r = zone.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    setKnob(dx, dy);
    state.x = dx / radius; state.y = dy / radius;
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
//  Look: drag anywhere on the canvas (CODM / Free Fire style)
// ------------------------------------------------------------
const LOOK_SENS = 0.0045;
let lookId = null, lastLX = 0, lastLY = 0;
function applyLook(dx, dy) {
  cam.yaw -= dx * LOOK_SENS;
  cam.pitch -= dy * LOOK_SENS;
  cam.pitch = Math.max(-0.15, Math.min(1.05, cam.pitch));
}
window.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.target === canvas && lookId === null) { lookId = t.identifier; lastLX = t.clientX; lastLY = t.clientY; }
  }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === lookId) { applyLook(t.clientX - lastLX, t.clientY - lastLY); lastLX = t.clientX; lastLY = t.clientY; }
  }
}, { passive: true });
const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
window.addEventListener('touchend', endLook); window.addEventListener('touchcancel', endLook);
// Desktop: drag on canvas to look
let mouseLook = false;
canvas.addEventListener('mousedown', (e) => { mouseLook = true; lastLX = e.clientX; lastLY = e.clientY; });
window.addEventListener('mousemove', (e) => { if (mouseLook) { applyLook(e.clientX - lastLX, e.clientY - lastLY); lastLX = e.clientX; lastLY = e.clientY; } });
window.addEventListener('mouseup', () => { mouseLook = false; });

// ------------------------------------------------------------
//  Buttons: jump, slide, rewind, weapon slots, pickup
// ------------------------------------------------------------
let verticalVel = 0, onGround = true;
let sliding = false, slideTime = 0;
const momentum = new THREE.Vector3();   // persistent horizontal glide (slide / slide-jump)

function jump() {
  if (sliding) {            // slide-jump: cancel slide early, KEEP momentum, hop
    sliding = false;
    verticalVel = 7.5;
    momentum.multiplyScalar(1.15);   // small boost — the satisfying slide-jump launch
    onGround = false;
    return;
  }
  if (onGround) { verticalVel = 7; onGround = false; }
}
function startSlide() {
  if (!onGround || sliding) return;
  sliding = true; slideTime = 0;
  // launch in the direction the character is currently facing
  momentum.set(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y)).multiplyScalar(14);
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

// Pickup
let nearGun = null;
const pickupBtn = document.getElementById('pickup-prompt');
function doPickup() {
  if (!nearGun) return;
  const dropped = giveWeapon(nearGun.key);
  // remove the picked gun from the floor
  scene.remove(nearGun.mesh); scene.remove(nearGun.ring);
  const i = floorGuns.indexOf(nearGun); if (i >= 0) floorGuns.splice(i, 1);
  nearGun = null;
  // if a gun was bumped out of the loadout, drop it where the player stands
  if (dropped) dropGun(dropped, player.position.x + 1, player.position.z);
  pickupBtn.classList.add('hidden');
}
pickupBtn.addEventListener('click', doPickup);
pickupBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doPickup(); }, { passive: false });

// ------------------------------------------------------------
//  Rewind ability (5 seconds back)
// ------------------------------------------------------------
const history = [];          // {t, x, y, z, ry}
let rewinding = null;        // {from, to, t}
let rewindReady = true;
const rewindBtn = document.getElementById('btn-rewind');
function startRewind() {
  if (!rewindReady || rewinding) return;
  const target = history.find((h) => performance.now() - h.t <= 5000);
  if (!target) return;
  rewinding = { from: player.position.clone(), to: new THREE.Vector3(target.x, target.y, target.z), ry: target.ry, t: 0 };
  rewindReady = false;
  rewindBtn.classList.add('cooldown');
  setTimeout(() => { rewindReady = true; rewindBtn.classList.remove('cooldown'); }, 8000); // cooldown
}
bind('btn-rewind', startRewind);

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
  // crosshair only when holding a gun
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
  for (const c of colliders) {
    if (x > c.x - c.hx && x < c.x + c.hx && z > c.z - c.hz && z < c.z + c.hz && c.top > h) h = c.top;
  }
  return h;
}

// ------------------------------------------------------------
//  Game loop
// ------------------------------------------------------------
const clock = new THREE.Clock();
let walkPhase = 0;
let lastHistory = 0;

function update(dt) {
  // ---- camera-relative basis from yaw ----
  // forward = direction the camera looks (horizontally), into the screen
  const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw);
  const rightX = -fwdZ, rightZ = fwdX;   // forward rotated -90° about Y

  // ---- rewind takes over movement while active ----
  if (rewinding) {
    rewinding.t += dt / 0.4;
    const k = Math.min(1, rewinding.t);
    player.position.lerpVectors(rewinding.from, rewinding.to, k);
    if (k >= 1) { player.rotation.y = rewinding.ry; rewinding = null; }
  } else {
    let moving = false;
    if (sliding) {
      // ---- slide: hold the crouch/lean pose; movement comes from momentum ----
      slideTime += dt;
      torso.rotation.x = -0.7; head.rotation.x = 0.3;
      if (slideTime >= 1) { sliding = false; }     // slide lasts ~1s
    } else {
      torso.rotation.x *= 0.8; head.rotation.x *= 0.8;
      const mag = Math.hypot(moveStick.x, moveStick.y);
      const speed = 5.5;
      if (mag > 0.08) {
        moving = true;
        const dx = fwdX * (-moveStick.y) + rightX * moveStick.x;
        const dz = fwdZ * (-moveStick.y) + rightZ * moveStick.x;
        const len = Math.hypot(dx, dz) || 1;
        player.position.x += (dx / len) * speed * dt;
        player.position.z += (dz / len) * speed * dt;
        const targetRot = Math.atan2(dx, dz);
        let diff = targetRot - player.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.rotation.y += diff * Math.min(1, dt * 12);
      }
    }

    // ---- persistent horizontal momentum (slide glide + slide-jump launch) ----
    player.position.x += momentum.x * dt;
    player.position.z += momentum.z * dt;
    // decays slowly while sliding/airborne, fast once running normally on the ground
    momentum.multiplyScalar((sliding || !onGround) ? 0.985 : 0.82);

    // ---- gravity / jump / standing on containers ----
    verticalVel -= 20 * dt;
    player.position.y += verticalVel * dt;
    const floor = groundHeightAt(player.position.x, player.position.z);
    if (player.position.y <= floor) { player.position.y = floor; verticalVel = 0; onGround = true; }
    else onGround = false;

    resolveCollisions(player.position);
    player.position.x = Math.max(-29, Math.min(29, player.position.x));
    player.position.z = Math.max(-29, Math.min(29, player.position.z));

    // ---- walk animation ----
    if (moving && onGround && !sliding) {
      walkPhase += dt * 11;
      const sw = Math.sin(walkPhase) * 0.4;
      legL.rotation.x = sw; legR.rotation.x = -sw;
    } else { legL.rotation.x *= 0.8; legR.rotation.x *= 0.8; }
  }

  // ---- weapon switch (holster) animation ----
  if (switchT < 1) {
    switchT = Math.min(1, switchT + dt * 4);
    // 0..0.5 lower, swap at 0.5, 0.5..1 raise
    if (pendingKey && switchT >= 0.5) { spawnHeld(pendingKey); pendingKey = null; }
    const lowerAmt = switchT < 0.5 ? switchT * 2 : (1 - switchT) * 2; // 0->1->0
    handAnchor.rotation.x = -lowerAmt * 1.2;
    handAnchor.position.y = 1.2 - lowerAmt * 0.25;
  } else {
    handAnchor.rotation.x += (0 - handAnchor.rotation.x) * 0.3;
  }

  // ---- record history for rewind (~10/sec) ----
  if (performance.now() - lastHistory > 100) {
    lastHistory = performance.now();
    history.unshift({ t: performance.now(), x: player.position.x, y: player.position.y, z: player.position.z, ry: player.rotation.y });
    while (history.length && performance.now() - history[history.length - 1].t > 6000) history.pop();
  }

  // ---- floor gun proximity / pickup prompt ----
  let best = null, bestD = 2.6;
  for (const fg of floorGuns) {
    fg.mesh.rotation.y += dt * 1.5;          // spin to draw attention
    fg.mesh.position.y = 0.5 + Math.sin(performance.now() / 400 + fg.x) * 0.08;
    const d = Math.hypot(player.position.x - fg.x, player.position.z - fg.z);
    fg.ring.material.opacity = d < 6 ? 0.7 : 0.25;
    if (d < bestD) { bestD = d; best = fg; }
  }
  nearGun = best;
  if (best) {
    pickupBtn.classList.remove('hidden');
    document.getElementById('pk-name').textContent = WEAPONS[best.key].name;
  } else {
    pickupBtn.classList.add('hidden');
  }

  // ---- third-person camera ----
  const cp = Math.cos(cam.pitch);
  const offX = Math.sin(cam.yaw) * cam.dist * cp;
  const offZ = Math.cos(cam.yaw) * cam.dist * cp;
  const offY = Math.sin(cam.pitch) * cam.dist + 1.5;
  const desired = new THREE.Vector3(player.position.x + offX, player.position.y + offY, player.position.z + offZ);
  camera.position.lerp(desired, Math.min(1, dt * 12));
  camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);
}

// ------------------------------------------------------------
//  Match timer (cosmetic)
// ------------------------------------------------------------
let matchTime = 11;
const timerEl = document.getElementById('timer');
setInterval(() => {
  matchTime = matchTime > 0 ? matchTime - 1 : 30;
  timerEl.textContent = '00:' + String(matchTime).padStart(2, '0');
}, 1000);

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

// Try to lock landscape after entering fullscreen (works on Android Chrome).
async function goFullscreenLandscape() {
  try {
    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (_) { /* iOS Safari ignores this; the rotate overlay covers that case */ }
  resize();
}
document.getElementById('fs-btn').addEventListener('click', goFullscreenLandscape);
// First touch anywhere also attempts fullscreen-landscape once.
window.addEventListener('touchend', function once() {
  goFullscreenLandscape();
  window.removeEventListener('touchend', once);
}, { once: true });

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
