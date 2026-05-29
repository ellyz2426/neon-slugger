# Neon Slugger VR

Holodeck VR batting cage — read pitches, time your swing, crush home runs.

**Play:** https://ellyz2426.github.io/neon-slugger/

## Features

- **5 Pitch Types**: Fastball (cyan, straight), Curveball (green, drops), Slider (orange, breaks sideways), Changeup (magenta, deceptively slow), Knuckleball (white, wobbles unpredictably)
- **6 Game Modes**: Classic (3 rounds x 10 pitches), Home Run Derby (10 pitches, HRs only count), Speed Batting (60 seconds), Streak Challenge (3 misses and out), Daily Challenge (seeded daily sequence), Practice (unlimited)
- **3 Difficulty Levels**: Easy (slow pitches, fastball/changeup only), Medium (mixed speeds, 4 pitch types), Hard (fast + all 5 pitch types including knuckleball)
- **Hit Classification**: Foul (<20m) → Single (20-50m) → Double (50-75m) → Triple (75-100m) → Home Run (100-120m) → Grand Slam (120m+)
- **Combo Scoring**: Consecutive hits build multiplier (x1/x2/x3/x5/x10)
- **20 Achievements**: First Contact, Going Yard, Grand Slam, Combo milestones, Perfect Round, Moon Shot, and more
- **Top 20 Leaderboard**: Score, mode, accuracy, date
- **5 Holodeck Themes**: Neon Holodeck (cyan), Crimson (red), Toxic (green), Ultraviolet (purple), Solar (orange)
- **Procedural Audio**: 15+ SFX (bat crack, pitch whoosh, HR fanfare, miss buzzer, combos) + ambient synthwave drone
- **12 Spatial UI Panels**: All via PanelUI (.uikitml), zero HTML DOM overlays

## Controls

### Browser
- **Click + Hold**: Charge swing power
- **Mouse X**: Aim direction
- **Release**: Swing bat
- **ESC**: Pause

### VR
- **Right Trigger**: Charge and release to swing
- **Controller direction**: Aim
- **B Button**: Pause
- **Laser pointer**: Menu interaction

## Tech

- IWSDK 0.4.1 with dual-runtime (`xr: { offer: 'once' }` + browser fallback)
- 3 TypeScript source files + 12 `.uikitml` PanelUI templates
- ~2,500 total lines
- Zero HTML DOM UI — fully spatial
- Vite build, deployed to GitHub Pages

## Project Structure

```
src/
  index.ts     — Main game loop, world setup, field, pitching machine, bat, ball physics, UI management
  types.ts     — Game state, pitch configs, difficulty settings, hit classification, themes, achievements
  audio.ts     — Web Audio API manager with procedural SFX and ambient music
ui/
  title.uikitml       — Title screen with mode buttons
  difficulty.uikitml  — Easy/Medium/Hard selection
  hud.uikitml         — Score, combo, best hit, pitches (Follower head-locked)
  pitchinfo.uikitml   — Incoming pitch type and speed (Follower)
  toast.uikitml       — Hit result notifications (Follower)
  countdown.uikitml   — 3-2-1-PLAY countdown (Follower)
  pause.uikitml       — Pause menu
  gameover.uikitml    — Final stats + rematch/title
  leaderboard.uikitml — Top 10 scores
  achievements.uikitml— 20 achievement slots
  settings.uikitml    — Volume + theme controls
  help.uikitml        — Controls + pitch types + scoring + modes
```
