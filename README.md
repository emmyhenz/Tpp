# TPP — Container Warfare

A mobile **third-person perspective (TPP)** game built with [Three.js](https://threejs.org/),
inspired by the shipping-container battle maps from games like Free Fire.

It runs entirely in the browser — no install, no build step — and is designed
for **touch controls on phones**.

## Features

- 🗺️ **Container yard map** — rows of stacked, corrugated shipping containers in
  different colors, hazard lanes, and a walled arena. Containers are solid (you
  collide with them) and you can climb onto stacks.
- 🕹️ **Dual joysticks**
  - **Left = MOVE** — walk/run the character around the map.
  - **Right = LOOK** — orbit and tilt the camera to view around the map.
- 🏃 **SPRINT** toggle and **JUMP** button.
- 👤 Third-person character with walk animation that follows your camera facing.
- 📱 Mobile-first HUD (match timer, team scores, objective) like the reference.

## Play it

Because it uses ES module imports from a CDN, open it through a local web
server (not `file://`):

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000 on your phone or desktop
```

On desktop you can drag the on-screen joysticks with the mouse to test.

## Controls

| Control            | Action                          |
|--------------------|---------------------------------|
| Left joystick      | Move (relative to camera)       |
| Right joystick     | Look / orbit camera around map  |
| SPRINT button      | Toggle run speed                |
| JUMP button        | Jump (and climb onto containers)|

## Tech

- `index.html` — markup + HUD + joystick elements
- `styles.css` — mobile UI / joystick styling
- `game.js` — Three.js scene, container map, player, camera, controls

No dependencies to install; Three.js is loaded via an import map from unpkg.
