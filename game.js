import * as THREE from 'three';

// ============================================================
//  TPP — Container Warfare  (polished mobile FPS)
//  Goku avatar • aim-joystick fire • katana slash w/ trail
//  climbable map (ladders / benches / zipline) • Gloo Wall
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
const TMP = new THREE.Vector3();

// ------------------------------------------------------------
//  Lighting
// ------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 150 });
scene.add(sun);

// ------------------------------------------------------------
//  Materials helpers
// ------------------------------------------------------------
const matMetal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.6 });
const matMatte = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

// ------------------------------------------------------------
//  Ground + hazard lanes
// ------------------------------------------------------------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x9b8e72, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
function addLane(x, z, w, d) {
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xe8c93a, roughness: 1 }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(x, 0.02, z); scene.add(lane);
}
addLane(0, 0, 3, 60); addLane(0, 0, 60, 3);

// ------------------------------------------------------------
//  Map: containers, decorations, climbing
// ------------------------------------------------------------
const colliders = [];          // {x,z,hx,hz,top,gloo?}
const ladders = [];            // {x,z,top,nx,nz}
const ziplines = [];           // {a,b,len}
const CONTAINER_COLORS = [0x2f6fb0, 0xc24a2f, 0x3a8f5a, 0xc7a23a, 0x8a8f96];

function makeContainerTexture(base) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d'); const col = new THREE.Color(base);
  ctx.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`; ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 128; i += 6) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(i, 0, 3, 64); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(i + 3, 0, 2, 64); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(40,25,10,${Math.random() * 0.25})`; ctx.fillRect(Math.random() * 128, Math.random() * 64, Math.random() * 10, Math.random() * 20); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// generic solid block -> mesh + AABB collider (used for benches, fences, gates, walls)
function addBlock(x, y, z, W, H, D, ry, mat) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat);
  box.position.set(x, y + H / 2, z); box.rotation.y = ry;
  box.castShadow = true; box.receiveShadow = true; scene.add(box);
  const hx = Math.abs(Math.cos(ry)) * W / 2 + Math.abs(Math.sin(ry)) * D / 2;
  const hz = Math.abs(Math.sin(ry)) * W / 2 + Math.abs(Math.cos(ry)) * D / 2;
  colliders.push({ x, z, hx, hz, top: y + H });
  return box;
}

function addContainer(x, y, z, ry, color) {
  const W = 6, H = 2.6, D = 2.5;
  const tex = makeContainerTexture(color);
  const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.15 });
  const endMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.2 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [endMat, endMat, sideMat, sideMat, sideMat, sideMat]);
  box.position.set(x, y + H / 2, z); box.rotation.y = ry; box.castShadow = true; box.receiveShadow = true; scene.add(box);
  const hx = Math.abs(Math.cos(ry)) * W / 2 + Math.abs(Math.sin(ry)) * D / 2;
  const hz = Math.abs(Math.sin(ry)) * W / 2 + Math.abs(Math.cos(ry)) * D / 2;
  colliders.push({ x, z, hx, hz, top: y + H });
  return { x, z, top: y + H, hx, hz };
}

// Ladder rungs on the +z side of a container (so you can climb to its top)
function addLadder(x, z, top, nx, nz) {
  const g = new THREE.Group();
  const railMat = matMetal(0x9aa0a8);
  g.add(part(new THREE.BoxGeometry(0.05, top, 0.05), railMat, -0.22, top / 2, 0));
  g.add(part(new THREE.BoxGeometry(0.05, top, 0.05), railMat, 0.22, top / 2, 0));
  for (let yy = 0.3; yy < top; yy += 0.34) g.add(part(new THREE.BoxGeometry(0.5, 0.05, 0.05), railMat, 0, yy, 0));
  g.position.set(x + nx * 0.05, 0, z + nz * 0.05);
  g.rotation.y = Math.atan2(nx, nz);
  scene.add(g);
  ladders.push({ x: x + nx * 0.1, z: z + nz * 0.1, top, nx, nz });
}

// Zipline cable between two points (ride with the ZIP prompt)
function addZipline(ax, ay, az, bx, by, bz) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const len = a.distanceTo(b);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), matMetal(0x2a2a2a));
  cyl.position.copy(a).lerp(b, 0.5);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  scene.add(cyl);
  // posts
  ziplines.push({ a, b, len });
}

function buildGloo(W, H, D) {
  // chunky paneled "gloo" wall — solid, rounded blobs (not a plain box)
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, roughness: 0.35, metalness: 0.05, emissive: 0x2a86b0, emissiveIntensity: 0.35, opacity: 0.97, transparent: true });
  const cols = 3, rows = 2;
  const cw = W / cols, ch = H / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const blob = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.96, ch * 0.96, D), mat);
    // round the blobs a touch by overlaying a sphere cap
    blob.position.set(-W / 2 + cw * (c + 0.5), -H / 2 + ch * (r + 0.5), 0);
    blob.castShadow = true; g.add(blob);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(Math.min(cw, ch) * 0.42, 8, 6), mat);
    cap.position.set(blob.position.x, blob.position.y, D * 0.5);
    cap.scale.z = 0.5; g.add(cap);
  }
  // glowing rim
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, H * 1.02, D * 0.5),
    new THREE.MeshBasicMaterial({ color: 0x69d6ff, transparent: true, opacity: 0.25 }));
  g.add(rim);
  return g;
}

function buildMap() {
  let ci = 0; const pick = () => CONTAINER_COLORS[(ci++) % CONTAINER_COLORS.length];
  const tall = [];
  for (const z of [-22, -14, 14, 22]) {
    for (let x = -24; x <= 24; x += 9) {
      if (Math.random() < 0.15) continue;
      const base = addContainer(x, 0, z, 0, pick());
      if (Math.random() < 0.45) { addContainer(x, 2.6, z, 0, pick()); tall.push({ x, z, top: 5.2 }); }
    }
  }
  addContainer(-8, 0, -4, Math.PI / 2, pick());
  addContainer(8, 0, 4, Math.PI / 2, pick());
  addContainer(-6, 0, 7, 0, pick());
  addContainer(7, 0, -7, 0, pick());
  addContainer(0, 0, -9, Math.PI / 2, pick());
  const towerA = addContainer(-18, 0, 0, Math.PI / 2, pick()); addContainer(-18, 2.6, 0, Math.PI / 2, pick());
  const towerB = addContainer(18, 0, 0, Math.PI / 2, pick()); addContainer(18, 2.6, 0, Math.PI / 2, pick());
  for (let x = -27; x <= 27; x += 6) { addContainer(x, 0, -30, 0, 0x6a6f76); addContainer(x, 0, 30, 0, 0x6a6f76); }
  for (let z = -27; z <= 27; z += 2.5) { addContainer(-30, 0, z, Math.PI / 2, 0x6a6f76); addContainer(30, 0, z, Math.PI / 2, 0x6a6f76); }

  // ---- climbing aids ----
  // benches / steps so you can hop up onto containers
  const benchMat = matMatte(0x7a5a36);
  addBlock(-13.6, 0, 14, 2, 1.0, 1.0, 0, benchMat);     // step up to a row
  addBlock(-13.6, 0, 12.6, 2, 1.7, 1.0, 0, benchMat);
  addBlock(13.6, 0, -14, 2, 1.0, 1.0, 0, benchMat);
  addBlock(13.6, 0, -12.6, 2, 1.7, 1.0, 0, benchMat);
  // ladders on the two towers (climb to ~5.2)
  addLadder(-18, 1.6, 5.2, 0, 1);
  addLadder(18, 1.6, 5.2, 0, -1);
  // a zipline between the two towers
  addZipline(-18, 5.4, 1.4, 18, 5.4, -1.4);

  // ---- perimeter dressing: gate, columns, painted + greek walls, fences ----
  const stoneMat = matMatte(0xe8e3d6);
  // entrance gate (two posts + lintel) on the south lane
  addBlock(-2.6, 0, 29.4, 0.8, 4.0, 0.8, 0, stoneMat);
  addBlock(2.6, 0, 29.4, 0.8, 4.0, 0.8, 0, stoneMat);
  addBlock(0, 3.6, 29.4, 6.6, 0.8, 0.9, 0, stoneMat);
  // greek-style columns near center plaza
  for (const cx of [-3.2, 3.2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 3.4, 14), stoneMat);
    col.position.set(cx, 1.7, 11); col.castShadow = true; scene.add(col);
    colliders.push({ x: cx, z: 11, hx: 0.45, hz: 0.45, top: 3.4 });
  }
  // painted wall (mural) panel
  addBlock(-26, 0, 10, 0.6, 3.2, 5, 0, matMatte(0x3b6ea5));
  addBlock(-26, 0, -10, 0.6, 3.2, 5, 0, matMatte(0xb5472f));
  // low fences (raised slightly off the ground) as light cover
  const fenceMat = matMatte(0x55524c);
  for (let x = -8; x <= 8; x += 2) addBlock(x, 0.25, -2, 0.16, 1.0, 0.16, 0, fenceMat);
}
buildMap();

// ------------------------------------------------------------
//  Goku-style avatar rig (smooth shapes, not blocky)
//  Returns joints used by poseAvatar: body, torso, head, armL/R, legL/R, handAnchor
// ------------------------------------------------------------
function buildHair(color) {
  const g = new THREE.Group();
  const mat = matMatte(color);
  const spikes = [
    [0, 0.18, 0, 0.16, 0.34, 0], [-0.13, 0.13, 0.02, 0.12, 0.30, -0.4],
    [0.13, 0.13, 0.02, 0.12, 0.30, 0.4], [0, 0.14, -0.14, 0.12, 0.30, 2.4],
    [-0.16, 0.05, 0.05, 0.10, 0.26, -0.9], [0.16, 0.05, 0.05, 0.10, 0.26, 0.9],
    [-0.08, 0.16, 0.12, 0.10, 0.28, -0.3], [0.08, 0.16, 0.12, 0.10, 0.28, 0.3],
    [0, 0.18, 0.14, 0.10, 0.26, 0],
  ];
  for (const [x, y, z, r, h, rz] of spikes) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
    cone.position.set(x, y, z); cone.rotation.z = rz; cone.rotation.x = z < 0 ? -0.5 : 0.2;
    cone.castShadow = true; g.add(cone);
  }
  // front fringe bang
  const bang = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), mat);
  bang.position.set(0, 0.05, 0.19); bang.rotation.x = 0.9; g.add(bang);
  return g;
}

function buildAvatar(opt = {}) {
  const gi = opt.gi ?? 0xe8731f, trim = opt.trim ?? 0xc25a12, under = opt.under ?? 0x2350c8;
  const hair = opt.hair ?? 0xcdd2dc, skin = opt.skin ?? 0xf0c79b, boot = opt.boot ?? 0x16315e;

  const group = new THREE.Group();
  const body = new THREE.Group(); group.add(body);

  // --- torso (pivot at waist ~0.95) ---
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  const giBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.36, 6, 12), matMatte(gi));
  giBody.scale.set(1.18, 1, 0.74); giBody.position.y = 0.33; giBody.castShadow = true; torso.add(giBody);
  const collar = part(new THREE.BoxGeometry(0.16, 0.24, 0.06), matMatte(under), 0, 0.46, 0.17); collar.rotation.x = -0.12; torso.add(collar);
  const sash = part(new THREE.BoxGeometry(0.52, 0.13, 0.44), matMatte(under), 0, 0.07, 0); torso.add(sash);
  const sashTie = part(new THREE.BoxGeometry(0.12, 0.22, 0.1), matMatte(under), 0.12, -0.02, 0.2); torso.add(sashTie);
  const shoulders = part(new THREE.CapsuleGeometry(0.12, 0.42, 4, 8), matMatte(gi), 0, 0.5, 0); shoulders.rotation.z = Math.PI / 2; shoulders.scale.set(1, 1, 0.8); torso.add(shoulders);

  // --- head (child of torso so it leans with it) ---
  const head = new THREE.Group(); head.position.y = 0.86; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), matMatte(skin)); skull.scale.set(0.95, 1.05, 0.95); skull.castShadow = true; head.add(skull);
  head.add(buildHair(hair));
  const eyeMat = matMatte(0x1a1a1a);
  const eL = part(new THREE.SphereGeometry(0.028, 6, 6), eyeMat, -0.07, 0.0, 0.19);
  const eR = part(new THREE.SphereGeometry(0.028, 6, 6), eyeMat, 0.07, 0.0, 0.19);
  eL.scale.set(1, 1.4, 1); eR.scale.set(1, 1.4, 1); head.add(eL, eR);
  const neck = part(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), matMatte(skin), 0, 0.64, 0); torso.add(neck);

  // --- arms (groups pivoting at shoulder) ---
  function buildArm(side) {
    const a = new THREE.Group();
    a.add(part(new THREE.CapsuleGeometry(0.078, 0.26, 4, 8), matMatte(gi), 0, -0.15, 0));   // upper sleeve
    a.add(part(new THREE.CapsuleGeometry(0.066, 0.22, 4, 8), matMatte(skin), 0, -0.42, 0)); // forearm
    a.add(part(new THREE.CylinderGeometry(0.082, 0.082, 0.08, 10), matMatte(under), 0, -0.32, 0)); // wristband
    a.add(part(new THREE.SphereGeometry(0.072, 8, 8), matMatte(skin), 0, -0.57, 0));        // hand
    a.position.set(side * 0.32, 1.5, 0.02);
    return a;
  }
  const armL = buildArm(-1), armR = buildArm(1); body.add(armL, armR);

  // --- legs (groups pivoting at hip) ---
  function buildLeg(side) {
    const l = new THREE.Group();
    l.add(part(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), matMatte(gi), 0, -0.22, 0));     // thigh
    l.add(part(new THREE.CapsuleGeometry(0.088, 0.3, 4, 8), matMatte(gi), 0, -0.56, 0));    // shin
    l.add(part(new THREE.CylinderGeometry(0.092, 0.092, 0.06, 10), matMatte(trim), 0, -0.4, 0)); // ankle wrap
    const b = part(new THREE.BoxGeometry(0.17, 0.14, 0.28), matMatte(boot), 0, -0.78, 0.05); l.add(b);
    l.position.set(side * 0.13, 0.95, 0);
    return l;
  }
  const legL = buildLeg(-1), legR = buildLeg(1); body.add(legL, legR);

  // --- weapon hand anchor ---
  const handAnchor = new THREE.Group(); handAnchor.position.set(0.32, 1.18, 0.34); body.add(handAnchor);

  return { group, parts: { body, torso, head, armL, armR, legL, legR, handAnchor }, phase: 0 };
}

function lerpN(cur, target, dt, rate = 10) { return cur + (target - cur) * Math.min(1, dt * rate); }
function lerpRot(o, axis, t, dt, rate = 10) { o.rotation[axis] = lerpN(o.rotation[axis], t, dt, rate); }

function poseAvatar(a, state, dt) {
  const P = a.parts;
  // body neutral unless sliding
  if (state === 'slide') {
    P.body.position.y = lerpN(P.body.position.y, -0.5, dt, 12);
    P.body.rotation.x = lerpN(P.body.rotation.x, -0.55, dt, 12);
    lerpRot(P.legL, 'x', 0.7, dt, 12); lerpRot(P.legR, 'x', 0.15, dt, 12);
    lerpRot(P.torso, 'x', 0.25, dt, 12); lerpRot(P.head, 'x', 0.2, dt, 10);
    lerpRot(P.armL, 'x', -0.5, dt, 10);
    return;
  }
  P.body.position.y = lerpN(P.body.position.y, 0, dt, 12);
  P.body.rotation.x = lerpN(P.body.rotation.x, 0, dt, 12);

  if (state === 'walk' || state === 'sprint') {
    const spd = state === 'sprint' ? 15 : 10.5, amp = state === 'sprint' ? 0.85 : 0.5;
    a.phase += dt * spd; const s = Math.sin(a.phase) * amp;
    P.legL.rotation.x = s; P.legR.rotation.x = -s;
    P.armL.rotation.x = -s * 0.9; lerpRot(P.armR, 'x', -0.3, dt, 8);
    lerpRot(P.torso, 'x', state === 'sprint' ? -0.3 : -0.08, dt, 8); lerpRot(P.head, 'x', 0, dt);
  } else if (state === 'jump') {
    lerpRot(P.legL, 'x', -0.55, dt, 12); lerpRot(P.legR, 'x', -0.3, dt, 12);
    lerpRot(P.armL, 'x', -0.45, dt, 12); lerpRot(P.torso, 'x', -0.12, dt, 10); lerpRot(P.head, 'x', 0, dt);
  } else { // idle breathing
    a.phase += dt * 2;
    lerpRot(P.legL, 'x', 0, dt, 8); lerpRot(P.legR, 'x', 0, dt, 8);
    lerpRot(P.armL, 'x', 0, dt, 8); lerpRot(P.armR, 'x', -0.12, dt, 8);
    P.torso.rotation.x = lerpN(P.torso.rotation.x, Math.sin(a.phase) * 0.025, dt, 4); lerpRot(P.head, 'x', 0, dt);
  }
}

// ------------------------------------------------------------
//  Player
// ------------------------------------------------------------
const avatar = buildAvatar();
const player = avatar.group;
const handAnchor = avatar.parts.handAnchor;
player.scale.setScalar(1.18);
player.position.set(0, 0, 18);
scene.add(player);
const EYE = 1.78;

// ------------------------------------------------------------
//  Weapons
// ------------------------------------------------------------
function buildKatana() {
  // held tip-UP: blade runs along +Y, handle at the grip (origin)
  const g = new THREE.Group();
  const blade = part(new THREE.BoxGeometry(0.045, 1.05, 0.02), matMetal(0xe6ebf2), 0, 0.62, 0);
  blade.geometry.translate(0, 0, 0); g.add(blade);
  g.add(part(new THREE.BoxGeometry(0.03, 0.05, 0.05), matMetal(0xf4f7fb), 0, 1.16, 0)); // tip
  g.add(part(new THREE.BoxGeometry(0.16, 0.04, 0.05), matMatte(0x2a2a2a), 0, 0.08, 0)); // guard (tsuba)
  g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), matMatte(0x7a1f1f), 0, -0.06, 0)); // wrapped handle
  g.userData.muzzle = 0;
  return g;
}
function buildAK47() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.08, 0.14, 0.7), matMatte(0x3a2a18), 0, 0, 0.2));
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.5), matMetal(0x2b2b2b), 0, 0.05, 0.55));
  g.add(part(new THREE.BoxGeometry(0.07, 0.22, 0.12), matMatte(0x222018), 0, -0.16, 0.12));
  g.add(part(new THREE.BoxGeometry(0.06, 0.16, 0.1), matMatte(0x3a2a18), 0, -0.12, -0.18));
  g.userData.muzzle = 0.82; return g;
}
function buildAK117() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.08, 0.12, 0.66), matMatte(0x2d3138), 0, 0, 0.2));
  g.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.46), matMetal(0x4a4f57), 0, 0.04, 0.52));
  g.add(part(new THREE.BoxGeometry(0.07, 0.2, 0.1), matMatte(0x1d2025), 0, -0.15, 0.1));
  g.add(part(new THREE.BoxGeometry(0.06, 0.15, 0.1), matMatte(0x2d3138), 0, -0.11, -0.16));
  g.userData.muzzle = 0.76; return g;
}
function buildFennec() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.07, 0.11, 0.42), matMatte(0x222222), 0, 0, 0.12));
  g.add(part(new THREE.BoxGeometry(0.04, 0.04, 0.22), matMetal(0x3a3a3a), 0, 0.03, 0.34));
  g.add(part(new THREE.BoxGeometry(0.06, 0.24, 0.08), matMatte(0x161616), 0, -0.16, 0.05));
  g.add(part(new THREE.BoxGeometry(0.05, 0.14, 0.09), matMatte(0x222222), 0, -0.1, -0.14));
  g.userData.muzzle = 0.46; return g;
}
const WEAPONS = {
  katana: { name: 'Katana', label: '🗡 Katana', type: 'melee', build: buildKatana },
  ak47:   { name: 'AK47',   label: '🔫 AK47',   type: 'gun', build: buildAK47,  rate: 0.105, recoil: 0.022, spread: 0.012 },
  ak117:  { name: 'AK117',  label: '🔫 AK117',  type: 'gun', build: buildAK117, rate: 0.080, recoil: 0.015, spread: 0.010 },
  fennec: { name: 'Fennec', label: '🔫 Fennec', type: 'gun', build: buildFennec, rate: 0.052, recoil: 0.011, spread: 0.020 },
};

const slots = [null, null];
let heldKey = 'katana', heldMesh = null, switchT = 1, pendingKey = null, muzzleZ = 0;
function spawnHeld(key) {
  if (heldMesh) handAnchor.remove(heldMesh);
  heldMesh = WEAPONS[key].build(); handAnchor.add(heldMesh);
  heldKey = key; muzzleZ = heldMesh.userData.muzzle || 0; updateLoadoutUI();
}
function equip(key) { if (key === heldKey && switchT >= 1) return; pendingKey = key; switchT = 0; }
function tapSlot(i) { const gun = slots[i]; if (!gun) return; equip(heldKey === gun ? 'katana' : gun); }
function giveWeapon(key) {
  let idx = slots.indexOf(null), dropped = null;
  if (idx === -1) { idx = slots.indexOf(heldKey); if (idx === -1) idx = 0; dropped = slots[idx]; }
  slots[idx] = key; equip(key); updateLoadoutUI(); return dropped;
}

// ------------------------------------------------------------
//  Floor guns
// ------------------------------------------------------------
const floorGuns = [];
function dropGun(key, x, z) {
  const g = WEAPONS[key].build(); g.scale.setScalar(1.1); g.position.set(x, 0.5, z); g.rotation.z = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z); scene.add(g); scene.add(ring);
  floorGuns.push({ key, mesh: g, ring, x, z });
}
dropGun('ak47', 4, 10); dropGun('ak117', -10, 2); dropGun('fennec', 9, -6);

// ------------------------------------------------------------
//  Bots ("other players")
// ------------------------------------------------------------
const bots = [];
function spawnBot(x, z) {
  const a = buildAvatar({ gi: 0x444a55, trim: 0x2c3038, under: 0x882a2a, hair: 0x141414, skin: 0xc9966b, boot: 0x202020 });
  a.group.scale.setScalar(1.18); a.group.position.set(x, 0, z);
  a.parts.handAnchor.add(buildAK47());
  scene.add(a.group);
  bots.push({ av: a, pos: a.group.position, vy: 0, onGround: true, state: 'idle', stateT: 0, dir: Math.random() * 6.28, hp: 100, hitFlash: 0 });
}
spawnBot(-4, -6); spawnBot(12, 8);

function updateBot(b, dt) {
  b.stateT -= dt;
  if (b.stateT <= 0 && b.onGround) {
    const r = Math.random();
    if (r < 0.30) { b.state = 'idle'; b.stateT = 0.8 + Math.random(); }
    else if (r < 0.65) { b.state = 'walk'; b.stateT = 1.2 + Math.random() * 1.5; b.dir = Math.random() * 6.28; }
    else if (r < 0.85) { b.state = 'sprint'; b.stateT = 1.0 + Math.random(); b.dir = Math.random() * 6.28; }
    else if (r < 0.93) { b.state = 'jump'; b.vy = 6.5; b.onGround = false; b.stateT = 0.6; }
    else { b.state = 'slide'; b.stateT = 1.0; }
  }
  let speed = b.state === 'walk' ? 2.6 : b.state === 'sprint' ? 6 : b.state === 'slide' ? 7.5 * Math.max(0, b.stateT) : 0;
  if (speed > 0) {
    b.pos.x += Math.sin(b.dir) * speed * dt; b.pos.z += Math.cos(b.dir) * speed * dt;
    b.av.group.rotation.y += (b.dir - b.av.group.rotation.y) * Math.min(1, dt * 8);
  }
  b.vy -= 20 * dt; b.pos.y += b.vy * dt;
  const fl = groundHeightAt(b.pos.x, b.pos.z);
  if (b.pos.y <= fl) { b.pos.y = fl; b.vy = 0; if (!b.onGround && b.state === 'jump') { b.state = 'idle'; b.stateT = 0; } b.onGround = true; }
  else b.onGround = false;
  resolveCollisions(b.pos);
  b.pos.x = Math.max(-29, Math.min(29, b.pos.x)); b.pos.z = Math.max(-29, Math.min(29, b.pos.z));
  poseAvatar(b.av, b.onGround ? b.state : 'jump', dt);
  if (b.hitFlash > 0) { b.hitFlash -= dt; b.av.parts.torso.children[0].material.emissive?.setScalar(Math.max(0, b.hitFlash)); }
}

// ------------------------------------------------------------
//  Camera / look
// ------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.02, dist: 4.6 };
const LOOK_X = 0.0115, LOOK_Y = 0.0095;
const AIM_X = 2.8, AIM_Y = 2.1;          // fire-joystick aim rate (rad/s)
let recoilPitch = 0, recoilYaw = 0, fovTarget = 64;
function applyLook(dx, dy) { cam.yaw -= dx * LOOK_X; cam.pitch -= dy * LOOK_Y; cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch)); }

// ------------------------------------------------------------
//  Joysticks
// ------------------------------------------------------------
function createJoystick(zoneId, knobId, opt = {}) {
  const zone = document.getElementById(zoneId), knob = document.getElementById(knobId);
  const state = { x: 0, y: 0, mag: 0, id: null, active: false };
  const radius = opt.radius ?? 46;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const reset = () => { state.x = state.y = state.mag = 0; state.id = null; state.active = false; zone.classList.remove('active'); setKnob(0, 0); opt.onEnd && opt.onEnd(); };
  const move = (cx, cy) => {
    const r = zone.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy); if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    setKnob(dx, dy); state.x = dx / radius; state.y = dy / radius; state.mag = Math.min(1, len / radius);
  };
  const start = (id, cx, cy) => { state.id = id; state.active = true; zone.classList.add('active'); opt.onStart && opt.onStart(); move(cx, cy); };
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
//  Look: drag on canvas
// ------------------------------------------------------------
let lookId = null, lastLX = 0, lastLY = 0;
window.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) if (t.target === canvas && lookId === null) { lookId = t.identifier; lastLX = t.clientX; lastLY = t.clientY; } }, { passive: true });
window.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) { applyLook(t.clientX - lastLX, t.clientY - lastLY); lastLX = t.clientX; lastLY = t.clientY; } }, { passive: true });
const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
window.addEventListener('touchend', endLook); window.addEventListener('touchcancel', endLook);
let mouseLook = false;
canvas.addEventListener('mousedown', (e) => { mouseLook = true; lastLX = e.clientX; lastLY = e.clientY; });
window.addEventListener('mousemove', (e) => { if (mouseLook) { applyLook(e.clientX - lastLX, e.clientY - lastLY); lastLX = e.clientX; lastLY = e.clientY; } });
window.addEventListener('mouseup', () => { mouseLook = false; });

// ------------------------------------------------------------
//  Movement + action state
// ------------------------------------------------------------
const vel = new THREE.Vector3();
let verticalVel = 0, onGround = true, sliding = false, slideTime = 0;
let firing = false, climbing = false, riding = null;
const WALK = 4.6, SPRINT = 8.8;

function jump() {
  if (riding) { riding = null; verticalVel = 2; return; }
  if (climbing) { climbing = false; verticalVel = 5; return; }
  if (!onGround) return;
  verticalVel = 7.4; onGround = false;
  if (sliding) { sliding = false; vel.multiplyScalar(1.12); }
}
function startSlide() {
  if (!onGround || sliding) return;
  sliding = true; slideTime = 0;
  const f = player.rotation.y; vel.set(Math.sin(f), 0, Math.cos(f)).multiplyScalar(11.5);
}
const bind = (id, fn) => { const el = document.getElementById(id); el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false }); el.addEventListener('click', fn); };
bind('btn-jump', jump); bind('btn-slide', startSlide);
document.getElementById('slot-0').addEventListener('click', () => tapSlot(0));
document.getElementById('slot-1').addEventListener('click', () => tapSlot(1));

// Fire / aim joystick — drag to aim, hold to fire (or slash)
const fireStick = createJoystick('fire-zone', 'fire-knob', { radius: 42, onStart: () => { firing = true; }, onEnd: () => { firing = false; } });

// Pickup
let nearGun = null;
const pickupBtn = document.getElementById('pickup-prompt');
function doPickup() {
  if (!nearGun) return;
  const dropped = giveWeapon(nearGun.key);
  scene.remove(nearGun.mesh); scene.remove(nearGun.ring);
  const i = floorGuns.indexOf(nearGun); if (i >= 0) floorGuns.splice(i, 1);
  nearGun = null; if (dropped) dropGun(dropped, player.position.x + 1, player.position.z);
  pickupBtn.classList.add('hidden');
}
pickupBtn.addEventListener('click', doPickup);
pickupBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doPickup(); }, { passive: false });

// ------------------------------------------------------------
//  Gloo Wall
// ------------------------------------------------------------
const glooWalls = [];
let glooReady = true;
const glooBtn = document.getElementById('btn-shield');
function deployGloo() {
  if (!glooReady) return;
  glooReady = false; glooBtn.classList.add('cooldown');
  setTimeout(() => { glooReady = true; glooBtn.classList.remove('cooldown'); }, 6000);
  const f = cam.yaw, fx = -Math.sin(f), fz = -Math.cos(f);
  const wx = player.position.x + fx * 2.4, wz = player.position.z + fz * 2.4;
  const W = 3.2, H = 2.8, D = 0.7;
  const mesh = buildGloo(W, H, D);
  mesh.position.set(wx, H / 2, wz); mesh.rotation.y = f; scene.add(mesh);
  const hx = Math.abs(Math.cos(f)) * W / 2 + Math.abs(Math.sin(f)) * D / 2;
  const hz = Math.abs(Math.sin(f)) * W / 2 + Math.abs(Math.cos(f)) * D / 2;
  const col = { x: wx, z: wz, hx, hz, top: H, gloo: true }; colliders.push(col);
  glooWalls.push({ mesh, col, life: 9, t: 0 });
}
bind('btn-shield', deployGloo);

// ------------------------------------------------------------
//  Loadout UI
// ------------------------------------------------------------
function updateLoadoutUI() {
  for (let i = 0; i < 2; i++) {
    const el = document.getElementById('slot-' + i); const key = slots[i];
    el.querySelector('.wname').textContent = key ? WEAPONS[key].label : '— empty —';
    el.classList.toggle('empty', !key); el.classList.toggle('active', !!key && heldKey === key);
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
    const minX = c.x - c.hx - PLAYER_R, maxX = c.x + c.hx + PLAYER_R, minZ = c.z - c.hz - PLAYER_R, maxZ = c.z + c.hz + PLAYER_R;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const pl = pos.x - minX, pr = maxX - pos.x, pf = pos.z - minZ, pb = maxZ - pos.z, m = Math.min(pl, pr, pf, pb);
      if (m === pl) pos.x = minX; else if (m === pr) pos.x = maxX; else if (m === pf) pos.z = minZ; else pos.z = maxZ;
    }
  }
}
function groundHeightAt(x, z) {
  let h = 0;
  for (const c of colliders) if (x > c.x - c.hx && x < c.x + c.hx && z > c.z - c.hz && z < c.z + c.hz && c.top > h) h = c.top;
  return h;
}

// ------------------------------------------------------------
//  Combat effects (pooled)
// ------------------------------------------------------------
const tracerGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6); tracerGeo.rotateX(Math.PI / 2);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const tracers = [];
const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), flashMat); muzzleFlash.visible = false; muzzleFlash.scale.set(1, 1, 1.8); scene.add(muzzleFlash);
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
  t.mesh.visible = true; t.from = from.clone(); t.to = to.clone(); t.len = t.from.distanceTo(t.to); t.head = 0; t.speed = 200;
}
function spawnImpact(p, n) {
  for (let i = 0; i < 5; i++) {
    let s = sparks.find((x) => !x.mesh.visible);
    if (!s) { s = { mesh: new THREE.Mesh(sparkGeo, sparkMat.clone()), vel: new THREE.Vector3() }; scene.add(s.mesh); sparks.push(s); }
    s.mesh.visible = true; s.mesh.position.copy(p); s.mesh.material.opacity = 1;
    s.vel.set((Math.random() - 0.5) * 4 + n.x * 2, Math.random() * 3 + 1, (Math.random() - 0.5) * 4 + n.z * 2); s.life = 0.35;
  }
}
function ejectShell(origin, right) {
  let s = shells.find((x) => !x.mesh.visible);
  if (!s) { s = { mesh: new THREE.Mesh(shellGeo, shellMat), vel: new THREE.Vector3(), spin: new THREE.Vector3() }; scene.add(s.mesh); shells.push(s); }
  s.mesh.visible = true; s.mesh.position.copy(origin);
  s.vel.set(right.x * 2 + (Math.random() - 0.5), 2.5 + Math.random(), right.z * 2 + (Math.random() - 0.5));
  s.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); s.life = 1.1;
}

// ------------------------------------------------------------
//  Katana slash + blade trail
// ------------------------------------------------------------
let slashT = 1;          // >=1 idle
const slashTrail = new THREE.Mesh(
  new THREE.RingGeometry(0.6, 1.5, 18, 1, -0.5, 1.7),
  new THREE.MeshBasicMaterial({ color: 0xaef0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
slashTrail.position.set(0.2, 1.25, 0.5); slashTrail.rotation.y = Math.PI / 2; player.add(slashTrail);
function startSlash() {
  if (slashT < 1) return; slashT = 0;
  // melee damage in a short forward cone
  const fx = Math.sin(player.rotation.y), fz = Math.cos(player.rotation.y);
  for (const b of bots) {
    const dx = b.pos.x - player.position.x, dz = b.pos.z - player.position.z;
    const d = Math.hypot(dx, dz); if (d > 2.6) continue;
    if ((dx / d) * fx + (dz / d) * fz > 0.4) { b.hp -= 45; b.hitFlash = 0.6; b.pos.x += fx * 0.5; b.pos.z += fz * 0.5; }
  }
}

// ------------------------------------------------------------
//  Ray vs world
// ------------------------------------------------------------
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
function rayHit(origin, dir, maxDist = 200) {
  let best = maxDist, point = null; const normal = new THREE.Vector3(0, 1, 0); let bot = null;
  if (dir.y < -0.0001) { const t = -origin.y / dir.y; if (t > 0 && t < best) { best = t; point = origin.clone().addScaledVector(dir, t); normal.set(0, 1, 0); } }
  for (const c of colliders) {
    const minX = c.x - c.hx, maxX = c.x + c.hx, minZ = c.z - c.hz, maxZ = c.z + c.hz, minY = 0, maxY = c.top;
    let tmin = 0, tmax = best, nx = 0, ny = 0, nz = 0;
    if (Math.abs(dir.x) < 1e-6) { if (origin.x < minX || origin.x > maxX) continue; }
    else { let t1 = (minX - origin.x) / dir.x, t2 = (maxX - origin.x) / dir.x, sg = -1; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; } if (t1 > tmin) { tmin = t1; nx = sg; ny = nz = 0; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
    if (Math.abs(dir.y) < 1e-6) { if (origin.y < minY || origin.y > maxY) continue; }
    else { let t1 = (minY - origin.y) / dir.y, t2 = (maxY - origin.y) / dir.y, sg = -1; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = sg; nz = 0; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
    if (Math.abs(dir.z) < 1e-6) { if (origin.z < minZ || origin.z > maxZ) continue; }
    else { let t1 = (minZ - origin.z) / dir.z, t2 = (maxZ - origin.z) / dir.z, sg = -1; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = 0; nz = sg; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
    if (tmin > 0 && tmin < best) { best = tmin; point = origin.clone().addScaledVector(dir, tmin); normal.set(nx, ny, nz); bot = null; }
  }
  for (const b of bots) {
    _ro.copy(origin).sub(b.pos); _ro.y -= 1.1; const r = 0.7; _rd.copy(dir);
    const proj = -_ro.dot(_rd); if (proj < 0) continue;
    const d2 = _ro.lengthSq() - proj * proj; if (d2 > r * r) continue;
    const t = proj - Math.sqrt(r * r - d2);
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
  if (!firing) return;
  if (w.type === 'melee') { startSlash(); return; }
  if (switchT < 0.6 || fireCooldown > 0) return;
  fireCooldown = w.rate;
  const ty = cam.yaw + recoilYaw, tp = cam.pitch + recoilPitch, cp = Math.cos(tp);
  _look.set(-Math.sin(ty) * cp, Math.sin(tp), -Math.cos(ty) * cp).normalize();
  _right.set(Math.cos(ty), 0, -Math.sin(ty));
  handAnchor.getWorldPosition(_muzzleWorld);
  _muzzleWorld.addScaledVector(_look, muzzleZ * player.scale.x + 0.1).addScaledVector(_right, 0.05);
  const dir = _look.clone();
  dir.x += (Math.random() - 0.5) * w.spread; dir.y += (Math.random() - 0.5) * w.spread; dir.z += (Math.random() - 0.5) * w.spread; dir.normalize();
  const hit = rayHit(_muzzleWorld, dir);
  spawnTracer(_muzzleWorld, hit.point);
  if (hit.bot) { hit.bot.hp -= 18; hit.bot.hitFlash = 0.6; hit.bot.av.parts.torso.children[0].material.emissive?.setScalar(0.6); }
  spawnImpact(hit.point, hit.normal);
  muzzleFlash.position.copy(_muzzleWorld); muzzleFlash.visible = true; flashTime = 0.045;
  muzzleFlash.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1.6 + Math.random());
  ejectShell(_muzzleWorld.clone().addScaledVector(_right, 0.1).addScaledVector(_look, -0.15), _right);
  recoilPitch += w.recoil; recoilYaw += (Math.random() - 0.5) * w.recoil * 0.6;
  handAnchor.position.z -= 0.06;
}

function updateEffects(dt) {
  for (const t of tracers) {
    if (!t.mesh.visible) continue;
    t.head += t.speed * dt; const tail = Math.max(0, t.head - 6);
    if (tail >= t.len) { t.mesh.visible = false; continue; }
    const a = Math.min(t.len, t.head), b = Math.min(t.len, tail), mid = (a + b) / 2;
    TMP.copy(t.to).sub(t.from).normalize();
    t.mesh.position.copy(t.from).addScaledVector(TMP, mid);
    t.mesh.scale.set(1, 1, Math.max(0.2, a - b)); t.mesh.lookAt(t.to);
  }
  if (muzzleFlash.visible) { flashTime -= dt; if (flashTime <= 0) muzzleFlash.visible = false; }
  for (const s of shells) {
    if (!s.mesh.visible) continue; s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.vel.y -= 14 * dt; s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt;
    if (s.mesh.position.y < 0.05) { s.mesh.position.y = 0.05; s.vel.set(0, 0, 0); }
  }
  for (const s of sparks) {
    if (!s.mesh.visible) continue; s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.vel.y -= 12 * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.material.opacity = Math.max(0, s.life / 0.35);
  }
  handAnchor.position.z += (0.34 - handAnchor.position.z) * Math.min(1, dt * 12);
}

// ------------------------------------------------------------
//  Game loop
// ------------------------------------------------------------
const clock = new THREE.Clock();

function update(dt) {
  // fire-joystick aiming (move crosshair while firing)
  if (fireStick.active) { cam.yaw -= fireStick.x * AIM_X * dt; cam.pitch -= fireStick.y * AIM_Y * dt; cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch)); }

  const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw);
  const rightX = Math.cos(cam.yaw), rightZ = -Math.sin(cam.yaw);

  // ---- zipline ride overrides movement ----
  if (riding) {
    riding.t += dt / (riding.len / 9);
    const k = Math.min(1, riding.t);
    player.position.lerpVectors(riding.a, riding.b, k);
    poseAvatar(avatar, 'jump', dt);
    if (k >= 1) { riding = null; verticalVel = 0; }
  } else {
    const stickMag = moveStick.mag;
    const sprinting = stickMag > 0.85 && !sliding && onGround;
    let moveState = 'idle', inDir = null;

    if (stickMag > 0.08 && !sliding) {
      const dx = fwdX * (-moveStick.y) + rightX * moveStick.x;
      const dz = fwdZ * (-moveStick.y) + rightZ * moveStick.x;
      const len = Math.hypot(dx, dz) || 1; inDir = { x: dx / len, z: dz / len };
      const targetSpeed = (sprinting ? SPRINT : WALK) * (sprinting ? 1 : Math.min(1, stickMag / 0.85));
      const acc = Math.min(1, dt * 12);
      vel.x += (inDir.x * targetSpeed - vel.x) * acc; vel.z += (inDir.z * targetSpeed - vel.z) * acc;
      moveState = sprinting ? 'sprint' : 'walk';
    } else if (!sliding) {
      const dec = Math.min(1, dt * 10); vel.x += (0 - vel.x) * dec; vel.z += (0 - vel.z) * dec;
    }

    if (sliding) {
      slideTime += dt; vel.x *= Math.pow(0.05, dt); vel.z *= Math.pow(0.05, dt);
      if (slideTime >= 0.95 || (vel.x * vel.x + vel.z * vel.z) < 1.2) sliding = false;
      moveState = 'slide';
    }

    player.position.x += vel.x * dt; player.position.z += vel.z * dt;

    // ---- ladder climbing ----
    climbing = false;
    for (const L of ladders) {
      if (Math.hypot(player.position.x - L.x, player.position.z - L.z) < 1.0 && player.position.y < L.top - 0.05) {
        if (moveStick.mag > 0.25 || verticalVel > 0) {
          climbing = true;
          player.position.x = lerpN(player.position.x, L.x, dt, 8);
          player.position.z = lerpN(player.position.z, L.z, dt, 8);
          player.position.y += 3.4 * dt; verticalVel = 0;
          if (player.position.y >= L.top) { player.position.y = L.top; player.position.x -= L.nx * 0.6; player.position.z -= L.nz * 0.6; }
        }
        break;
      }
    }

    // ---- face direction ----
    if (firing && WEAPONS[heldKey].type === 'gun') {
      let diff = cam.yaw - player.rotation.y; while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283;
      player.rotation.y += diff * Math.min(1, dt * 16);
    } else if (inDir) {
      const tr = Math.atan2(inDir.x, inDir.z); let diff = tr - player.rotation.y;
      while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283;
      player.rotation.y += diff * Math.min(1, dt * 10);
    }

    // ---- gravity / ground ----
    if (!climbing) {
      verticalVel -= 20 * dt; player.position.y += verticalVel * dt;
      const floor = groundHeightAt(player.position.x, player.position.z);
      if (player.position.y <= floor) { player.position.y = floor; verticalVel = 0; onGround = true; } else onGround = false;
    }
    resolveCollisions(player.position);
    player.position.x = Math.max(-29, Math.min(29, player.position.x));
    player.position.z = Math.max(-29, Math.min(29, player.position.z));

    poseAvatar(avatar, climbing ? 'jump' : (onGround ? moveState : 'jump'), dt);
  }

  // ---- weapon switch / hold pose ----
  if (switchT < 1) {
    switchT = Math.min(1, switchT + dt * 4.5);
    if (pendingKey && switchT >= 0.5) { spawnHeld(pendingKey); pendingKey = null; }
    const lowerAmt = switchT < 0.5 ? switchT * 2 : (1 - switchT) * 2;
    handAnchor.rotation.x = -lowerAmt * 1.2;
  } else if (slashT >= 1) {
    // resting pose: katana held tip-up & angled; guns level
    const tgtX = heldKey === 'katana' ? -0.25 : 0, tgtZ = heldKey === 'katana' ? 0.3 : 0;
    handAnchor.rotation.x = lerpN(handAnchor.rotation.x, tgtX, dt, 8);
    handAnchor.rotation.z = lerpN(handAnchor.rotation.z, tgtZ, dt, 8);
  }

  // ---- katana slash animation + trail ----
  if (slashT < 1) {
    slashT = Math.min(1, slashT + dt * 3.2);
    const e = slashT;                                   // 0..1
    handAnchor.rotation.x = -0.4 + e * 1.9;             // chop down
    handAnchor.rotation.z = 0.6 - e * 1.5;              // sweep across
    slashTrail.material.opacity = Math.sin(e * Math.PI) * 0.8;
    slashTrail.rotation.z = -1.2 + e * 2.4;
    slashTrail.visible = true;
  } else slashTrail.material.opacity = 0;

  // ---- shooting + effects ----
  tryFire(dt); updateEffects(dt);
  recoilPitch += (0 - recoilPitch) * Math.min(1, dt * 7);
  recoilYaw += (0 - recoilYaw) * Math.min(1, dt * 7);

  // ---- bots ----
  for (const b of bots) updateBot(b, dt);

  // ---- gloo walls ----
  for (let i = glooWalls.length - 1; i >= 0; i--) {
    const g = glooWalls[i]; g.t += dt;
    if (g.t < 0.25) { const s = g.t / 0.25; g.mesh.scale.set(s, s, s); }
    if (g.t >= g.life) { scene.remove(g.mesh); const ci = colliders.indexOf(g.col); if (ci >= 0) colliders.splice(ci, 1); glooWalls.splice(i, 1); }
  }

  // ---- floor guns ----
  let best = null, bestD = 2.6;
  for (const fg of floorGuns) {
    fg.mesh.rotation.y += dt * 1.5; fg.mesh.position.y = 0.5 + Math.sin(performance.now() / 400 + fg.x) * 0.08;
    const d = Math.hypot(player.position.x - fg.x, player.position.z - fg.z);
    fg.ring.material.opacity = d < 6 ? 0.7 : 0.25; if (d < bestD) { bestD = d; best = fg; }
  }
  nearGun = best;
  if (best) { pickupBtn.classList.remove('hidden'); document.getElementById('pk-name').textContent = WEAPONS[best.key].name; } else pickupBtn.classList.add('hidden');

  // ---- zipline auto-attach (near a high cable end) ----
  if (!riding) {
    for (const z of ziplines) {
      if (Math.hypot(player.position.x - z.a.x, player.position.z - z.a.z) < 1.6 && Math.abs(player.position.y - (z.a.y - 1.4)) < 1.2 && verticalVel > 0.5) {
        riding = { a: player.position.clone(), b: z.b.clone().setY(groundHeightAt(z.b.x, z.b.z)), len: z.len, t: 0 }; break;
      }
    }
  }

  // ---- camera ----
  const ty = cam.yaw + recoilYaw, tp = cam.pitch + recoilPitch, cpp = Math.cos(tp);
  _look.set(-Math.sin(ty) * cpp, Math.sin(tp), -Math.cos(ty) * cpp);
  _right.set(Math.cos(ty), 0, -Math.sin(ty));
  const pivotX = player.position.x + _right.x * 0.5, pivotY = player.position.y + EYE, pivotZ = player.position.z + _right.z * 0.5;
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
  fovTarget = (moveStick.mag > 0.85 && !sliding && onGround) ? 72 : 64;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------
//  Timer + loop
// ------------------------------------------------------------
let matchTime = 11; const timerEl = document.getElementById('timer');
setInterval(() => { matchTime = matchTime > 0 ? matchTime - 1 : 30; timerEl.textContent = '00:' + String(matchTime).padStart(2, '0'); }, 1000);
function animate() { const dt = Math.min(0.05, clock.getDelta()); update(dt); renderer.render(scene, camera); requestAnimationFrame(animate); }

// ------------------------------------------------------------
//  Orientation + resize
// ------------------------------------------------------------
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200)); resize();
async function goFullscreenLandscape() {
  try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) {}
  resize();
}
document.getElementById('fs-btn').addEventListener('click', goFullscreenLandscape);
window.addEventListener('touchend', function once() { goFullscreenLandscape(); window.removeEventListener('touchend', once); }, { once: true });

// ------------------------------------------------------------
//  Boot
// ------------------------------------------------------------
spawnHeld('katana'); updateLoadoutUI();
requestAnimationFrame(() => { document.getElementById('loader').classList.add('hidden'); document.body.classList.add('playing'); animate(); });
