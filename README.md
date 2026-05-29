# 🟢 Neon Marble VR

A physics-based marble maze game built with IWSDK 0.4.1 — playable in VR headsets and desktop browsers.

**[▶ Play Now](https://ellyz2426.github.io/neon-marble/)**

## Screenshots

| Title Screen | Gameplay | Level Select |
|:---:|:---:|:---:|
| Neon holodeck title | Marble rolling through maze | Zone-based level grid |

| Minimap | Ghost Replay | Victory Celebration |
|:---:|:---:|:---:|
| Bird's-eye level view | Transparent ghost marble | Firework particle bursts |

## Features

### Core Gameplay
- **Physics-based marble rolling** — tilt the board to guide your marble through 36 handcrafted maze levels
- **5 game modes**: Campaign, Time Attack, Zen, Daily Challenge (seeded PRNG), Survival (endless)
- **11 tile types**: walls, holes, gems, teleporters, ice zones, boost pads, power-ups (shield/magnet/slow-mo), moving walls, gravity switches, bumpers
- **6 level zones**: Classic, Power-Up, Endgame, Bumper, Master — progressive difficulty with all mechanics combined

### VR + Browser
- **Dual-runtime**: Full VR support (Meta Quest) with XR controller input + desktop browser fallback
- **All UI is spatial PanelUI** — 17 `.uikitml` templates, zero HTML DOM overlays
- **XR controller input**: Left thumbstick for board tilt, B to pause, laser pointer for all menus
- **Head-following HUD** with score, timer, gems, lives, power-up indicators, combo display, zone indicator, speedrun split delta

### Progression & Competition
- **50 achievements** tracking every aspect of gameplay
- **Star rating system** (1-3 stars per level based on par time + gem collection)
- **Leaderboard** with top 20 scores
- **Speed Run Timer** with per-level split tracking, PB comparison, total campaign timer
- **Ghost replay system** — records your best run path and shows a transparent ghost marble on replay
- **Survival mode** — shuffled endless play with 1 life, best run tracking

### Challenge Modifiers
- **No Power-ups** — removes all power-up pickups from levels
- **Mirror Mode** — flipped/inverted controls
- **Speed Demon** — 1.5x gravity for faster, harder gameplay

### Visual Polish
- **14 marble skins** with unique colors, glow effects, and trail particle styles (fire embers, frost crystals, toxic wisps, void implosion, golden shimmer, RGB glitch, starfield celestial, and more)
- **Holodeck environment** with neon grid floor/ceiling, wireframe decorations, ambient particles, fog
- **5 board themes**: Neon Holodeck, Crimson Grid, Toxic Neon, Ultra Violet, Solar Blaze
- **Zone-based synthwave music** with crossfade transitions between 5 zone-specific tracks
- **Screen shake** on wall bounces and falls
- **Victory firework celebration** with staggered particle bursts and triumphant fanfare
- **Level transition animations** (fade in/out between levels)
- **Mini-map** (3D bird's-eye follower panel showing level layout with marble position dot)
- **Tutorial overlay** for first-time players on the first 3 levels

### Audio
- **Procedural Web Audio**: 16+ SFX (bounce, roll, gem collect, fall, teleport, boost, ice slide, bumper, combo, power-up pickup, shield break, magnet pull, victory fanfare, achievement, countdown, button click)
- **5 zone-specific synthwave tracks** (C/F/D/G/E minor) with LFO modulation and crossfade transitions
- **Combo system SFX** with rising pitch based on combo chain count

## Controls

| Action | Keyboard | VR Controller |
|--------|---------|--------------|
| Tilt board | WASD / Arrow keys | Left thumbstick |
| Pause | Escape | B button |
| Menu navigation | Mouse click | Laser pointer + trigger |

## Tech Stack

- **IWSDK 0.4.1** (Immersive Web SDK) with WebXR
- **Three.js** (via @iwsdk/core)
- **PanelUI** (@pmndrs/uikit + @iwsdk/vite-plugin-uikitml)
- **Vite** for development and production builds
- **TypeScript** — strict mode, zero errors
- **Web Audio API** — fully procedural, no audio file dependencies

## Project Stats

- **36 levels** across 6 zones (Classic, Power-Up, Endgame, Bumper, Master)
- **50 achievements**
- **14 marble skins** with unique trail effects
- **17 PanelUI templates** (`.uikitml`)
- **5 game modes** (Campaign, Time Attack, Zen, Daily Challenge, Survival)
- **3 challenge modifiers** (No Power-ups, Mirror Mode, Speed Demon)
- **~6,200 lines** of TypeScript across 7 source files
- **Zero HTML DOM overlays** — all UI is XR-compatible spatial PanelUI

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## License

Built as a demo project for IWSDK 0.4.1.
