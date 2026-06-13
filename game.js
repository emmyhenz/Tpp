import * as THREE from 'three';

// ============================================================
//  TPP — Container Warfare  (mobile FPS)
//  Delta-look (no drift) • jointed humanoid • back-holstering
//  energy shield • bridges/ramps • mantle climbing • HUD editor
// ============================================================

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
function skyTexture() { const c = document.createElement('canvas'); c.width = 16; c.height = 256; const ctx = c.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#5d9fe0'); g.addColorStop(0.55, '#a6cdec'); g.addColorStop(1, '#e6eef4'); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function sandTexture() { const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d'); ctx.fillStyle = '#cdb892'; ctx.fillRect(0, 0, 128, 128); for (let i = 0; i < 2600; i++) { const v = Math.random(); ctx.fillStyle = `rgba(${150 + v * 60 | 0},${128 + v * 48 | 0},${92 + v * 40 | 0},0.5)`; ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(28, 28); return t; }
scene.background = skyTexture();
scene.fog = new THREE.Fog(0xcfe0ee, 70, 170);
function addClouds() { const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }); for (let i = 0; i < 12; i++) { const g = new THREE.Group(); const n = 3 + Math.floor(Math.random() * 3); for (let j = 0; j < n; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 3, 8, 6), mat); s.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 5); s.scale.y = 0.5; g.add(s); } g.position.set((Math.random() - 0.5) * 150, 26 + Math.random() * 14, (Math.random() - 0.5) * 150); scene.add(g); } }
const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 500);
const TMP = new THREE.Vector3();
const now = () => performance.now();
let inSafeZone = false;

scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 150 }); scene.add(sun);

const matMetal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.6 });
const matMatte = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const lerpN = (cur, t, dt, rate = 10) => cur + (t - cur) * Math.min(1, dt * rate);
const lerpRot = (o, ax, t, dt, rate = 10) => { o.rotation[ax] = lerpN(o.rotation[ax], t, dt, rate); };

// ---- ground + lanes ----
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
addClouds();
function addLane(x, z, w, d) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xe8c93a, roughness: 1 })); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, z); scene.add(l); }
addLane(0, 0, 3, 60); addLane(0, 0, 60, 3);

// ============================================================
//  Map
// ============================================================
const colliders = [], ladders = [], ziplines = [];
const CONTAINER_COLORS = [0x2f6fb0, 0xc24a2f, 0x3a8f5a, 0xc7a23a, 0x8a8f96];

function makeContainerTexture(base) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const ctx = c.getContext('2d'); const col = new THREE.Color(base);
  ctx.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`; ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 128; i += 6) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(i, 0, 3, 64); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(i + 3, 0, 2, 64); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(40,25,10,${Math.random() * 0.25})`; ctx.fillRect(Math.random() * 128, Math.random() * 64, Math.random() * 10, Math.random() * 20); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 8) { ctx.fillStyle = 'rgba(60,38,16,0.5)'; ctx.fillRect(0, i, 64, 2); }
  for (let i = 0; i < 50; i++) { ctx.fillStyle = `rgba(110,75,35,${Math.random() * 0.5})`; ctx.fillRect(Math.random() * 64, Math.random() * 64, Math.random() * 12, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const woodTex = woodTexture();
const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.95 });

const markerMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
function addClimbMarker(x, top, z, hz) { const g = new THREE.Group(); for (let i = 0; i < 2; i++) { const tri = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 3), markerMat); tri.position.y = top - 0.55 + i * 0.34; g.add(tri); } g.position.set(x, 0, z + hz + 0.02); scene.add(g); }

function addBlock(x, y, z, W, H, D, ry, mat, climbable) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat); box.position.set(x, y + H / 2, z); box.rotation.y = ry; box.castShadow = true; box.receiveShadow = true; scene.add(box);
  const hx = Math.abs(Math.cos(ry)) * W / 2 + Math.abs(Math.sin(ry)) * D / 2, hz = Math.abs(Math.sin(ry)) * W / 2 + Math.abs(Math.cos(ry)) * D / 2;
  const col = { x, z, hx, hz, top: y + H }; colliders.push(col);
  if (climbable) addClimbMarker(x, y + H, z, hz);
  return col;
}
function addContainer(x, y, z, ry, color, climbable = true) {
  const W = 6, H = 2.6, D = 2.5; const tex = makeContainerTexture(color);
  const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.15 });
  const endMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.2 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [endMat, endMat, sideMat, sideMat, sideMat, sideMat]);
  box.position.set(x, y + H / 2, z); box.rotation.y = ry; box.castShadow = true; box.receiveShadow = true; scene.add(box);
  const hx = Math.abs(Math.cos(ry)) * W / 2 + Math.abs(Math.sin(ry)) * D / 2, hz = Math.abs(Math.sin(ry)) * W / 2 + Math.abs(Math.cos(ry)) * D / 2;
  const col = { x, z, hx, hz, top: y + H, climb: !!(climbable && y === 0 && H <= 2.7) }; colliders.push(col);
  if (col.climb) addClimbMarker(x, y + H, z, hz);
  return col;
}
function addLadder(x, z, top, nx, nz) {
  const g = new THREE.Group(); const rm = matMetal(0x9aa0a8);
  g.add(part(new THREE.BoxGeometry(0.05, top, 0.05), rm, -0.22, top / 2, 0)); g.add(part(new THREE.BoxGeometry(0.05, top, 0.05), rm, 0.22, top / 2, 0));
  for (let yy = 0.3; yy < top; yy += 0.34) g.add(part(new THREE.BoxGeometry(0.5, 0.05, 0.05), rm, 0, yy, 0));
  g.position.set(x + nx * 0.05, 0, z + nz * 0.05); g.rotation.y = Math.atan2(nx, nz); scene.add(g); ladders.push({ x: x + nx * 0.1, z: z + nz * 0.1, top, nx, nz });
}
function addZipline(ax, ay, az, bx, by, bz) { const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz), len = a.distanceTo(b); const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), matMetal(0x2a2a2a)); cyl.position.copy(a).lerp(b, 0.5); cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); scene.add(cyl); ziplines.push({ a, b, len }); }
// stepped ramp (walkable steps up to a height)
function addRamp(x, z, dir, steps, color) { for (let i = 0; i < steps; i++) { const h = 0.55 * (i + 1); addBlock(x + dir * i * 0.9, 0, z, 1.0, h, 0.9, 0, woodMat, false); } }

function buildMap() {
  let ci = 0; const pick = () => CONTAINER_COLORS[(ci++) % CONTAINER_COLORS.length];
  // rows: single containers are climbable; stacked (double) ones are not
  for (const z of [-22, -14, 14, 22]) for (let x = -24; x <= 24; x += 9) {
    if (Math.random() < 0.15) continue;
    const stacked = Math.random() < 0.45;
    addContainer(x, 0, z, 0, pick(), !stacked);
    if (stacked) addContainer(x, 2.6, z, 0, pick(), false);
  }
  // single containers around the centre (climbable)
  addContainer(-8, 0, -4, Math.PI / 2, pick(), true); addContainer(8, 0, 4, Math.PI / 2, pick(), true);
  addContainer(-6, 0, 7, 0, pick(), true); addContainer(7, 0, -7, 0, pick(), true); addContainer(0, 0, -9, Math.PI / 2, pick(), true);
  // two double-stacks (NOT climbable)
  addContainer(-18, 0, 0, Math.PI / 2, pick(), false); addContainer(-18, 2.6, 0, Math.PI / 2, pick(), false);
  addContainer(18, 0, 0, Math.PI / 2, pick(), false); addContainer(18, 2.6, 0, Math.PI / 2, pick(), false);
  // perimeter walls made of containers (colourful)
  for (let x = -27; x <= 27; x += 6) { addContainer(x, 0, -30, 0, pick(), false); addContainer(x, 0, 30, 0, pick(), false); }
  for (let z = -27; z <= 27; z += 2.5) { addContainer(-30, 0, z, Math.PI / 2, pick(), false); addContainer(30, 0, z, Math.PI / 2, pick(), false); }
}
buildMap();

// ============================================================
//  Humanoid rig (knee + elbow joints, better proportions)
// ============================================================
function buildHair(color) {
  const g = new THREE.Group(); const m = matMatte(color);
  // scalp cap so the sides/back aren't bald
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), m);
  cap.position.y = 0.02; cap.castShadow = true; g.add(cap);
  const sp = [[0, 0.18, 0, 0.16, 0.34, 0], [-0.13, 0.13, 0.02, 0.12, 0.3, -0.4], [0.13, 0.13, 0.02, 0.12, 0.3, 0.4], [0, 0.14, -0.14, 0.12, 0.3, 2.4], [-0.16, 0.05, 0.05, 0.1, 0.26, -0.9], [0.16, 0.05, 0.05, 0.1, 0.26, 0.9], [-0.08, 0.16, 0.12, 0.1, 0.28, -0.3], [0.08, 0.16, 0.12, 0.1, 0.28, 0.3], [0, 0.18, 0.14, 0.1, 0.26, 0], [-0.18, -0.04, -0.04, 0.09, 0.22, -1.3], [0.18, -0.04, -0.04, 0.09, 0.22, 1.3]];
  for (const [x, y, z, r, h, rz] of sp) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), m); c.position.set(x, y, z); c.rotation.z = rz; c.rotation.x = z < 0 ? -0.5 : 0.2; c.castShadow = true; g.add(c); }
  const b = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), m); b.position.set(0, 0.05, 0.19); b.rotation.x = 0.9; g.add(b); return g;
}
function buildAvatar(opt = {}) {
  const gi = opt.gi ?? 0xe8731f, trim = opt.trim ?? 0xc25a12, under = opt.under ?? 0x2350c8, hair = opt.hair ?? 0xcdd2dc, skin = opt.skin ?? 0xf0c79b, boot = opt.boot ?? 0x16315e;
  const group = new THREE.Group(); const body = new THREE.Group(); group.add(body);

  const torso = new THREE.Group(); torso.position.y = 0.98; body.add(torso);
  const giBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 6, 12), matMatte(gi)); giBody.scale.set(1.16, 1, 0.72); giBody.position.y = 0.32; giBody.castShadow = true; torso.add(giBody);
  const collar = part(new THREE.BoxGeometry(0.16, 0.24, 0.06), matMatte(under), 0, 0.46, 0.16); collar.rotation.x = -0.12; torso.add(collar);
  torso.add(part(new THREE.BoxGeometry(0.5, 0.13, 0.42), matMatte(under), 0, 0.06, 0));
  const sh = part(new THREE.CapsuleGeometry(0.115, 0.44, 4, 8), matMatte(gi), 0, 0.52, 0); sh.rotation.z = Math.PI / 2; sh.scale.set(1, 1, 0.8); torso.add(sh);

  const head = new THREE.Group(); head.position.y = 0.9; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), matMatte(skin)); skull.scale.set(0.95, 1.08, 0.95); skull.castShadow = true; head.add(skull);
  head.add(buildHair(hair));
  const eM = matMatte(0x1a1a1a); const eL = part(new THREE.SphereGeometry(0.026, 6, 6), eM, -0.067, 0, 0.18), eR = part(new THREE.SphereGeometry(0.026, 6, 6), eM, 0.067, 0, 0.18); eL.scale.set(1, 1.4, 1); eR.scale.set(1, 1.4, 1); head.add(eL, eR);
  torso.add(part(new THREE.CylinderGeometry(0.085, 0.1, 0.16, 8), matMatte(skin), 0, 0.66, 0));

  // back holster anchor
  const backAnchor = new THREE.Group(); backAnchor.position.set(0, 0.3, -0.22); torso.add(backAnchor);

  function buildArm(side) {
    const a = new THREE.Group();                                  // shoulder
    a.add(part(new THREE.CapsuleGeometry(0.072, 0.24, 4, 8), matMatte(gi), 0, -0.14, 0));   // upper arm
    const elbow = new THREE.Group(); elbow.position.y = -0.32; a.add(elbow);
    elbow.add(part(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), matMatte(skin), 0, -0.14, 0)); // forearm
    elbow.add(part(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), matMatte(under), 0, -0.03, 0));
    elbow.add(part(new THREE.SphereGeometry(0.066, 8, 8), matMatte(skin), 0, -0.28, 0));     // hand
    a.position.set(side * 0.3, 1.52, 0.02); a.userData.elbow = elbow; return a;
  }
  const armL = buildArm(-1), armR = buildArm(1); body.add(armL, armR);

  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.add(part(new THREE.CapsuleGeometry(0.095, 0.32, 4, 8), matMatte(gi), 0, -0.2, 0));   // thigh
    const knee = new THREE.Group(); knee.position.y = -0.4; hip.add(knee);
    knee.add(part(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), matMatte(gi), 0, -0.18, 0));   // shin
    knee.add(part(new THREE.CylinderGeometry(0.088, 0.088, 0.06, 10), matMatte(trim), 0, -0.02, 0));
    knee.add(part(new THREE.BoxGeometry(0.16, 0.13, 0.27), matMatte(boot), 0, -0.42, 0.05));  // boot
    hip.position.set(side * 0.12, 0.98, 0); hip.userData.knee = knee; return hip;
  }
  const legL = buildLeg(-1), legR = buildLeg(1); body.add(legL, legR);

  const handAnchor = new THREE.Group(); handAnchor.position.set(0.16, 1.26, 0.38); body.add(handAnchor);
  return { group, parts: { body, torso, head, armL, armR, legL, legR, handAnchor, backAnchor }, phase: 0 };
}

const setLeg = (hip, hr, kr, dt, r = 12) => { hip.rotation.x = lerpN(hip.rotation.x, hr, dt, r); hip.userData.knee.rotation.x = lerpN(hip.userData.knee.rotation.x, kr, dt, r); };
const setArm = (arm, sx, sz, ex, dt, r = 10) => { arm.rotation.x = lerpN(arm.rotation.x, sx, dt, r); arm.rotation.z = lerpN(arm.rotation.z, sz, dt, r); arm.userData.elbow.rotation.x = lerpN(arm.userData.elbow.rotation.x, ex, dt, r); };

// legs/body/head (+ arms only when armsFree, e.g. bots)
function poseAvatar(a, state, dt, armsFree = true) {
  const P = a.parts, kL = P.legL.userData.knee, kR = P.legR.userData.knee;
  let bodyY = 0, bodyX = 0, torsoX = 0;
  if (state === 'walk' || state === 'sprint') {
    const spd = state === 'sprint' ? 15 : 10.5, amp = state === 'sprint' ? 0.8 : 0.5; a.phase += dt * spd; const s = Math.sin(a.phase) * amp;
    P.legL.rotation.x = s; P.legR.rotation.x = -s; kL.rotation.x = Math.max(0, -s) * 0.95; kR.rotation.x = Math.max(0, s) * 0.95;
    if (armsFree) { setArm(P.armL, -s * 0.9, 0, 0.4, dt, 9); setArm(P.armR, s * 0.9, 0, 0.4, dt, 9); }
    bodyX = state === 'sprint' ? -0.22 : -0.06;
  } else if (state === 'jump') { setLeg(P.legL, -0.7, 1.0, dt, 12); setLeg(P.legR, -0.5, 0.8, dt, 12); if (armsFree) { setArm(P.armL, -0.5, 0, 0.5, dt, 12); setArm(P.armR, -0.4, 0, 0.5, dt, 12); } }
  else if (state === 'land') { setLeg(P.legL, -0.95, 1.6, dt, 16); setLeg(P.legR, -0.95, 1.6, dt, 16); bodyY = -0.26; if (armsFree) setArm(P.armL, -0.3, 0, 0.6, dt, 12); }
  else if (state === 'crouch') { setLeg(P.legL, -0.95, 1.55, dt, 12); setLeg(P.legR, -0.95, 1.55, dt, 12); bodyY = -0.24; if (armsFree) { setArm(P.armL, -0.15, 0, 0.4, dt, 10); setArm(P.armR, -0.2, 0, 0.4, dt, 10); } }
  else if (state === 'slide') { setLeg(P.legL, -1.0, 0.25, dt, 12); setLeg(P.legR, -0.4, 1.5, dt, 12); bodyY = -0.2; bodyX = -0.5; torsoX = -0.1; lerpRot(P.head, 'x', 0.2, dt, 10); if (armsFree) setArm(P.armL, -0.5, 0, 0.7, dt, 10); }
  else if (state === 'climb') { setLeg(P.legL, -0.6, 1.2, dt, 12); setLeg(P.legR, -0.4, 1.3, dt, 12); if (armsFree) { setArm(P.armL, -2.5, 0, 0.5, dt, 12); setArm(P.armR, -2.3, 0, 0.5, dt, 12); } bodyX = 0.3; }
  else { a.phase += dt * 2; setLeg(P.legL, 0, 0, dt, 8); setLeg(P.legR, 0, 0, dt, 8); if (armsFree) { setArm(P.armL, 0, 0, 0.35, dt, 8); setArm(P.armR, 0, 0, 0.35, dt, 8); } bodyX = Math.sin(a.phase) * 0.02; }
  P.body.position.y = lerpN(P.body.position.y, bodyY, dt, 12); P.body.rotation.x = lerpN(P.body.rotation.x, bodyX, dt, 10); P.torso.rotation.x = lerpN(P.torso.rotation.x, torsoX, dt, 8);
  if (state !== 'slide') lerpRot(P.head, 'x', 0, dt, 8);
}

// ============================================================
//  Player
// ============================================================
const avatar = buildAvatar();
const player = avatar.group; const handAnchor = avatar.parts.handAnchor;
player.scale.setScalar(1.16); player.position.set(0, 0, 18); scene.add(player);
const EYE = 1.78;

// ============================================================
//  Weapons
// ============================================================
function buildKatana() {
  const g = new THREE.Group();
  const blade = part(new THREE.BoxGeometry(0.04, 1.05, 0.015), matMetal(0xe9eef5), 0, 0.62, 0); blade.geometry.translate(0, 0, 0); g.add(blade);
  g.add(part(new THREE.BoxGeometry(0.05, 0.14, 0.02), matMetal(0xf6f9fd), 0, 1.16, 0));         // angled tip
  g.add(part(new THREE.BoxGeometry(0.17, 0.035, 0.06), matMatte(0x1f1f1f), 0, 0.08, 0));        // tsuba
  g.add(part(new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8), matMatte(0x7a1f1f), 0, -0.07, 0)); // wrapped grip
  g.userData.muzzle = 0; return g;
}
function detailGun(g, bodyCol, accentCol, muzzle) {
  g.userData.muzzle = muzzle; return g;
}
function buildAK47() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.075, 0.1, 0.66), matMatte(0x4a3318), 0, 0, 0.18));     // receiver/wood
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.34), matMetal(0x232323), 0, 0.04, 0.6));   // barrel
  g.add(part(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 6), matMetal(0x111), 0, 0.04, 0.8)); // muzzle brake
  g.add(part(new THREE.BoxGeometry(0.06, 0.26, 0.13), matMatte(0x2a2a22), 0, -0.2, 0.12));  // banana mag (angled)
  g.children[g.children.length - 1].rotation.x = -0.3;
  g.add(part(new THREE.BoxGeometry(0.05, 0.16, 0.1), matMatte(0x4a3318), 0, -0.12, -0.16)); // grip
  g.add(part(new THREE.BoxGeometry(0.05, 0.08, 0.28), matMatte(0x4a3318), 0, -0.02, -0.34)); // stock
  g.add(part(new THREE.BoxGeometry(0.02, 0.05, 0.03), matMetal(0x111), 0, 0.09, 0.42));     // sight
  return detailGun(g, 0, 0, 0.85);
}
function buildAK117() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.07, 0.1, 0.62), matMatte(0x2d3138), 0, 0, 0.18));
  g.add(part(new THREE.BoxGeometry(0.045, 0.045, 0.3), matMetal(0x4a4f57), 0, 0.03, 0.56));
  g.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), matMetal(0x222), 0, 0.03, 0.74));
  g.add(part(new THREE.BoxGeometry(0.055, 0.22, 0.1), matMatte(0x1d2025), 0, -0.17, 0.1));
  g.add(part(new THREE.BoxGeometry(0.05, 0.15, 0.1), matMatte(0x2d3138), 0, -0.11, -0.15));
  g.add(part(new THREE.BoxGeometry(0.05, 0.09, 0.26), matMatte(0x23272e), 0, -0.02, -0.32));
  g.add(part(new THREE.BoxGeometry(0.03, 0.06, 0.16), matMetal(0x111), 0, 0.1, 0.18));       // top rail/scope
  return detailGun(g, 0, 0, 0.78);
}
function buildFennec() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.065, 0.1, 0.4), matMatte(0x222222), 0, 0, 0.1));
  g.add(part(new THREE.BoxGeometry(0.04, 0.04, 0.18), matMetal(0x3a3a3a), 0, 0.025, 0.32));
  g.add(part(new THREE.BoxGeometry(0.05, 0.26, 0.07), matMatte(0x161616), 0, -0.18, 0.04));  // long mag
  g.add(part(new THREE.BoxGeometry(0.045, 0.13, 0.09), matMatte(0x222), 0, -0.1, -0.13));
  g.add(part(new THREE.BoxGeometry(0.04, 0.07, 0.14), matMatte(0x1a1a1a), 0, -0.01, -0.26));
  return detailGun(g, 0, 0, 0.44);
}
// EHP target ≈ 200 (100 HP + 100 armor). dmg interpolates near→far over rNear..rFar.
const WEAPONS = {
  katana: { name: 'Katana', label: '🗡 Katana', type: 'melee', build: buildKatana },
  ak47:   { name: 'AK47',   label: '🔫 AK47',   type: 'gun', build: buildAK47,  mag: 30, reload: 2.5, rate: 0.13,  recoil: 0.028, spread: 0.012, dmgNear: 7.8,  dmgFar: 5.0, rNear: 18, rFar: 55 },
  ak117:  { name: 'AK117',  label: '🔫 AK117',  type: 'gun', build: buildAK117, mag: 30, reload: 2.5, rate: 0.075, recoil: 0.012, spread: 0.010, dmgNear: 8.3,  dmgFar: 5.2, rNear: 18, rFar: 60 },
  fennec: { name: 'Fennec', label: '🔫 Fennec', type: 'gun', build: buildFennec, mag: 25, reload: 2.0, rate: 0.05,  recoil: 0.013, spread: 0.022, dmgNear: 13.5, dmgFar: 5.0, rNear: 8,  rFar: 30 },
};
const weaponDamage = (w, d) => { const k = Math.max(0, Math.min(1, (d - w.rNear) / (w.rFar - w.rNear))); return w.dmgNear + (w.dmgFar - w.dmgNear) * k; };

const slots = [null, null];
let heldKey = 'katana', heldMesh = null, switchT = 1, pendingKey = null, muzzleZ = 0;
function spawnHeld(key) { if (heldMesh) handAnchor.remove(heldMesh); heldMesh = WEAPONS[key].build(); handAnchor.add(heldMesh); heldKey = key; muzzleZ = heldMesh.userData.muzzle || 0; reloading = 0; ammoEl.classList.remove('reloading'); updateLoadoutUI(); updateBackMounts(); updateAmmoUI(); }
function equip(key) { if (key === heldKey && switchT >= 1) return; pendingKey = key; switchT = 0; }
function tapSlot(i) { const gun = slots[i]; if (!gun) return; equip(heldKey === gun ? 'katana' : gun); }
function giveWeapon(key) { let idx = slots.indexOf(null), dropped = null; if (idx === -1) { idx = slots.indexOf(heldKey); if (idx === -1) idx = 0; dropped = slots[idx]; } slots[idx] = key; equip(key); updateLoadoutUI(); updateBackMounts(); return dropped; }

// back holstering — show unequipped weapons on the back
function updateBackMounts() {
  const back = avatar.parts.backAnchor; while (back.children.length) back.remove(back.children[0]);
  const addGun = (key, xo, rz) => { if (!key || key === heldKey) return; const m = WEAPONS[key].build(); m.scale.setScalar(0.78); m.position.set(xo, 0.06, -0.05); m.rotation.set(Math.PI / 2, 0, rz); back.add(m); };
  addGun(slots[0], -0.13, 0.22); addGun(slots[1], 0.13, -0.22);
  if (heldKey !== 'katana') { const k = WEAPONS.katana.build(); k.scale.setScalar(0.8); k.position.set(-0.02, 0.16, -0.06); k.rotation.set(0.1, 0, 0.7); back.add(k); }
}

// floor guns
const floorGuns = [];
function dropGun(key, x, z) { const g = WEAPONS[key].build(); g.scale.setScalar(1.1); g.position.set(x, 0.5, z); g.rotation.z = Math.PI / 2; const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z); scene.add(g); scene.add(ring); floorGuns.push({ key, mesh: g, ring, x, z }); }
dropGun('ak47', 4, 10); dropGun('ak117', -10, 2); dropGun('fennec', 9, -6);

// ============================================================
//  Bots — weaponless test dummies
// ============================================================
const bots = [];
function spawnBot(x, z) {
  const a = buildAvatar({ gi: 0x444a55, trim: 0x2c3038, under: 0x882a2a, hair: 0x141414, skin: 0xc9966b, boot: 0x202020 });
  a.group.scale.setScalar(1.16); a.group.position.set(x, 0, z);
  a.parts.handAnchor.add(buildAK47());                       // bots are armed now
  scene.add(a.group);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 16), new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  bots.push({ av: a, pos: a.group.position, vy: 0, onGround: true, state: 'idle', stateT: 0, dir: Math.random() * 6.28, hp: 100, hitFlash: 0, dead: false, home: { x, z }, alert: 0, fireCD: 0, footRing: ring, safe: false });
}
spawnBot(-4, -6); spawnBot(12, 8); spawnBot(-12, 12);

// spawn safe zone: bullet-proof, no shooting in/out, auto-eject after 30s, no re-entry
const safeZone = { x: 0, z: 18, r: 4.4, active: true, t: 0 };
const safeDome = new THREE.Mesh(new THREE.SphereGeometry(safeZone.r, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
safeDome.position.set(safeZone.x, 0, safeZone.z); scene.add(safeDome);
function killBot(b) { b.dead = true; b.av.group.visible = false; b.footRing.visible = false; b.alert = 0; setTimeout(() => { b.hp = 100; b.dead = false; b.av.group.visible = true; b.pos.set(b.home.x + (Math.random() - 0.5) * 8, 0, b.home.z + (Math.random() - 0.5) * 8); b.state = 'idle'; b.stateT = 0; }, 2500); }

// segment blocked by any container (line-of-sight test)
function segBlocked(ox, oy, oz, tx, ty, tz) {
  const dx = tx - ox, dy = ty - oy, dz = tz - oz, dist = Math.hypot(dx, dy, dz); if (dist < 0.001) return false;
  const nx = dx / dist, ny = dy / dist, nz = dz / dist;
  for (const c of colliders) {
    let tmin = 0, tmax = dist;
    if (Math.abs(nx) < 1e-6) { if (ox < c.x - c.hx || ox > c.x + c.hx) continue; } else { let t1 = (c.x - c.hx - ox) / nx, t2 = (c.x + c.hx - ox) / nx; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
    if (Math.abs(ny) < 1e-6) { if (oy < 0 || oy > c.top) continue; } else { let t1 = (0 - oy) / ny, t2 = (c.top - oy) / ny; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
    if (Math.abs(nz) < 1e-6) { if (oz < c.z - c.hz || oz > c.z + c.hz) continue; } else { let t1 = (c.z - c.hz - oz) / nz, t2 = (c.z + c.hz - oz) / nz; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
    if (tmin > 0.3 && tmin < dist - 0.6) return true;
  }
  return false;
}
function botShoot(b, dist) {
  const muzzle = new THREE.Vector3(b.pos.x, b.pos.y + 1.45, b.pos.z);
  const sp = (0.03 + dist * 0.003) * dist;
  const tgt = new THREE.Vector3(player.position.x + (Math.random() - 0.5) * sp, player.position.y + 1.3 + (Math.random() - 0.5) * sp, player.position.z + (Math.random() - 0.5) * sp);
  const dir = tgt.clone().sub(muzzle).normalize(); const hit = rayHit(muzzle, dir, 45);
  spawnTracer(muzzle, hit.point);
  const acc = Math.max(0.12, 0.5 - dist * 0.012);
  if (!inSafeZone && Math.random() < acc && !segBlocked(muzzle.x, muzzle.y, muzzle.z, player.position.x, player.position.y + 1.3, player.position.z)) damagePlayer(6);
}
function updateBot(b, dt) {
  if (b.dead) return;
  const dpx = player.position.x - b.pos.x, dpz = player.position.z - b.pos.z, distP = Math.hypot(dpx, dpz);
  const sees = !inSafeZone && distP < 30 && !segBlocked(b.pos.x, b.pos.y + 1.5, b.pos.z, player.position.x, player.position.y + 1.4, player.position.z);
  if (sees) b.alert = 2.8; else if (b.alert > 0) b.alert -= dt;

  if (b.alert > 0) {                                  // chase & attack the player it has seen
    const ang = Math.atan2(dpx, dpz); b.av.group.rotation.y += (ang - b.av.group.rotation.y) * Math.min(1, dt * 8);
    if (distP > 9) { b.pos.x += Math.sin(ang) * 6 * dt; b.pos.z += Math.cos(ang) * 6 * dt; b.state = 'sprint'; } else b.state = 'idle';
    b.fireCD -= dt; if (sees && b.fireCD <= 0 && distP < 28) { b.fireCD = 0.16 + Math.random() * 0.12; botShoot(b, distP); }
  } else {                                            // wander / search
    b.stateT -= dt;
    if (b.stateT <= 0 && b.onGround) { const r = Math.random(); if (r < 0.4) { b.state = 'idle'; b.stateT = 0.8 + Math.random(); } else { b.state = 'walk'; b.stateT = 1.2 + Math.random() * 1.5; b.dir = Math.random() * 6.28; } }
    if (b.state === 'walk') { b.pos.x += Math.sin(b.dir) * 2.6 * dt; b.pos.z += Math.cos(b.dir) * 2.6 * dt; b.av.group.rotation.y += (b.dir - b.av.group.rotation.y) * Math.min(1, dt * 8); }
  }
  b.vy -= 20 * dt; b.pos.y += b.vy * dt; const fl = groundHeightAt(b.pos.x, b.pos.z);
  if (b.pos.y <= fl) { b.pos.y = fl; b.vy = 0; b.onGround = true; } else b.onGround = false;
  resolveCollisions(b.pos); b.pos.x = Math.max(-29, Math.min(29, b.pos.x)); b.pos.z = Math.max(-29, Math.min(29, b.pos.z));
  poseAvatar(b.av, b.onGround ? b.state : 'jump', dt, true);
  if (b.hitFlash > 0) { b.hitFlash -= dt; b.av.parts.torso.children[0].material.emissive?.setScalar(Math.max(0, b.hitFlash)); }
  b.footRing.visible = distP < 8 && (b.state === 'walk' || b.state === 'sprint');   // footsteps only when close
  if (b.footRing.visible) { b.footRing.position.set(b.pos.x, 0.05, b.pos.z); b.footRing.material.opacity = 0.4 + Math.sin(now() / 120) * 0.3; }
}

// ============================================================
//  Camera / look (delta-based, no drift)
// ============================================================
const cam = { yaw: Math.PI, pitch: 0.02, dist: 4.6 };
const LOOK_X = 0.0115, LOOK_Y = 0.0095;
let recoilPitch = 0, recoilYaw = 0;
function applyLook(dx, dy) { cam.yaw -= dx * LOOK_X; cam.pitch -= dy * LOOK_Y; cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch)); }

// move joystick (fixed centre)
function createJoystick(zoneId, knobId) {
  const zone = document.getElementById(zoneId), knob = document.getElementById(knobId); const st = { x: 0, y: 0, mag: 0, id: null }; const radius = 46;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const reset = () => { st.x = st.y = st.mag = 0; st.id = null; zone.classList.remove('active'); setKnob(0, 0); };
  const move = (cx, cy) => { const r = zone.getBoundingClientRect(); let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2); const len = Math.hypot(dx, dy); if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; } setKnob(dx, dy); st.x = dx / radius; st.y = dy / radius; st.mag = Math.min(1, len / radius); };
  const start = (id, cx, cy) => { st.id = id; zone.classList.add('active'); move(cx, cy); };
  zone.addEventListener('touchstart', (e) => { if (document.body.classList.contains('hud-editing')) return; e.preventDefault(); const t = e.changedTouches[0]; start(t.identifier, t.clientX, t.clientY); }, { passive: false });
  zone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === st.id) move(t.clientX, t.clientY); }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === st.id) reset(); };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  zone.addEventListener('mousedown', (e) => { if (document.body.classList.contains('hud-editing')) return; start('mouse', e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (st.id === 'mouse') move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (st.id === 'mouse') reset(); });
  return st;
}
const moveStick = createJoystick('move-zone', 'move-knob');

// LOOK: touch anywhere on the RIGHT HALF of the canvas; pure delta; resets on release
let lookId = null, lastLX = 0, lastLY = 0;
window.addEventListener('touchstart', (e) => { if (document.body.classList.contains('hud-editing')) return; for (const t of e.changedTouches) if (t.target === canvas && lookId === null && t.clientX > window.innerWidth * 0.5) { lookId = t.identifier; lastLX = t.clientX; lastLY = t.clientY; } }, { passive: true });
window.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) { applyLook(t.clientX - lastLX, t.clientY - lastLY); lastLX = t.clientX; lastLY = t.clientY; } }, { passive: true });
const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
window.addEventListener('touchend', endLook); window.addEventListener('touchcancel', endLook);
let mouseLook = false;
canvas.addEventListener('mousedown', (e) => { if (e.clientX > window.innerWidth * 0.5) { mouseLook = true; lastLX = e.clientX; lastLY = e.clientY; } });
window.addEventListener('mousemove', (e) => { if (mouseLook) { applyLook(e.clientX - lastLX, e.clientY - lastLY); lastLX = e.clientX; lastLY = e.clientY; } });
window.addEventListener('mouseup', () => { mouseLook = false; });

// ============================================================
//  Movement / actions
// ============================================================
const vel = new THREE.Vector3();
let verticalVel = 0, onGround = true, sliding = false, slideTime = 0;
let firing = false, climbing = false, riding = null, crouching = false, landTimer = 0, mantling = null;
const WALK = 4.6, SPRINT = 8.8, MANTLE_MAX = 2.7;

function tryMantle() {
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);   // climb toward where you look
  const ax = player.position.x + fx * 0.8, az = player.position.z + fz * 0.8; let target = null;
  for (const c of colliders) if (c.climb && ax > c.x - c.hx && ax < c.x + c.hx && az > c.z - c.hz && az < c.z + c.hz && c.top > player.position.y + 0.4 && c.top <= player.position.y + MANTLE_MAX) { if (!target || c.top > target.top) target = c; }
  if (!target) return false;
  const from = player.position.clone();
  // phase 1: reach + rise to the ledge, phase 2: pull forward onto the top
  mantling = { t: 0, dur: 0.62, p0: from, p1: new THREE.Vector3(from.x, target.top + 0.15, from.z), p2: new THREE.Vector3(from.x + fx * 1.25, target.top, from.z + fz * 1.25) };
  player.rotation.y = Math.atan2(fx, fz);   // face the wall
  return true;
}
function jump() {
  if (riding) { riding = null; verticalVel = 2; return; } if (mantling) return;
  if (climbing) { climbing = false; verticalVel = 5; return; }
  if (!onGround) return; if (tryMantle()) return;
  verticalVel = 7.4; onGround = false; if (sliding) { sliding = false; vel.multiplyScalar(1.12); }
}
function startSlideOrCrouch() { if (!onGround || sliding || mantling) return; if (moveStick.mag > 0.25) { sliding = true; slideTime = 0; crouching = false; const f = Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw)); vel.set(Math.sin(f), 0, Math.cos(f)).multiplyScalar(15); } else crouching = !crouching; }
const bind = (id, fn) => { const el = document.getElementById(id); el.addEventListener('touchstart', (e) => { if (document.body.classList.contains('hud-editing')) return; e.preventDefault(); fn(); }, { passive: false }); el.addEventListener('click', (e) => { if (document.body.classList.contains('hud-editing')) return; fn(); }); };
bind('btn-jump', jump); bind('btn-slide', startSlideOrCrouch); bind('btn-reload', startReload); bind('btn-heal', startHeal);
document.getElementById('slot-0').addEventListener('click', () => { if (!document.body.classList.contains('hud-editing')) tapSlot(0); });
document.getElementById('slot-1').addEventListener('click', () => { if (!document.body.classList.contains('hud-editing')) tapSlot(1); });

// FIRE button: hold to fire, drag to aim (pure delta — no drift/acceleration)
(function () {
  const zone = document.getElementById('fire-zone'); let fid = null, fx = 0, fy = 0;
  const start = (id, x, y) => { if (document.body.classList.contains('hud-editing')) return; fid = id; fx = x; fy = y; firing = true; zone.classList.add('active'); };
  const move = (x, y) => { applyLook(x - fx, y - fy); fx = x; fy = y; };
  const end = () => { fid = null; firing = false; zone.classList.remove('active'); };
  zone.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; start(t.identifier, t.clientX, t.clientY); }, { passive: false });
  zone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === fid) move(t.clientX, t.clientY); }, { passive: false });
  const te = (e) => { for (const t of e.changedTouches) if (t.identifier === fid) end(); };
  zone.addEventListener('touchend', te); zone.addEventListener('touchcancel', te);
  zone.addEventListener('mousedown', (e) => { start('m', e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (fid === 'm') move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (fid === 'm') end(); });
})();

// pickup
let nearGun = null; const pickupBtn = document.getElementById('pickup-prompt');
function doPickup() { if (!nearGun) return; const dropped = giveWeapon(nearGun.key); scene.remove(nearGun.mesh); scene.remove(nearGun.ring); const i = floorGuns.indexOf(nearGun); if (i >= 0) floorGuns.splice(i, 1); nearGun = null; if (dropped) dropGun(dropped, player.position.x + 1, player.position.z); pickupBtn.classList.add('hidden'); }
pickupBtn.addEventListener('click', doPickup); pickupBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doPickup(); }, { passive: false });

// ============================================================
//  Energy Shield Wall — 3 charges
// ============================================================
function shieldTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(40,160,210,0.15)'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(150,235,255,0.85)'; ctx.lineWidth = 2;
  const s = 22; for (let y = -s; y < 140; y += s * 0.75) for (let x = -s; x < 140; x += s) { const ox = (Math.round(y / (s * 0.75)) % 2) * (s / 2); ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; const px = x + ox + Math.cos(a) * s * 0.5, py = y + Math.sin(a) * s * 0.5; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// White, opaque, curved battlement wall — concave side faces the player who dropped it.
function buildGloo(W, H) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf3f6fb, roughness: 0.55, metalness: 0.04, emissive: 0x7fc4e6, emissiveIntensity: 0.12 });
  const N = 7, curve = 0.55, pw = W / N + 0.06;
  for (let i = 0; i < N; i++) {
    const fx = i / (N - 1) - 0.5, x = fx * W, z = -curve * (1 - (2 * fx) * (2 * fx));   // parabola bulges away (+z faces player)
    const p = new THREE.Mesh(new THREE.BoxGeometry(pw, H, 0.3), mat); p.position.set(x, 0, z); p.rotation.y = fx * 0.55; p.castShadow = true; p.receiveShadow = true; g.add(p);
    if (i % 2 === 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.78, 0.5, 0.32), mat); m.position.set(x, H / 2 + 0.25, z); m.rotation.y = fx * 0.55; m.castShadow = true; g.add(m); }   // merlon teeth -> M battlement
  }
  g.userData.mat = mat;
  return g;
}
const glooWalls = []; let glooCooldown = 0;
const glooBtn = document.getElementById('btn-shield');
const glooPips = [...document.querySelectorAll('#gloo-charges .charge')];
const glooRechargeEl = document.getElementById('gloo-recharge');
function removeGloo(wall) { scene.remove(wall.mesh); const ci = colliders.indexOf(wall.col); if (ci >= 0) colliders.splice(ci, 1); const wi = glooWalls.indexOf(wall); if (wi >= 0) glooWalls.splice(wi, 1); }
function breakGloo(col) { const w = glooWalls.find((g) => g.col === col); if (w) { removeGloo(w); updateGlooUI(); } }
function deployGloo() {
  if (mantling || riding || glooCooldown > 0) return; glooCooldown = 0.6;
  if (glooWalls.length >= 3) removeGloo(glooWalls[0]);     // FIFO: dropping a 4th removes the oldest
  const f = cam.yaw, fx = -Math.sin(f), fz = -Math.cos(f);
  const wx = player.position.x + fx * 2.6, wz = player.position.z + fz * 2.6;
  const W = 5.2, H = 2.7, D = 1.3; const g = buildGloo(W, H);
  g.position.set(wx, 0.05, wz);
  g.rotation.y = Math.atan2(fx, fz);     // convex faces the enemy; concave cups the player who placed it
  g.scale.set(1, 0.04, 1); scene.add(g);
  const hx = Math.abs(Math.cos(f)) * W / 2 + Math.abs(Math.sin(f)) * D / 2, hz = Math.abs(Math.sin(f)) * W / 2 + Math.abs(Math.cos(f)) * D / 2;
  const col = { x: wx, z: wz, hx, hz, top: H, gloo: true, hp: 40 }; colliders.push(col);   // ~mag+10 bullets to break
  glooWalls.push({ mesh: g, col, life: 30, t: 0, H }); updateGlooUI();
}
bind('btn-shield', deployGloo);
function updateGlooUI() { glooPips.forEach((p, i) => p.classList.toggle('empty', i >= glooWalls.length)); glooRechargeEl.textContent = glooWalls.length + '/3'; }

// ============================================================
//  Loadout + Health UI
// ============================================================
function updateLoadoutUI() { for (let i = 0; i < 2; i++) { const el = document.getElementById('slot-' + i); const key = slots[i]; el.querySelector('.wname').textContent = key ? WEAPONS[key].label : '— empty —'; el.classList.toggle('empty', !key); el.classList.toggle('active', !!key && heldKey === key); } document.getElementById('melee-ind').classList.toggle('active', heldKey === 'katana'); document.getElementById('crosshair').classList.toggle('show', WEAPONS[heldKey].type === 'gun'); }
let playerHP = 100, playerArmor = 100, plates = 3, healing = 0, hpRegenT = 0, lastDamage = -9999;
const hpFill = document.getElementById('hp-fill'), hpGhost = document.getElementById('hp-ghost'), hpVal = document.getElementById('hp-val'), lowhp = document.getElementById('lowhp');
const arFill = document.getElementById('ar-fill'), platesEl = document.getElementById('plates'), healBtn = document.getElementById('btn-heal');
function damagePlayer(a) { if (inSafeZone) return; let rem = a; const ab = Math.min(playerArmor, rem); playerArmor -= ab; rem -= ab; playerHP = Math.max(0, playerHP - rem); lastDamage = now(); if (playerHP <= 0) respawnPlayer(); }
function respawnPlayer() { playerHP = 100; playerArmor = 100; plates = 3; player.position.set(0, 0, 18); vel.set(0, 0, 0); verticalVel = 0; }
function startHeal() { if (plates <= 0 || healing > 0) return; healing = 2; healBtn.classList.add('busy'); }      // 2s per plate
function updateHealthUI() {
  hpFill.style.width = playerHP + '%'; hpGhost.style.width = playerHP + '%'; hpVal.textContent = Math.round(playerHP);
  hpFill.classList.toggle('warn', playerHP <= 50 && playerHP > 25); hpFill.classList.toggle('crit', playerHP <= 25); lowhp.classList.toggle('show', playerHP <= 30);
  arFill.style.width = playerArmor + '%'; platesEl.textContent = '▮'.repeat(plates) + '▯'.repeat(3 - plates);
}

// ammo / reload
const ammo = { ak47: 30, ak117: 30, fennec: 25 }; let reloading = 0;
const ammoEl = document.getElementById('ammo');
function startReload() { const w = WEAPONS[heldKey]; if (w.type !== 'gun' || reloading > 0 || ammo[heldKey] >= w.mag) return; reloading = w.reload; ammoEl.classList.add('reloading'); }
function updateAmmoUI() { const w = WEAPONS[heldKey]; if (w.type !== 'gun') { ammoEl.style.display = 'none'; return; } ammoEl.style.display = 'block'; document.getElementById('ammo-cur').textContent = ammo[heldKey]; document.getElementById('ammo-max').textContent = w.mag; }

// ============================================================
//  Collisions
// ============================================================
const PLAYER_R = 0.45;
function resolveCollisions(pos) { for (const c of colliders) { if (pos.y > c.top - 0.1) continue; const minX = c.x - c.hx - PLAYER_R, maxX = c.x + c.hx + PLAYER_R, minZ = c.z - c.hz - PLAYER_R, maxZ = c.z + c.hz + PLAYER_R; if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) { const pl = pos.x - minX, pr = maxX - pos.x, pf = pos.z - minZ, pb = maxZ - pos.z, m = Math.min(pl, pr, pf, pb); if (m === pl) pos.x = minX; else if (m === pr) pos.x = maxX; else if (m === pf) pos.z = minZ; else pos.z = maxZ; } } }
function groundHeightAt(x, z) { let h = 0; for (const c of colliders) if (x > c.x - c.hx && x < c.x + c.hx && z > c.z - c.hz && z < c.z + c.hz && c.top > h) h = c.top; return h; }

// ============================================================
//  Combat effects (pooled)
// ============================================================
const tracerGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6); tracerGeo.rotateX(Math.PI / 2);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }); const tracers = [];
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); muzzleFlash.visible = false; muzzleFlash.scale.set(1, 1, 1.8); scene.add(muzzleFlash); let flashTime = 0;
const shellGeo = new THREE.BoxGeometry(0.05, 0.05, 0.11), shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.8, roughness: 0.3 }); const shells = [];
const sparkGeo = new THREE.SphereGeometry(0.05, 4, 4), sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); const sparks = [];
function spawnTracer(from, to) { let t = tracers.find((x) => !x.mesh.visible); if (!t) { t = { mesh: new THREE.Mesh(tracerGeo, tracerMat.clone()) }; scene.add(t.mesh); tracers.push(t); } t.mesh.visible = true; t.from = from.clone(); t.to = to.clone(); t.len = t.from.distanceTo(t.to); t.head = 0; t.speed = 200; }
function spawnImpact(p, n) { for (let i = 0; i < 5; i++) { let s = sparks.find((x) => !x.mesh.visible); if (!s) { s = { mesh: new THREE.Mesh(sparkGeo, sparkMat.clone()), vel: new THREE.Vector3() }; scene.add(s.mesh); sparks.push(s); } s.mesh.visible = true; s.mesh.position.copy(p); s.mesh.material.opacity = 1; s.vel.set((Math.random() - 0.5) * 4 + n.x * 2, Math.random() * 3 + 1, (Math.random() - 0.5) * 4 + n.z * 2); s.life = 0.35; } }
function ejectShell(o, right) { let s = shells.find((x) => !x.mesh.visible); if (!s) { s = { mesh: new THREE.Mesh(shellGeo, shellMat), vel: new THREE.Vector3(), spin: new THREE.Vector3() }; scene.add(s.mesh); shells.push(s); } s.mesh.visible = true; s.mesh.position.copy(o); s.vel.set(right.x * 2 + (Math.random() - 0.5), 2.5 + Math.random(), right.z * 2 + (Math.random() - 0.5)); s.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); s.life = 1.1; }

// katana slash + trail
let slashT = 1;
const slashTrail = new THREE.Mesh(new THREE.RingGeometry(0.55, 1.45, 18, 1, -0.5, 1.7), new THREE.MeshBasicMaterial({ color: 0xaef0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
slashTrail.position.set(0.15, 1.3, 0.55); slashTrail.rotation.y = Math.PI / 2; player.add(slashTrail);
function startSlash() { if (slashT < 1) return; slashT = 0; const fx = Math.sin(player.rotation.y), fz = Math.cos(player.rotation.y); for (const b of bots) { if (b.dead) continue; const dx = b.pos.x - player.position.x, dz = b.pos.z - player.position.z, d = Math.hypot(dx, dz); if (d > 2.6) continue; if ((dx / d) * fx + (dz / d) * fz > 0.4) { b.hp -= 55; b.hitFlash = 0.6; b.pos.x += fx * 0.5; b.pos.z += fz * 0.5; if (b.hp <= 0) killBot(b); } } }

// ray vs world
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
function rayHit(origin, dir, maxDist = 200) {
  let best = maxDist, point = null; const normal = new THREE.Vector3(0, 1, 0); let bot = null, hcol = null;
  if (dir.y < -1e-4) { const t = -origin.y / dir.y; if (t > 0 && t < best) { best = t; point = origin.clone().addScaledVector(dir, t); normal.set(0, 1, 0); } }
  for (const c of colliders) {
    const minX = c.x - c.hx, maxX = c.x + c.hx, minZ = c.z - c.hz, maxZ = c.z + c.hz, minY = 0, maxY = c.top; let tmin = 0, tmax = best, nx = 0, ny = 0, nz = 0;
    if (Math.abs(dir.x) < 1e-6) { if (origin.x < minX || origin.x > maxX) continue; } else { let t1 = (minX - origin.x) / dir.x, t2 = (maxX - origin.x) / dir.x, s = -1; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; } if (t1 > tmin) { tmin = t1; nx = s; ny = nz = 0; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
    if (Math.abs(dir.y) < 1e-6) { if (origin.y < minY || origin.y > maxY) continue; } else { let t1 = (minY - origin.y) / dir.y, t2 = (maxY - origin.y) / dir.y, s = -1; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = s; nz = 0; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
    if (Math.abs(dir.z) < 1e-6) { if (origin.z < minZ || origin.z > maxZ) continue; } else { let t1 = (minZ - origin.z) / dir.z, t2 = (maxZ - origin.z) / dir.z, s = -1; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = 0; nz = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
    if (tmin > 0 && tmin < best) { best = tmin; point = origin.clone().addScaledVector(dir, tmin); normal.set(nx, ny, nz); bot = null; hcol = c; }
  }
  for (const b of bots) { if (b.dead) continue; _ro.copy(origin).sub(b.pos); _ro.y -= 1.1; const r = 0.7; _rd.copy(dir); const proj = -_ro.dot(_rd); if (proj < 0) continue; const d2 = _ro.lengthSq() - proj * proj; if (d2 > r * r) continue; const t = proj - Math.sqrt(r * r - d2); if (t > 0 && t < best) { best = t; point = origin.clone().addScaledVector(dir, t); normal.copy(dir).multiplyScalar(-1); bot = b; hcol = null; } }
  return { dist: best, point: point || origin.clone().addScaledVector(dir, maxDist), normal, bot, col: hcol };
}

// fire
let fireCooldown = 0; const _muzzle = new THREE.Vector3(), _look = new THREE.Vector3(), _right = new THREE.Vector3();
function tryFire(dt) {
  fireCooldown -= dt; const w = WEAPONS[heldKey]; if (!firing) return;
  if (w.type === 'melee') { startSlash(); return; }
  if (inSafeZone) return;                       // no shooting from inside spawn protection
  if (switchT < 0.6 || reloading > 0) return;
  if (ammo[heldKey] <= 0) { startReload(); return; }
  if (fireCooldown > 0) return; fireCooldown = w.rate;
  ammo[heldKey]--; updateAmmoUI();
  const ty = cam.yaw + recoilYaw, tp = cam.pitch + recoilPitch, cp = Math.cos(tp);
  _look.set(-Math.sin(ty) * cp, Math.sin(tp), -Math.cos(ty) * cp).normalize(); _right.set(Math.cos(ty), 0, -Math.sin(ty));
  handAnchor.getWorldPosition(_muzzle); _muzzle.addScaledVector(_look, muzzleZ * player.scale.x + 0.1).addScaledVector(_right, 0.05);
  const dir = _look.clone(); dir.x += (Math.random() - 0.5) * w.spread; dir.y += (Math.random() - 0.5) * w.spread; dir.z += (Math.random() - 0.5) * w.spread; dir.normalize();
  const hit = rayHit(_muzzle, dir); spawnTracer(_muzzle, hit.point);
  if (hit.bot && !hit.bot.safe) { hit.bot.hp -= weaponDamage(w, hit.dist); hit.bot.hitFlash = 0.6; hit.bot.av.parts.torso.children[0].material.emissive?.setScalar(0.6); if (hit.bot.hp <= 0) killBot(hit.bot); }
  spawnImpact(hit.point, hit.normal);
  if (hit.col && hit.col.gloo) { spawnImpact(hit.point, hit.normal); hit.col.hp--; if (hit.col.hp <= 0) breakGloo(hit.col); }   // bullets bounce & chip the Gloo
  muzzleFlash.position.copy(_muzzle); muzzleFlash.visible = true; flashTime = 0.045; muzzleFlash.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1.6 + Math.random());
  ejectShell(_muzzle.clone().addScaledVector(_right, 0.1).addScaledVector(_look, -0.15), _right);
  recoilPitch += w.recoil; recoilYaw += (Math.random() - 0.5) * w.recoil * 0.6; handAnchor.position.z -= 0.06;
  if (ammo[heldKey] <= 0) startReload();        // auto-reload when the mag runs dry
}
function updateEffects(dt) {
  for (const t of tracers) { if (!t.mesh.visible) continue; t.head += t.speed * dt; const tail = Math.max(0, t.head - 6); if (tail >= t.len) { t.mesh.visible = false; continue; } const a = Math.min(t.len, t.head), b = Math.min(t.len, tail), mid = (a + b) / 2; TMP.copy(t.to).sub(t.from).normalize(); t.mesh.position.copy(t.from).addScaledVector(TMP, mid); t.mesh.scale.set(1, 1, Math.max(0.2, a - b)); t.mesh.lookAt(t.to); }
  if (muzzleFlash.visible) { flashTime -= dt; if (flashTime <= 0) muzzleFlash.visible = false; }
  for (const s of shells) { if (!s.mesh.visible) continue; s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; } s.vel.y -= 14 * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; if (s.mesh.position.y < 0.05) { s.mesh.position.y = 0.05; s.vel.set(0, 0, 0); } }
  for (const s of sparks) { if (!s.mesh.visible) continue; s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; } s.vel.y -= 12 * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.material.opacity = Math.max(0, s.life / 0.35); }
  handAnchor.position.z += (handAnchorBaseZ - handAnchor.position.z) * Math.min(1, dt * 12);
}
let handAnchorBaseZ = 0.38;

// upper-body weapon hold (two-handed, bent elbows) — player only
function poseHold(dt) {
  const aL = avatar.parts.armL, aR = avatar.parts.armR, w = WEAPONS[heldKey];
  if (switchT < 1) { setArm(aR, -0.8, -0.1, 0.7, dt, 8); setArm(aL, -0.7, 0.3, 0.8, dt, 8); return; }
  if (w.type === 'melee') {
    if (slashT < 1) { const e = slashT, sw = -1.7 + e * 2.7; setArm(aR, sw, -0.25, 0.6 + e * 0.4, dt, 18); setArm(aL, sw - 0.15, 0.5, 0.85 + e * 0.3, dt, 18); }
    else { setArm(aR, -0.65, -0.12, 1.15, dt, 8); setArm(aL, -0.5, 0.5, 1.25, dt, 8); }   // relaxed ready stance, elbows bent (not stiff)
    handAnchor.position.set(0.14, 1.0, 0.34); handAnchorBaseZ = 0.34;
    if (slashT >= 1) { handAnchor.rotation.x = lerpN(handAnchor.rotation.x, -0.4, dt, 8); handAnchor.rotation.z = lerpN(handAnchor.rotation.z, 0.3, dt, 8); }
  } else { // gun, two-handed
    setArm(aR, -1.2, -0.2, 0.95, dt, 9); setArm(aL, -1.35, 0.52, 1.15, dt, 9);
    handAnchor.position.set(0.12, 1.28, 0.42); handAnchorBaseZ = 0.42;
    handAnchor.rotation.x = lerpN(handAnchor.rotation.x, 0, dt, 9); handAnchor.rotation.z = lerpN(handAnchor.rotation.z, 0, dt, 9);
  }
}

// ============================================================
//  Game loop
// ============================================================
const clock = new THREE.Clock(); const crosshairEl = document.getElementById('crosshair');
function update(dt) {
  // spawn safe zone (bullet-proof; no shooting in/out; auto-eject after 30s; no re-entry)
  if (safeZone.active) {
    safeZone.t += dt;
    const d = Math.hypot(player.position.x - safeZone.x, player.position.z - safeZone.z);
    inSafeZone = d < safeZone.r;
    if (safeZone.t > 30 && inSafeZone) { const a = Math.atan2(player.position.x - safeZone.x, player.position.z - safeZone.z); player.position.x = safeZone.x + Math.sin(a) * (safeZone.r + 0.6); player.position.z = safeZone.z + Math.cos(a) * (safeZone.r + 0.6); inSafeZone = false; }
    if (!inSafeZone && safeZone.t > 0.6) { safeZone.active = false; safeDome.visible = false; }
  } else inSafeZone = false;

  const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw), rightX = Math.cos(cam.yaw), rightZ = -Math.sin(cam.yaw);
  let moveState = 'idle';

  if (mantling) {
    mantling.t += dt / mantling.dur; const k = Math.min(1, mantling.t);
    if (k < 0.5) { const e = (k / 0.5) * (k / 0.5); player.position.lerpVectors(mantling.p0, mantling.p1, e); }
    else { const u = (k - 0.5) / 0.5, e = 1 - (1 - u) * (1 - u); player.position.lerpVectors(mantling.p1, mantling.p2, e); }
    poseAvatar(avatar, 'climb', dt, false);
    if (k >= 1) { mantling = null; verticalVel = 0; onGround = true; }
  } else if (riding) {
    riding.t += dt / (riding.len / 9); const k = Math.min(1, riding.t); player.position.lerpVectors(riding.a, riding.b, k); poseAvatar(avatar, 'jump', dt, false); if (k >= 1) { riding = null; verticalVel = 0; }
  } else {
    const stickMag = moveStick.mag, sprinting = stickMag > 0.85 && !sliding && onGround && !crouching; let inDir = null;
    if (stickMag > 0.08 && !sliding) {
      if (crouching && stickMag > 0.3) crouching = false;
      const dx = fwdX * (-moveStick.y) + rightX * moveStick.x, dz = fwdZ * (-moveStick.y) + rightZ * moveStick.x, len = Math.hypot(dx, dz) || 1; inDir = { x: dx / len, z: dz / len };
      const tSpeed = (sprinting ? SPRINT : WALK) * (sprinting ? 1 : Math.min(1, stickMag / 0.85)) * (crouching ? 0.5 : 1);
      const acc = Math.min(1, dt * 12); vel.x += (inDir.x * tSpeed - vel.x) * acc; vel.z += (inDir.z * tSpeed - vel.z) * acc;
      moveState = crouching ? 'crouch' : (sprinting ? 'sprint' : 'walk');
    } else if (!sliding) { const dec = Math.min(1, dt * 10); vel.x += (0 - vel.x) * dec; vel.z += (0 - vel.z) * dec; moveState = crouching ? 'crouch' : 'idle'; }
    if (sliding) { slideTime += dt; vel.x *= Math.pow(0.28, dt); vel.z *= Math.pow(0.28, dt); if (slideTime >= 1.05 || (vel.x * vel.x + vel.z * vel.z) < 2.0) sliding = false; moveState = 'slide'; }

    player.position.x += vel.x * dt; player.position.z += vel.z * dt;

    climbing = false;
    for (const L of ladders) if (Math.hypot(player.position.x - L.x, player.position.z - L.z) < 1.0 && player.position.y < L.top - 0.05) { if (moveStick.mag > 0.25 || verticalVel > 0) { climbing = true; player.position.x = lerpN(player.position.x, L.x, dt, 8); player.position.z = lerpN(player.position.z, L.z, dt, 8); player.position.y += 3.4 * dt; verticalVel = 0; if (player.position.y >= L.top) { player.position.y = L.top; player.position.x -= L.nx * 0.6; player.position.z -= L.nz * 0.6; } } break; }

    // ALWAYS face where the camera looks (back to camera): swiping rotates the player,
    // the gun/face always point at the crosshair, and firing never flips the body.
    const aimRot = Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw));
    { let diff = aimRot - player.rotation.y; while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283; player.rotation.y += diff * Math.min(1, dt * 16); }

    if (!climbing) { const wasAir = !onGround; verticalVel -= 20 * dt; player.position.y += verticalVel * dt; const floor = groundHeightAt(player.position.x, player.position.z); if (player.position.y <= floor) { if (wasAir && verticalVel < -6) landTimer = 0.22; player.position.y = floor; verticalVel = 0; onGround = true; } else onGround = false; }
    resolveCollisions(player.position); player.position.x = Math.max(-29, Math.min(29, player.position.x)); player.position.z = Math.max(-29, Math.min(29, player.position.z));

    if (landTimer > 0) { landTimer -= dt; poseAvatar(avatar, 'land', dt, false); }
    else poseAvatar(avatar, climbing ? 'climb' : (onGround ? moveState : 'jump'), dt, false);
  }

  // weapon switch lower + upper-body hold
  if (switchT < 1) { switchT = Math.min(1, switchT + dt * 4.5); if (pendingKey && switchT >= 0.5) { spawnHeld(pendingKey); pendingKey = null; } const lo = switchT < 0.5 ? switchT * 2 : (1 - switchT) * 2; handAnchor.rotation.x = -lo * 1.2; }
  if (slashT < 1) { slashT = Math.min(1, slashT + dt * 3.2); const e = slashT; handAnchor.rotation.x = -0.4 + e * 1.9; handAnchor.rotation.z = 0.6 - e * 1.5; slashTrail.material.opacity = Math.sin(e * Math.PI) * 0.8; slashTrail.rotation.z = -1.2 + e * 2.4; slashTrail.visible = true; }
  else slashTrail.material.opacity = 0;
  poseHold(dt);

  tryFire(dt); updateEffects(dt);
  recoilPitch += (0 - recoilPitch) * Math.min(1, dt * 7); recoilYaw += (0 - recoilYaw) * Math.min(1, dt * 7);

  for (const b of bots) updateBot(b, dt);
  // heal plate (2s) -> restores 50 armor
  if (healing > 0) { healing -= dt; if (healing <= 0) { playerArmor = Math.min(100, playerArmor + 50); plates = Math.max(0, plates - 1); healBtn.classList.remove('busy'); } }
  // passive HP regen: +20 every 5s up to 100
  hpRegenT += dt; if (hpRegenT >= 5) { hpRegenT = 0; if (playerHP < 100 && playerHP > 0) playerHP = Math.min(100, playerHP + 20); }
  // reload timer
  if (reloading > 0) { reloading -= dt; if (reloading <= 0) { reloading = 0; ammo[heldKey] = WEAPONS[heldKey].mag; ammoEl.classList.remove('reloading'); updateAmmoUI(); } }
  updateHealthUI();

  if (glooCooldown > 0) glooCooldown -= dt;
  for (let i = glooWalls.length - 1; i >= 0; i--) {
    const g = glooWalls[i]; g.t += dt;
    if (g.t < 0.4) { const s = 1 - (1 - g.t / 0.4) * (1 - g.t / 0.4); g.mesh.scale.set(1, s, 1); g.mesh.position.y = g.H / 2 * s + 0.02; }
    else g.mesh.position.y = g.H / 2;
    if (g.mesh.userData.mat) g.mesh.userData.mat.emissiveIntensity = 0.12 + Math.sin(now() / 200 + i) * 0.06;
    if (g.t >= g.life) { removeGloo(g); updateGlooUI(); }
  }

  let best = null, bestD = 2.6;
  for (const fg of floorGuns) { fg.mesh.rotation.y += dt * 1.5; fg.mesh.position.y = 0.5 + Math.sin(now() / 400 + fg.x) * 0.08; const d = Math.hypot(player.position.x - fg.x, player.position.z - fg.z); fg.ring.material.opacity = d < 6 ? 0.7 : 0.25; if (d < bestD) { bestD = d; best = fg; } }
  nearGun = best; if (best) { pickupBtn.classList.remove('hidden'); document.getElementById('pk-name').textContent = WEAPONS[best.key].name; } else pickupBtn.classList.add('hidden');

  if (!riding && !mantling) for (const z of ziplines) if (Math.hypot(player.position.x - z.a.x, player.position.z - z.a.z) < 1.6 && Math.abs(player.position.y - (z.a.y - 1.4)) < 1.2 && verticalVel > 0.5) { riding = { a: player.position.clone(), b: z.b.clone().setY(groundHeightAt(z.b.x, z.b.z)), len: z.len, t: 0 }; break; }

  // camera
  const ty = cam.yaw + recoilYaw, tp = cam.pitch + recoilPitch, cpp = Math.cos(tp);
  _look.set(-Math.sin(ty) * cpp, Math.sin(tp), -Math.cos(ty) * cpp); _right.set(Math.cos(ty), 0, -Math.sin(ty));
  const pivotX = player.position.x + _right.x * 1.05, pivotY = player.position.y + EYE, pivotZ = player.position.z + _right.z * 1.05;
  let dist = cam.dist;
  for (let d = cam.dist; d > 0.8; d -= 0.35) { const px = pivotX - _look.x * d, py = pivotY - _look.y * d, pz = pivotZ - _look.z * d; if (py < 0.25) { dist = d; continue; } let blocked = false; for (const c of colliders) { if (px > c.x - c.hx && px < c.x + c.hx && pz > c.z - c.hz && pz < c.z + c.hz && py < c.top) { blocked = true; break; } } if (!blocked) { dist = d; break; } }
  TMP.set(pivotX - _look.x * dist, pivotY - _look.y * dist, pivotZ - _look.z * dist);
  camera.position.lerp(TMP, Math.min(1, dt * 18)); camera.lookAt(camera.position.x + _look.x, camera.position.y + _look.y, camera.position.z + _look.z);
  const sprintNow = moveStick.mag > 0.85 && !sliding && onGround && !crouching;
  camera.fov += ((sprintNow ? 72 : 64) - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
  if (WEAPONS[heldKey].type === 'gun') { const h = rayHit(camera.position, _look, 120); crosshairEl.classList.toggle('enemy', !!h.bot); }
}

// timer + loop + boot
let matchTime = 11; const timerEl = document.getElementById('timer');
setInterval(() => { matchTime = matchTime > 0 ? matchTime - 1 : 30; timerEl.textContent = '00:' + String(matchTime).padStart(2, '0'); }, 1000);
function animate() { const dt = Math.min(0.05, clock.getDelta()); update(dt); renderer.render(scene, camera); requestAnimationFrame(animate); }
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200)); resize();
async function goFullscreenLandscape() { try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) {} resize(); }
document.getElementById('fs-btn').addEventListener('click', goFullscreenLandscape);
window.addEventListener('touchend', function once() { goFullscreenLandscape(); window.removeEventListener('touchend', once); }, { once: true });

// ============================================================
//  HUD editor (local only; saved to localStorage)
// ============================================================
(function hudEditor() {
  const ids = ['move-zone', 'fire-zone', 'btn-jump', 'btn-slide', 'btn-shield', 'btn-reload', 'btn-heal', 'weapon-slots'];
  const panel = document.getElementById('hud-editor'), btn = document.getElementById('hud-edit-btn');
  const sizeEl = document.getElementById('he-size'), opEl = document.getElementById('he-opacity'), selEl = document.getElementById('he-sel');
  let editing = false, selected = null, layout = {};
  try { layout = JSON.parse(localStorage.getItem('hudLayout') || '{}'); } catch (_) { layout = {}; }
  const save = () => localStorage.setItem('hudLayout', JSON.stringify(layout));

  function applyOne(id) {
    const el = document.getElementById(id), L = layout[id]; if (!el) return;
    if (L && L.left != null) { el.style.position = 'fixed'; el.style.left = L.left + 'px'; el.style.top = L.top + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0'; el.style.transform = `scale(${L.scale || 1})`; el.style.transformOrigin = 'center'; }
    el.style.opacity = (L && L.opacity != null) ? L.opacity : '';
  }
  function applyAll() { ids.forEach(applyOne); }
  applyAll();

  function selectEl(id) {
    selected = id; ids.forEach((i) => document.getElementById(i).classList.toggle('he-selected', i === id));
    selEl.textContent = id.replace('btn-', '').replace('-zone', '').replace('-', ' ').toUpperCase();
    const L = layout[id] || {}; sizeEl.disabled = opEl.disabled = false;
    sizeEl.value = Math.round((L.scale || 1) * 100); opEl.value = Math.round((L.opacity != null ? L.opacity : 1) * 100);
  }
  sizeEl.addEventListener('input', () => { if (!selected) return; (layout[selected] = layout[selected] || {}).scale = sizeEl.value / 100; applyOne(selected); save(); });
  opEl.addEventListener('input', () => { if (!selected) return; (layout[selected] = layout[selected] || {}).opacity = opEl.value / 100; applyOne(selected); save(); });

  // drag to move
  ids.forEach((id) => {
    const el = document.getElementById(id); let dragging = false, sx, sy, ox, oy;
    const down = (x, y) => { if (!editing) return; selectEl(id); const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; sx = x; sy = y; dragging = true; el.style.position = 'fixed'; el.style.margin = '0'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; };
    const moveTo = (x, y) => { if (!dragging) return; const nx = ox + (x - sx), ny = oy + (y - sy); el.style.left = nx + 'px'; el.style.top = ny + 'px'; (layout[id] = layout[id] || {}).left = nx; layout[id].top = ny; if (layout[id].scale == null) layout[id].scale = 1; };
    const up = () => { if (dragging) { dragging = false; save(); } };
    el.addEventListener('touchstart', (e) => { if (!editing) return; e.preventDefault(); e.stopPropagation(); const t = e.touches[0]; down(t.clientX, t.clientY); }, { capture: true });
    el.addEventListener('touchmove', (e) => { if (!editing) return; e.preventDefault(); e.stopPropagation(); const t = e.touches[0]; moveTo(t.clientX, t.clientY); }, { capture: true });
    el.addEventListener('touchend', (e) => { if (!editing) return; e.stopPropagation(); up(); }, { capture: true });
    el.addEventListener('mousedown', (e) => { if (!editing) return; e.preventDefault(); e.stopPropagation(); down(e.clientX, e.clientY); }, { capture: true });
    window.addEventListener('mousemove', (e) => moveTo(e.clientX, e.clientY));
    window.addEventListener('mouseup', up);
  });

  function setEditing(on) { editing = on; document.body.classList.toggle('hud-editing', on); panel.classList.toggle('hidden', !on); ids.forEach((i) => document.getElementById(i).classList.toggle('he-editable', on)); }
  btn.addEventListener('click', () => setEditing(true));
  document.getElementById('he-done').addEventListener('click', () => { setEditing(false); selected = null; ids.forEach((i) => document.getElementById(i).classList.remove('he-selected')); });
  document.getElementById('he-reset').addEventListener('click', () => { layout = {}; save(); ids.forEach((id) => { const el = document.getElementById(id); el.style.position = el.style.margin = el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = el.style.opacity = ''; }); selEl.textContent = 'Reset to default'; sizeEl.value = 100; opEl.value = 100; });
})();

player.rotation.y = Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw));   // face forward (back to camera) at start
spawnHeld('katana'); updateLoadoutUI(); updateGlooUI(); updateHealthUI(); updateBackMounts();
requestAnimationFrame(() => { document.getElementById('loader').classList.add('hidden'); document.body.classList.add('playing'); animate(); });
