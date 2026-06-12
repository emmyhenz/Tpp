# TPP — Container Warfare

A mobile **third-person perspective (TPP)** game built with [Three.js](https://threejs.org/),
inspired by the shipping-container battle maps from games like Free Fire.

It runs entirely in the browser — no install, no build step — and is designed
for **touch controls on phones**.

## Features

- 🗺️ **Container yard map** — rows of stacked, corrugated shipping containers in
  different colors, hazard lanes, and a walled arena. Containers are solid (you
  collide with them) and you can climb onto stacks.
- 🎮 **Mobile FPS controls** — left joystick to move (auto-sprint near max), drag
  anywhere on the screen to look (CODM / Free Fire style).
- 🏃 **Smooth, velocity-based movement** — walk, sprint, jump and slide that blend
  naturally; slide + jump = a momentum-carrying movement tech.
- 🔫 **Combat** — FIRE button (hipfire) with muzzle flash, recoil, shell ejection,
  high-speed tracers and impact sparks.
- 🧱 **Gloo Wall** — instantly deploy a temporary protective wall in front of you.
- 🔁 **Weapon switching** — two gun slots + Katana melee, with a holster animation.
- 🎯 Fixed center crosshair; pick up AK47 / AK117 / Fennec off the floor.
- 👥 Animated bots that demonstrate idle / walk / sprint / jump / slide.
- 📱 Mobile-first HUD + landscape/fullscreen handling.

## Play it

Because it uses ES module imports from a CDN, open it through a local web
server (not `file://`):

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000 on your phone or desktop
```

On desktop you can drag on the scene with the mouse to look, and drag the
on-screen joystick to move.

## Controls

| Control          | Action                                            |
|------------------|---------------------------------------------------|
| Left joystick    | Move (push near max edge to auto-sprint)          |
| Drag screen      | Look / aim (drag up = look up)                     |
| FIRE joystick    | Hold to fire / slash; **drag it to aim** the crosshair |
| JUMP             | Jump; tap during a slide for a slide-jump          |
| SLIDE            | Slide with momentum                                |
| GLOO WALL        | Deploy a temporary cover wall                       |
| Weapon slots     | Tap to equip; tap held slot again for Katana melee |

## Tech

- `index.html` — markup + HUD + joystick elements
- `styles.css` — mobile UI / joystick styling
- `game.js` — Three.js scene, container map, player, camera, controls

No dependencies to install; Three.js is loaded via an import map from unpkg.
