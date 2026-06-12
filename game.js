import * as THREE from 'three';

// ============================================================
//  TPP — Container Warfare
//  Mobile third-person game. Left joystick moves the player,
//  right joystick looks/orbits the camera around the map.
// ============================================================

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
scene.fog = new THREE.Fog(0x9fb4c4, 40, 120);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

// ------------------------------------------------------------
//  Lighting
// ------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 150;
scene.add(sun);

// ------------------------------------------------------------
//  Ground
// ------------------------------------------------------------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x9b8e72, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Yellow hazard lane stripes painted on the ground
function addLane(x, z, w, d, rot = 0) {
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0xe8c93a, roughness: 1 })
  );
  lane.rotation.x = -Math.PI / 2;
  lane.rotation.z = rot;
  lane.position.set(x, 0.02, z);
  scene.add(lane);
}
addLane(0, 0, 3, 60);
addLane(0, 0, 60, 3);

// ------------------------------------------------------------
//  Shipping containers  (the map)
// ------------------------------------------------------------
const colliders = []; // AABB boxes for player collision
const CONTAINER_COLORS = [0x2f6fb0, 0xc24a2f, 0x3a8f5a, 0xc7a23a, 0x8a8f96];

function makeContainerTexture(base) {
  // Corrugated vertical ribs drawn on a canvas.
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(base);
  ctx.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`;
  ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 128; i += 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(i, 0, 3, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(i + 3, 0, 2, 64);
  }
  // rusty grime
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
  const mats = [endMat, endMat, sideMat, sideMat, sideMat, sideMat];
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats);
  box.position.set(x, y + H / 2, z);
  box.rotation.y = ry;
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);

  // Expanded AABB collider (axis-aligned approximation accounting for rotation).
  const half = Math.abs(Math.cos(ry)) * W / 2 + Math.abs(Math.sin(ry)) * D / 2;
  const halfZ = Math.abs(Math.sin(ry)) * W / 2 + Math.abs(Math.cos(ry)) * D / 2;
  colliders.push({ x, z, hx: half, hz: halfZ, top: y + H });
  return box;
}

// Lay out a container yard: rows of stacked containers with gaps (lanes).
function buildMap() {
  let ci = 0;
  const pick = () => CONTAINER_COLORS[(ci++) % CONTAINER_COLORS.length];

  const rows = [-22, -14, 14, 22];
  for (const z of rows) {
    for (let x = -24; x <= 24; x += 9) {
      // skip some for cover variety
      if (Math.random() < 0.15) continue;
      addContainer(x, 0, z, 0, pick());
      // stack a second one sometimes
      if (Math.random() < 0.45) addContainer(x, 2.6, z, 0, pick());
    }
  }

  // Cross-aligned containers near the center for close-quarter cover
  addContainer(-8, 0, -4, Math.PI / 2, pick());
  addContainer(8, 0, 4, Math.PI / 2, pick());
  addContainer(-6, 0, 7, 0, pick());
  addContainer(7, 0, -7, 0, pick());
  addContainer(0, 0, -9, Math.PI / 2, pick());

  // a couple of stacked towers
  addContainer(-18, 0, 0, Math.PI / 2, pick());
  addContainer(-18, 2.6, 0, Math.PI / 2, pick());
  addContainer(18, 0, 0, Math.PI / 2, pick());
  addContainer(18, 2.6, 0, Math.PI / 2, pick());

  // Perimeter wall containers to bound the arena
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
//  Player (third-person character)
// ------------------------------------------------------------
const player = new THREE.Group();
const skin = 0x8d5a3b, cloth = 0x3c4a2e, pack = 0x6b4a2a;

const torso = new THREE.Mesh(
  new THREE.BoxGeometry(0.55, 0.7, 0.32),
  new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 })
);
torso.position.y = 1.25;
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.2, 16, 16),
  new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 })
);
head.position.y = 1.78;
const backpack = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.5, 0.22),
  new THREE.MeshStandardMaterial({ color: pack, roughness: 1 })
);
backpack.position.set(0, 1.25, -0.26);

const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 1 });
const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.14, 0.55, 0);
const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.14, 0.55, 0);

const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.18);
const armL = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 }));
armL.position.set(-0.37, 1.28, 0);
const armR = armL.clone(); armR.position.x = 0.37;

[torso, head, backpack, legL, legR, armL, armR].forEach((m) => {
  m.castShadow = true; player.add(m);
});
player.position.set(0, 0, 18);
scene.add(player);

// ------------------------------------------------------------
//  Third-person orbit camera state
// ------------------------------------------------------------
const cam = {
  yaw: Math.PI,      // horizontal angle around player
  pitch: 0.35,       // vertical angle
  dist: 6.5,         // distance behind player
};

// ------------------------------------------------------------
//  Joysticks  (touch + mouse)
// ------------------------------------------------------------
function createJoystick(zoneId, knobId) {
  const zone = document.getElementById(zoneId);
  const knob = document.getElementById(knobId);
  const state = { x: 0, y: 0, active: false, id: null };
  const radius = 46;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function reset() {
    state.x = 0; state.y = 0; state.active = false; state.id = null;
    zone.classList.remove('active');
    setKnob(0, 0);
  }
  function start(id, cx, cy) {
    state.id = id; state.active = true; zone.classList.add('active');
    move(cx, cy);
  }
  function move(cx, cy) {
    const r = zone.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    setKnob(dx, dy);
    state.x = dx / radius;   // -1..1
    state.y = dy / radius;   // -1..1
  }

  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    start(t.identifier, t.clientX, t.clientY);
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === state.id) move(t.clientX, t.clientY);
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === state.id) reset();
    }
  };
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);

  // Mouse fallback (desktop testing)
  zone.addEventListener('mousedown', (e) => { start('mouse', e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (state.id === 'mouse') move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (state.id === 'mouse') reset(); });

  return state;
}

const moveStick = createJoystick('move-zone', 'move-knob');
const lookStick = createJoystick('look-zone', 'look-knob');

// Action buttons
let sprinting = false;
let verticalVel = 0;
let onGround = true;
const btnSprint = document.getElementById('btn-sprint');
btnSprint.addEventListener('click', () => {
  sprinting = !sprinting;
  btnSprint.classList.toggle('on', sprinting);
});
document.getElementById('btn-jump').addEventListener('touchstart', jump);
document.getElementById('btn-jump').addEventListener('click', jump);
function jump() {
  if (onGround) { verticalVel = 7; onGround = false; }
}

// ------------------------------------------------------------
//  Collision helper (player vs container AABBs)
// ------------------------------------------------------------
const PLAYER_R = 0.45;
function resolveCollisions(pos) {
  for (const c of colliders) {
    // Only collide if player is below the top of the container.
    if (pos.y > c.top - 0.1) continue;
    const minX = c.x - c.hx - PLAYER_R;
    const maxX = c.x + c.hx + PLAYER_R;
    const minZ = c.z - c.hz - PLAYER_R;
    const maxZ = c.z + c.hz + PLAYER_R;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      // push out along the smallest penetration axis
      const penLeft = pos.x - minX;
      const penRight = maxX - pos.x;
      const penFront = pos.z - minZ;
      const penBack = maxZ - pos.z;
      const m = Math.min(penLeft, penRight, penFront, penBack);
      if (m === penLeft) pos.x = minX;
      else if (m === penRight) pos.x = maxX;
      else if (m === penFront) pos.z = minZ;
      else pos.z = maxZ;
    }
  }
}

// Standing-on-top check: returns highest container top under the player.
function groundHeightAt(x, z) {
  let h = 0;
  for (const c of colliders) {
    if (x > c.x - c.hx && x < c.x + c.hx && z > c.z - c.hz && z < c.z + c.hz) {
      if (c.top > h) h = c.top;
    }
  }
  return h;
}

// ------------------------------------------------------------
//  Game loop
// ------------------------------------------------------------
const clock = new THREE.Clock();
let walkPhase = 0;

function update(dt) {
  // --- Look joystick orbits the camera ---
  const lookSpeed = 2.4;
  cam.yaw -= lookStick.x * lookSpeed * dt;
  cam.pitch -= lookStick.y * lookSpeed * dt;
  cam.pitch = Math.max(-0.2, Math.min(1.1, cam.pitch));

  // --- Move joystick moves the player relative to camera facing ---
  const speed = (sprinting ? 9 : 5);
  const mag = Math.hypot(moveStick.x, moveStick.y);
  let moving = false;

  if (mag > 0.08) {
    moving = true;
    // camera-forward on the XZ plane
    const fwdX = Math.sin(cam.yaw);
    const fwdZ = Math.cos(cam.yaw);
    const rightX = Math.sin(cam.yaw - Math.PI / 2);
    const rightZ = Math.cos(cam.yaw - Math.PI / 2);

    const dx = (fwdX * -moveStick.y + rightX * moveStick.x);
    const dz = (fwdZ * -moveStick.y + rightZ * moveStick.x);
    const len = Math.hypot(dx, dz) || 1;

    player.position.x += (dx / len) * speed * dt;
    player.position.z += (dz / len) * speed * dt;

    // Face direction of travel
    const targetRot = Math.atan2(dx, dz);
    let diff = targetRot - player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.rotation.y += diff * Math.min(1, dt * 12);
  }

  // --- Gravity / jump / standing on containers ---
  verticalVel -= 20 * dt;
  player.position.y += verticalVel * dt;
  const floor = groundHeightAt(player.position.x, player.position.z);
  if (player.position.y <= floor) {
    player.position.y = floor;
    verticalVel = 0;
    onGround = true;
  } else {
    onGround = false;
  }

  resolveCollisions(player.position);

  // Keep inside arena bounds
  player.position.x = Math.max(-29, Math.min(29, player.position.x));
  player.position.z = Math.max(-29, Math.min(29, player.position.z));

  // --- Walk bob animation ---
  if (moving && onGround) {
    walkPhase += dt * (sprinting ? 16 : 11);
    const sw = Math.sin(walkPhase) * 0.4;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    armL.rotation.x = -sw; armR.rotation.x = sw;
  } else {
    legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
    armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
  }

  // --- Position third-person camera ---
  const cp = Math.cos(cam.pitch);
  const offX = Math.sin(cam.yaw) * cam.dist * cp;
  const offZ = Math.cos(cam.yaw) * cam.dist * cp;
  const offY = Math.sin(cam.pitch) * cam.dist + 1.4;

  const desired = new THREE.Vector3(
    player.position.x + offX,
    player.position.y + offY,
    player.position.z + offZ
  );
  // simple smoothing
  camera.position.lerp(desired, Math.min(1, dt * 10));
  camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);
}

// ------------------------------------------------------------
//  Timer (cosmetic, like the match clock in the screenshots)
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
//  Resize + boot
// ------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Hide loader and start once a frame is rendered.
requestAnimationFrame(() => {
  document.getElementById('loader').classList.add('hidden');
  animate();
});
