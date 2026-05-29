// Neon Slugger VR — Main entry point
// Holodeck VR batting cage: pitch reading, bat swing timing, home run distance scoring
import {
  World, PanelUI, Follower, FollowBehavior, ScreenSpace, PanelDocument, UIKitDocument,
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry, PlaneGeometry, ConeGeometry, TorusGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Quaternion, Euler,
  Fog, AmbientLight, PointLight, DirectionalLight,
  BufferGeometry, Float32BufferAttribute,
  EdgesGeometry, LineSegments, AdditiveBlending,
} from '@iwsdk/core';
import {
  GameStateManager, GameState, GameMode, Difficulty, PitchType, HitResult,
  PITCH_CONFIGS, PITCH_TYPES, DIFFICULTY_CONFIGS, THEMES, ACHIEVEMENTS,
  HIT_SCORES, HIT_COLORS, classifyHit,
  BAT_SKINS, BatSkin,
  PowerUpType, POWERUP_CONFIGS, POWERUP_TYPES,
  CareerStats,
} from './types';
import { AudioManager } from './audio';

// ============ GLOBALS ============
const gsm = new GameStateManager();
const audio = new AudioManager();
let world: any;
let themeIndex = 0;

// Scene objects
let pitchingMachine: Group;
let bat: Group;
let batMesh: Mesh;
let batHandleMesh: Mesh;
let batGlowMesh: Mesh;
let batEdgesMesh: LineSegments;
let currentBall: Group | null = null;
let fieldGroup: Group;
let environmentGroup: Group;

// Ball state
let ballPos = new Vector3();
let ballVel = new Vector3();
let ballActive = false;
let ballTime = 0;
let currentPitch: PitchType = 'fastball';

// Swing state
let swingCharging = false;
let swingPower = 0;
let swingAngle = 0;
let swingCooldown = 0;
let batSwingAnim = 0;

// Timing
let pitchTimer = 0;
let countdownTimer = 0;
let countdownValue = 3;
let toastTimer = 0;
let gameTimer = 0;

// Power-up pickup in scene
let powerUpGroup: Group | null = null;
let powerUpBob = 0;
let nextPowerUpPitch = 0; // spawn after this many pitches

// XR controller state
let prevTriggerPressed = false;
let prevBPressed = false;

// Daily seed
function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
let dailyRng = seededRandom(dailySeed());

// UI entities
const uiEntities: Record<string, any> = {};
let uiListenersSetup = false;

// Particles
const particles: { mesh: Mesh; vel: Vector3; life: number }[] = [];
const MAX_PARTICLES = 80;

// Field markers
const MOUND_Z = -18; // Pitcher's mound distance
const PLATE_Z = 0; // Home plate
const FENCE_DISTANCE = 100; // Home run fence
const BAT_Y = 0.9; // Bat height (waist level)

// ============ WORLD SETUP ============
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  world = await World.create(container, {
    xr: { offer: 'once' as any },
    render: { near: 0.01, far: 500 },
    input: { canvasPointerEvents: true },
    features: {
      grabbing: false,
      locomotion: false,
      physics: false,
      spatialUI: true,
    },
  } as any);

  audio.init();
  buildEnvironment();
  buildField();
  buildPitchingMachine();
  buildBat();
  setupUI();
  setupInput();

  // Show tutorial on first launch
  if (!gsm.tutorialShown) {
    showUI('tutorial');
  } else {
    showUI('title');
  }

  // Game loop
  let lastTime = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ============ ENVIRONMENT ============
function buildEnvironment() {
  environmentGroup = new Group();
  world.scene.add(environmentGroup);
  applyTheme();
}

function applyTheme() {
  const theme = THEMES[themeIndex];
  while (environmentGroup.children.length > 0) environmentGroup.remove(environmentGroup.children[0]);

  world.scene.fog = new Fog(theme.fog, 10, 200);
  world.scene.background = theme.fog;

  // Grid floor
  const floorGeo = new PlaneGeometry(200, 200);
  const floorMat = new MeshBasicMaterial({ color: theme.field, transparent: true, opacity: 0.6 });
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  environmentGroup.add(floor);

  // Grid lines
  const gridGeo = new BufferGeometry();
  const gridVerts: number[] = [];
  for (let i = -100; i <= 100; i += 5) {
    gridVerts.push(i, 0, -100, i, 0, 100);
    gridVerts.push(-100, 0, i, 100, 0, i);
  }
  gridGeo.setAttribute('position', new Float32BufferAttribute(gridVerts, 3));
  const gridMat = new LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.15 });
  environmentGroup.add(new LineSegments(gridGeo, gridMat));

  // Grid ceiling
  const ceilGeo = new BufferGeometry();
  const ceilVerts: number[] = [];
  const ceilY = 15;
  for (let i = -100; i <= 100; i += 10) {
    ceilVerts.push(i, ceilY, -100, i, ceilY, 100);
    ceilVerts.push(-100, ceilY, i, 100, ceilY, i);
  }
  ceilGeo.setAttribute('position', new Float32BufferAttribute(ceilVerts, 3));
  const ceilMat = new LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.06 });
  environmentGroup.add(new LineSegments(ceilGeo, ceilMat));

  // Ambient lights
  const ambLight = new AmbientLight(theme.ambient, 0.5);
  environmentGroup.add(ambLight);
  const dirLight = new DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(5, 10, 5);
  environmentGroup.add(dirLight);

  // Accent point lights
  const colors = [theme.grid, theme.accent, new Color(0x0088ff)];
  colors.forEach((c, i) => {
    const pl = new PointLight(c, 1.5, 50);
    pl.position.set(-15 + i * 15, 6, -10);
    environmentGroup.add(pl);
  });

  // Floating wireframe decorations
  const decoGeos = [
    new TorusGeometry(0.8, 0.2, 8, 16),
    new BoxGeometry(1.2, 1.2, 1.2),
    new SphereGeometry(0.7, 8, 8),
    new ConeGeometry(0.6, 1.2, 6),
  ];
  for (let i = 0; i < 14; i++) {
    const geo = decoGeos[i % decoGeos.length];
    const edges = new EdgesGeometry(geo);
    const mat = new LineBasicMaterial({ color: i % 2 === 0 ? theme.grid : theme.accent, transparent: true, opacity: 0.3 });
    const line = new LineSegments(edges, mat);
    line.position.set(
      (Math.random() - 0.5) * 60,
      2 + Math.random() * 8,
      -50 + Math.random() * 40,
    );
    (line as any)._rotSpeed = 0.2 + Math.random() * 0.5;
    (line as any)._bobPhase = Math.random() * Math.PI * 2;
    (line as any)._baseY = line.position.y;
    environmentGroup.add(line);
  }

  // Ambient particles
  for (let i = 0; i < 40; i++) {
    const pGeo = new SphereGeometry(0.06, 4, 4);
    const pMat = new MeshBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.4 });
    const p = new Mesh(pGeo, pMat);
    p.position.set(
      (Math.random() - 0.5) * 80,
      1 + Math.random() * 10,
      -60 + Math.random() * 50,
    );
    (p as any)._driftX = (Math.random() - 0.5) * 0.3;
    (p as any)._driftY = (Math.random() - 0.5) * 0.15;
    (p as any)._pulsePhase = Math.random() * Math.PI * 2;
    (p as any)._baseY = p.position.y;
    environmentGroup.add(p);
  }
}

// ============ FIELD ============
function buildField() {
  fieldGroup = new Group();
  world.scene.add(fieldGroup);
  const theme = THEMES[themeIndex];

  // Home plate
  const plateGeo = new BoxGeometry(0.45, 0.02, 0.45);
  const plateMat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const plate = new Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.01, PLATE_Z);
  plate.rotation.y = Math.PI / 4;
  fieldGroup.add(plate);

  // Batter's box lines
  const boxGeo = new BufferGeometry();
  const boxVerts = [
    -0.6, 0.01, -0.9, 0.6, 0.01, -0.9,
    0.6, 0.01, -0.9, 0.6, 0.01, 0.9,
    0.6, 0.01, 0.9, -0.6, 0.01, 0.9,
    -0.6, 0.01, 0.9, -0.6, 0.01, -0.9,
  ];
  boxGeo.setAttribute('position', new Float32BufferAttribute(boxVerts, 3));
  const boxMat = new LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.5 });
  fieldGroup.add(new LineSegments(boxGeo, boxMat));

  // Distance markers at 20, 50, 75, 100, 120m
  const distances = [20, 50, 75, 100, 120];
  distances.forEach((d, i) => {
    for (let angle = -40; angle <= 40; angle += 20) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.sin(rad) * d;
      const z = -Math.cos(rad) * d;
      const postGeo = new CylinderGeometry(0.08, 0.08, 3, 6);
      const postMat = new MeshStandardMaterial({
        color: d >= 100 ? 0xffd700 : theme.grid.getHex(),
        emissive: d >= 100 ? 0xffd700 : theme.grid.getHex(),
        emissiveIntensity: 0.3,
      });
      const post = new Mesh(postGeo, postMat);
      post.position.set(x, 1.5, z);
      fieldGroup.add(post);
    }

    if (d === 100) {
      const fenceGeo = new BufferGeometry();
      const fenceVerts: number[] = [];
      for (let a = -45; a < 45; a += 2) {
        const r1 = (a * Math.PI) / 180;
        const r2 = ((a + 2) * Math.PI) / 180;
        fenceVerts.push(Math.sin(r1) * d, 0, -Math.cos(r1) * d);
        fenceVerts.push(Math.sin(r2) * d, 0, -Math.cos(r2) * d);
        fenceVerts.push(Math.sin(r1) * d, 3, -Math.cos(r1) * d);
        fenceVerts.push(Math.sin(r2) * d, 3, -Math.cos(r2) * d);
        fenceVerts.push(Math.sin(r1) * d, 0, -Math.cos(r1) * d);
        fenceVerts.push(Math.sin(r1) * d, 3, -Math.cos(r1) * d);
      }
      fenceGeo.setAttribute('position', new Float32BufferAttribute(fenceVerts, 3));
      const fenceMat = new LineBasicMaterial({ color: theme.fence, transparent: true, opacity: 0.4 });
      fieldGroup.add(new LineSegments(fenceGeo, fenceMat));
    }
  });

  // Foul lines
  const foulGeo = new BufferGeometry();
  const foulVerts = [
    0, 0.02, 0, -120, 0.02, -120,
    0, 0.02, 0, 120, 0.02, -120,
  ];
  foulGeo.setAttribute('position', new Float32BufferAttribute(foulVerts, 3));
  const foulMat = new LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.2 });
  fieldGroup.add(new LineSegments(foulGeo, foulMat));

  // Spotlight on plate
  const spotlight = new PointLight(0xffffff, 2, 15);
  spotlight.position.set(0, 5, 0);
  fieldGroup.add(spotlight);
}

// ============ PITCHING MACHINE ============
function buildPitchingMachine() {
  pitchingMachine = new Group();
  pitchingMachine.position.set(0, 1.2, MOUND_Z);
  world.scene.add(pitchingMachine);

  const bodyGeo = new CylinderGeometry(0.4, 0.5, 1.2, 8);
  const bodyMat = new MeshStandardMaterial({ color: 0x222233, emissive: 0x00ffff, emissiveIntensity: 0.15 });
  pitchingMachine.add(new Mesh(bodyGeo, bodyMat));

  const barrelGeo = new CylinderGeometry(0.15, 0.2, 0.8, 8);
  const barrelMat = new MeshStandardMaterial({ color: 0x333344, emissive: 0xff00ff, emissiveIntensity: 0.2 });
  const barrel = new Mesh(barrelGeo, barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.6;
  barrel.position.y = 0.2;
  pitchingMachine.add(barrel);

  const ringGeo = new TorusGeometry(0.25, 0.03, 8, 16);
  const ringMat = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
  const ring = new Mesh(ringGeo, ringMat);
  ring.position.z = 1.0;
  ring.position.y = 0.2;
  pitchingMachine.add(ring);

  const baseGeo = new CylinderGeometry(0.6, 0.6, 0.15, 8);
  const baseMat = new MeshStandardMaterial({ color: 0x111122, emissive: 0x00ffff, emissiveIntensity: 0.1 });
  const base = new Mesh(baseGeo, baseMat);
  base.position.y = -0.65;
  pitchingMachine.add(base);
}

// ============ BAT ============
function buildBat() {
  bat = new Group();
  bat.position.set(0.5, BAT_Y, 0);
  world.scene.add(bat);

  const skin = BAT_SKINS[gsm.batSkinIndex] || BAT_SKINS[0];

  // Bat handle
  const handleGeo = new CylinderGeometry(0.025, 0.03, 0.5, 8);
  const handleMat = new MeshStandardMaterial({ color: skin.handleColor, emissive: skin.glowColor, emissiveIntensity: 0.1 });
  batHandleMesh = new Mesh(handleGeo, handleMat);
  batHandleMesh.position.y = 0;
  bat.add(batHandleMesh);

  // Bat barrel
  const barrelGeo = new CylinderGeometry(0.04, 0.03, 0.5, 8);
  const barrelMat = new MeshStandardMaterial({ color: skin.barrelColor, emissive: skin.barrelColor, emissiveIntensity: skin.emissiveIntensity });
  batMesh = new Mesh(barrelGeo, barrelMat);
  batMesh.position.y = 0.5;
  bat.add(batMesh);

  // Glow sphere at bat tip
  const glowGeo = new SphereGeometry(0.06, 8, 8);
  const glowMat = new MeshBasicMaterial({ color: skin.glowColor, transparent: true, opacity: 0.5 });
  batGlowMesh = new Mesh(glowGeo, glowMat);
  batGlowMesh.position.y = 0.75;
  bat.add(batGlowMesh);

  // Edges for wireframe overlay
  const edgesGeo = new EdgesGeometry(barrelGeo);
  const edgesMat = new LineBasicMaterial({ color: skin.glowColor, transparent: true, opacity: 0.4 });
  batEdgesMesh = new LineSegments(edgesGeo, edgesMat);
  batEdgesMesh.position.y = 0.5;
  bat.add(batEdgesMesh);
}

function applyBatSkin() {
  const skin = BAT_SKINS[gsm.batSkinIndex] || BAT_SKINS[0];
  // Update handle
  const hMat = batHandleMesh.material as MeshStandardMaterial;
  hMat.color.setHex(skin.handleColor);
  hMat.emissive.setHex(skin.glowColor);
  // Update barrel
  const bMat = batMesh.material as MeshStandardMaterial;
  bMat.color.setHex(skin.barrelColor);
  bMat.emissive.setHex(skin.barrelColor);
  bMat.emissiveIntensity = skin.emissiveIntensity;
  // Update glow
  (batGlowMesh.material as MeshBasicMaterial).color.setHex(skin.glowColor);
  // Update edges
  (batEdgesMesh.material as LineBasicMaterial).color.setHex(skin.glowColor);
}

// ============ POWER-UPS ============
function spawnPowerUpPickup() {
  removePowerUpPickup();
  const types = POWERUP_TYPES;
  const type = types[Math.floor(Math.random() * types.length)];
  const cfg = POWERUP_CONFIGS[type];

  powerUpGroup = new Group();
  (powerUpGroup as any)._type = type;
  powerUpBob = 0;

  // Floating orb
  const orbGeo = new SphereGeometry(0.2, 12, 12);
  const orbMat = new MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
  powerUpGroup.add(new Mesh(orbGeo, orbMat));

  // Ring
  const ringGeo = new TorusGeometry(0.3, 0.02, 8, 16);
  const ringMat = new MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.4 });
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  powerUpGroup.add(ring);

  // Place near batting area
  powerUpGroup.position.set(
    (Math.random() - 0.5) * 1.5,
    1.2 + Math.random() * 0.5,
    -1 + Math.random(),
  );
  world.scene.add(powerUpGroup);
}

function removePowerUpPickup() {
  if (powerUpGroup) {
    world.scene.remove(powerUpGroup);
    powerUpGroup = null;
  }
}

function checkPowerUpCollection() {
  if (!powerUpGroup || gsm.state !== 'playing') return;
  // Auto-collect if bat swings near power-up
  const dist = bat.position.distanceTo(powerUpGroup.position);
  if (dist < 1.0) {
    collectPowerUp();
  }
}

function collectPowerUp() {
  if (!powerUpGroup) return;
  const type = (powerUpGroup as any)._type as PowerUpType;
  const cfg = POWERUP_CONFIGS[type];

  gsm.activePowerUp = type;
  gsm.powerUpTimer = cfg.duration;
  gsm.powerUpsCollectedThisGame++;

  audio.playPowerUp();
  showToast(cfg.name, cfg.desc);
  spawnHitExplosion(powerUpGroup.position.clone(), cfg.color, 15);
  removePowerUpPickup();

  // Achievement check
  checkPowerUpAchievements();
}

function updatePowerUp(dt: number) {
  // Bob animation for pickup
  if (powerUpGroup) {
    powerUpBob += dt;
    powerUpGroup.position.y += Math.sin(powerUpBob * 3) * 0.003;
    powerUpGroup.rotation.y += dt * 2;
    // Ring pulsing
    if (powerUpGroup.children[1]) {
      const ring = powerUpGroup.children[1] as Mesh;
      const scale = 1 + Math.sin(powerUpBob * 4) * 0.15;
      ring.scale.setScalar(scale);
    }
  }

  // Duration power-ups (magnet)
  if (gsm.activePowerUp && gsm.powerUpTimer > 0) {
    gsm.powerUpTimer -= dt;
    if (gsm.powerUpTimer <= 0) {
      gsm.activePowerUp = null;
      gsm.powerUpTimer = 0;
    }
  }
}

function checkPowerUpAchievements() {
  const total = gsm.career.powerUpsCollected + gsm.powerUpsCollectedThisGame;
  if (!gsm.unlockedAchievements.has('powerup_first')) {
    unlockAchievement('powerup_first');
  }
  if (total >= 10 && !gsm.unlockedAchievements.has('powerup_10')) {
    unlockAchievement('powerup_10');
  }
}

// ============ BALL ============
function spawnBall() {
  if (currentBall) {
    world.scene.remove(currentBall);
    currentBall = null;
  }

  const diffConfig = DIFFICULTY_CONFIGS[gsm.difficulty];

  // Pick pitch type
  if (gsm.mode === 'daily') {
    currentPitch = diffConfig.pitchPool[Math.floor(dailyRng() * diffConfig.pitchPool.length)];
  } else {
    currentPitch = diffConfig.pitchPool[Math.floor(Math.random() * diffConfig.pitchPool.length)];
  }

  const pitchCfg = PITCH_CONFIGS[currentPitch];

  // Apply Time Freeze power-up: slow speed
  let speedMult = diffConfig.speedMultiplier;
  if (gsm.activePowerUp === 'time_freeze') {
    speedMult *= 0.3;
    gsm.activePowerUp = null; // single use
    gsm.powerUpTimer = 0;
    showToast('TIME FREEZE!', 'Slow pitch incoming');
  }

  currentBall = new Group();

  const ballGeo = new SphereGeometry(0.037, 12, 12);
  const ballMat = new MeshStandardMaterial({
    color: pitchCfg.color,
    emissive: pitchCfg.color,
    emissiveIntensity: 0.6,
  });
  currentBall.add(new Mesh(ballGeo, ballMat));

  const glowGeo = new SphereGeometry(0.06, 8, 8);
  const glowMat = new MeshBasicMaterial({ color: pitchCfg.color, transparent: true, opacity: 0.3 });
  currentBall.add(new Mesh(glowGeo, glowMat));

  const noise = diffConfig.accuracyNoise;
  ballPos.set(
    (Math.random() - 0.5) * noise,
    1.4 + (Math.random() - 0.5) * noise * 0.5,
    MOUND_Z + 1.0,
  );
  currentBall.position.copy(ballPos);

  const targetY = BAT_Y + (Math.random() - 0.5) * 0.4;
  const targetX = (Math.random() - 0.5) * 0.3;
  const dir = new Vector3(targetX - ballPos.x, targetY - ballPos.y, PLATE_Z - ballPos.z).normalize();
  const speed = pitchCfg.speed * speedMult;
  ballVel.copy(dir).multiplyScalar(speed);

  ballActive = true;
  ballTime = 0;
  world.scene.add(currentBall);

  audio.playPitchThrow();
  gsm.pitchesThrown++;

  // Maybe spawn power-up
  nextPowerUpPitch--;
  if (nextPowerUpPitch <= 0 && !powerUpGroup && gsm.mode !== 'daily') {
    spawnPowerUpPickup();
    nextPowerUpPitch = 4 + Math.floor(Math.random() * 4); // every 4-7 pitches
  }

  updatePitchInfo();
}

function updateBall(dt: number) {
  if (!ballActive || !currentBall) return;

  ballTime += dt;
  const pitchCfg = PITCH_CONFIGS[currentPitch];

  // Apply pitch-specific movement
  ballVel.y += pitchCfg.spinY * dt;
  ballVel.x += pitchCfg.spinZ * dt;
  if (pitchCfg.wobble > 0) {
    ballVel.x += Math.sin(ballTime * 15) * pitchCfg.wobble * dt;
    ballVel.y += Math.cos(ballTime * 12) * pitchCfg.wobble * 0.5 * dt;
  }

  // Magnet power-up: curve ball toward bat
  if (gsm.activePowerUp === 'magnet') {
    const toBat = new Vector3(bat.position.x, BAT_Y, PLATE_Z).sub(ballPos);
    const dist = toBat.length();
    if (dist > 0.5 && dist < 5) {
      toBat.normalize().multiplyScalar(2.0 * dt);
      ballVel.add(toBat);
    }
  }

  // Gravity
  ballVel.y -= 5.0 * dt;

  // Move
  ballPos.x += ballVel.x * dt;
  ballPos.y += ballVel.y * dt;
  ballPos.z += ballVel.z * dt;
  currentBall.position.copy(ballPos);
  currentBall.rotation.x += 10 * dt;

  // Ball trail particle
  if (Math.random() < 0.5) {
    spawnParticle(ballPos.clone(), new Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 0), pitchCfg.color, 0.3);
  }

  // Check if ball passed the plate (miss)
  if (ballPos.z > 2) {
    onMiss();
  }

  // Check if ball hit the ground behind the plate
  if (ballPos.y < -1) {
    removeBall();
  }
}

function removeBall() {
  if (currentBall) {
    world.scene.remove(currentBall);
    currentBall = null;
  }
  ballActive = false;
}

// ============ HIT DETECTION ============
function attemptSwing() {
  if (!ballActive || swingCooldown > 0) return;

  audio.playSwing();
  batSwingAnim = 1.0;
  swingCooldown = 0.5;

  const distToPlate = Math.abs(ballPos.z - PLATE_Z);
  const distToBat = ballPos.distanceTo(new Vector3(bat.position.x, BAT_Y, PLATE_Z));

  if (distToPlate < 1.5 && distToBat < 1.2) {
    // HIT!
    const power = Math.max(0.3, swingPower);
    const contactQuality = 1.0 - (distToBat / 1.2);

    let launchAngle = 15 + power * 25 + (Math.random() - 0.5) * 15;
    let launchDir = swingAngle + (Math.random() - 0.5) * 20;
    let launchSpeed = power * contactQuality * 60;

    // Power Swing power-up: 2x distance
    if (gsm.activePowerUp === 'power_swing') {
      launchSpeed *= 1.6;
      gsm.activePowerUp = null;
      gsm.powerUpTimer = 0;
    }

    const radAngle = (launchAngle * Math.PI) / 180;
    const distance = (launchSpeed * launchSpeed * Math.sin(2 * radAngle)) / 9.81;

    const result = classifyHit(distance, launchDir);

    const radDir = (launchDir * Math.PI) / 180;
    ballVel.set(
      Math.sin(radDir) * launchSpeed * 0.3,
      Math.sin(radAngle) * launchSpeed,
      -Math.cos(radDir) * launchSpeed * 0.3,
    );
    ballActive = true;

    setTimeout(() => removeBall(), 2000);

    onHit(result, distance, launchDir);
  }
}

function onHit(result: HitResult, distance: number, angle: number) {
  gsm.totalDistanceThisGame += Math.max(0, distance);

  if (result === 'foul') {
    gsm.combo = 0;
    audio.playFoul();
    gsm.hits++;
    const points = HIT_SCORES[result];
    gsm.score += points;
    showToast('FOUL BALL', `${Math.round(distance)}m`);
  } else {
    gsm.hits++;
    gsm.combo++;
    if (gsm.combo > gsm.maxCombo) gsm.maxCombo = gsm.combo;
    const multiplier = gsm.getComboMultiplier();
    const points = HIT_SCORES[result] * multiplier;
    gsm.score += points;

    if (distance > gsm.bestDistance) gsm.bestDistance = distance;

    if (result === 'homerun' || result === 'grandslam') {
      gsm.homeRuns++;
      if (result === 'grandslam') gsm.grandSlams++;
      audio.playHomeRun();
      spawnHitExplosion(ballPos.clone(), HIT_COLORS[result], 25);
    } else {
      if (result === 'triple') gsm.triples++;
      audio.playHit(distance / 100);
      spawnHitExplosion(ballPos.clone(), HIT_COLORS[result], 12);
    }

    if (gsm.combo >= 2) audio.playCombo(gsm.combo);

    const resultName = result.toUpperCase().replace('HOMERUN', 'HOME RUN').replace('GRANDSLAM', 'GRAND SLAM');
    showToast(`${resultName}!`, `${Math.round(distance)}m  x${multiplier}`);

    if (currentPitch === 'curveball') gsm.curvesHit++;
    if (currentPitch === 'knuckleball') gsm.knucklesHit++;

    checkAchievements(result, distance);
  }

  // Auto-collect nearby power-up on hit
  checkPowerUpCollection();

  gsm.pitchesRemaining--;
  updateHUD();
}

function onMiss() {
  removeBall();
  gsm.misses++;
  gsm.combo = 0;
  audio.playMiss();
  showToast('STRIKE!', 'Swing missed');

  if (gsm.mode === 'streak') {
    gsm.missesAllowed--;
    if (gsm.missesAllowed <= 0) {
      endGame();
      return;
    }
  }

  gsm.pitchesRemaining--;
  updateHUD();
}

// ============ GAME FLOW ============
function startGame() {
  gsm.resetGame();
  gsm.modesPlayed.add(gsm.mode);
  gsm.savePersistence();
  if (gsm.mode === 'daily') dailyRng = seededRandom(dailySeed());
  gsm.state = 'countdown';
  countdownValue = 3;
  countdownTimer = 0;
  nextPowerUpPitch = 3 + Math.floor(Math.random() * 3); // first power-up after 3-5 pitches
  removePowerUpPickup();
  showUI('countdown');
  updateCountdown();
}

function beginPlaying() {
  gsm.state = 'playing';
  hideUI('countdown');
  showUI('hud');
  showUI('pitchinfo');
  pitchTimer = 1.5;
  audio.playGameStart();
  updateHUD();
}

function endGame() {
  gsm.state = 'gameover';
  removeBall();
  removePowerUpPickup();
  audio.playGameOver();
  gsm.updateCareerOnGameEnd();
  gsm.addToLeaderboard();
  checkCareerAchievements();
  updateGameOver();
  showUI('gameover');
  hideUI('hud');
  hideUI('pitchinfo');
}

function shouldEndGame(): boolean {
  if (gsm.mode === 'practice') return false;
  if (gsm.mode === 'speed') return gsm.timeRemaining <= 0;
  if (gsm.mode === 'streak') return gsm.missesAllowed <= 0;
  return gsm.pitchesRemaining <= 0;
}

// ============ UPDATE ============
function update(dt: number) {
  updateEnvironmentAnimations(dt);
  updateParticles(dt);
  updateBatAnimation(dt);
  updatePowerUp(dt);
  updateXRInput();

  if (swingCooldown > 0) swingCooldown -= dt;

  switch (gsm.state) {
    case 'countdown':
      countdownTimer += dt;
      if (countdownTimer >= 1.0) {
        countdownTimer = 0;
        countdownValue--;
        if (countdownValue <= 0) {
          beginPlaying();
        } else {
          audio.playCountdownTick();
          updateCountdown();
        }
      }
      break;

    case 'playing':
      if (gsm.mode === 'speed') {
        gsm.timeRemaining -= dt;
        if (gsm.timeRemaining <= 0) {
          gsm.timeRemaining = 0;
          endGame();
          return;
        }
      }

      if (!ballActive) {
        pitchTimer -= dt;
        if (pitchTimer <= 0 && !shouldEndGame()) {
          spawnBall();
          pitchTimer = DIFFICULTY_CONFIGS[gsm.difficulty].pitchInterval;
        } else if (shouldEndGame() && !ballActive) {
          if (gsm.mode === 'classic' && gsm.round < gsm.maxRounds) {
            gsm.round++;
            gsm.pitchesRemaining = 10;
            pitchTimer = 2.0;
            showToast(`ROUND ${gsm.round}`, `${gsm.maxRounds - gsm.round + 1} remaining`);
          } else {
            endGame();
            return;
          }
        }
      }

      updateBall(dt);
      updateHUD();
      updateBatTracking();
      break;
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) hideUI('toast');
  }
}

function updateEnvironmentAnimations(dt: number) {
  const t = performance.now() / 1000;
  environmentGroup.children.forEach(child => {
    if ((child as any)._rotSpeed) {
      child.rotation.y += (child as any)._rotSpeed * dt;
      child.rotation.x += (child as any)._rotSpeed * 0.3 * dt;
      child.position.y = (child as any)._baseY + Math.sin(t + (child as any)._bobPhase) * 0.3;
    }
    if ((child as any)._driftX !== undefined) {
      child.position.x += (child as any)._driftX * dt;
      child.position.y = (child as any)._baseY + Math.sin(t * 0.5 + (child as any)._pulsePhase) * 0.5;
      if (child.position.x > 50 || child.position.x < -50) (child as any)._driftX *= -1;
      const mat = (child as Mesh).material as MeshBasicMaterial;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = 0.2 + Math.sin(t * 2 + (child as any)._pulsePhase) * 0.15;
      }
    }
  });
}

function updateBatAnimation(dt: number) {
  if (batSwingAnim > 0) {
    batSwingAnim -= dt * 4;
    bat.rotation.z = Math.sin(batSwingAnim * Math.PI) * 1.5;
    if (batSwingAnim <= 0) {
      batSwingAnim = 0;
      bat.rotation.z = 0;
    }
  }

  if (swingCharging) {
    swingPower = Math.min(1.0, swingPower + dt * 1.2);
    (batMesh.material as MeshStandardMaterial).emissiveIntensity =
      (BAT_SKINS[gsm.batSkinIndex]?.emissiveIntensity || 0.4) + swingPower * 0.8;
  }
}

function updateBatTracking() {
  bat.position.x = 0.5 + swingAngle * 0.01;
}

// ============ XR CONTROLLER INPUT ============
function updateXRInput() {
  // Poll XR gamepads for controller input
  const session = (world as any).renderer?.xr?.getSession?.();
  if (!session) return;
  const sources = session.inputSources;
  if (!sources) return;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source.gamepad) continue;
    const gp = source.gamepad;
    const hand = source.handedness;

    // Right hand — primary interaction
    if (hand === 'right' && gp.buttons.length > 0) {
      // Trigger (index 0): charge/release swing
      const triggerPressed = gp.buttons[0].pressed;
      if (triggerPressed && !prevTriggerPressed) {
        // Trigger pressed: start charging
        if (gsm.state === 'playing') {
          swingCharging = true;
          swingPower = 0;
        }
      } else if (!triggerPressed && prevTriggerPressed) {
        // Trigger released: swing
        if (gsm.state === 'playing' && swingCharging) {
          swingCharging = false;
          attemptSwing();
          const skin = BAT_SKINS[gsm.batSkinIndex] || BAT_SKINS[0];
          (batMesh.material as MeshStandardMaterial).emissiveIntensity = skin.emissiveIntensity;
        }
      }
      prevTriggerPressed = triggerPressed;

      // B button (index 4 on Quest): pause/resume
      if (gp.buttons.length > 4) {
        const bPressed = gp.buttons[4].pressed;
        if (bPressed && !prevBPressed) {
          if (gsm.state === 'playing') {
            gsm.state = 'paused';
            showUI('pause');
            hideUI('hud');
          } else if (gsm.state === 'paused') {
            gsm.state = 'playing';
            hideUI('pause');
            showUI('hud');
          }
        }
        prevBPressed = bPressed;
      }

      // Thumbstick horizontal (axis 2 or 3): bat aim
      if (gp.axes.length > 2) {
        const thumbX = gp.axes[2];
        if (gsm.state === 'playing' && Math.abs(thumbX) > 0.1) {
          swingAngle = thumbX * 30; // -30 to +30 degrees
        }
      }
    }
  }
}

// ============ PARTICLES ============
function spawnParticle(pos: Vector3, vel: Vector3, color: Color, life: number) {
  if (particles.length >= MAX_PARTICLES) {
    const oldest = particles.shift()!;
    world.scene.remove(oldest.mesh);
  }
  const geo = new SphereGeometry(0.04, 4, 4);
  const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: AdditiveBlending });
  const mesh = new Mesh(geo, mat);
  mesh.position.copy(pos);
  world.scene.add(mesh);
  particles.push({ mesh, vel, life });
}

function spawnHitExplosion(pos: Vector3, color: Color, count: number) {
  for (let i = 0; i < count; i++) {
    const vel = new Vector3(
      (Math.random() - 0.5) * 8,
      Math.random() * 6,
      (Math.random() - 0.5) * 8,
    );
    spawnParticle(pos.clone(), vel, color, 0.8 + Math.random() * 0.5);
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= 6 * dt;
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    (p.mesh.material as MeshBasicMaterial).opacity = Math.max(0, p.life * 0.8);
    p.mesh.scale.setScalar(Math.max(0.1, p.life));
    if (p.life <= 0) {
      world.scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

// ============ ACHIEVEMENTS ============
function unlockAchievement(id: string) {
  if (gsm.unlockedAchievements.has(id)) return;
  gsm.unlockedAchievements.add(id);
  gsm.savePersistence();
  audio.playAchievement();
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (ach) showToast(`ACHIEVEMENT: ${ach.name}`, ach.desc);

  // Check if this unlocked a bat skin
  const unlockedSkin = BAT_SKINS.find(s => s.requiresAchievement === id);
  if (unlockedSkin && !gsm.unlockedAchievements.has('skin_unlock')) {
    unlockAchievement('skin_unlock');
  }
}

function checkAchievements(result: HitResult, distance: number) {
  if (result !== 'miss') unlockAchievement('first_hit');
  if (result === 'homerun' || result === 'grandslam') unlockAchievement('first_hr');
  if (result === 'grandslam') unlockAchievement('grand_slam');
  if (gsm.combo >= 5) unlockAchievement('combo_5');
  if (gsm.combo >= 10) unlockAchievement('combo_10');
  if (gsm.score >= 1000) unlockAchievement('score_1k');
  if (gsm.score >= 5000) unlockAchievement('score_5k');
  if (gsm.score >= 10000) unlockAchievement('score_10k');
  if (gsm.homeRuns >= 5 && gsm.mode === 'derby') unlockAchievement('derby_champ');
  if (gsm.hits >= 15 && gsm.mode === 'speed') unlockAchievement('speed_demon');
  if (gsm.combo >= 10) unlockAchievement('streak_10');
  if (gsm.combo >= 20) unlockAchievement('streak_20');
  if (gsm.mode === 'daily') unlockAchievement('daily_done');
  if (gsm.difficulty === 'hard') unlockAchievement('hard_mode');
  if (gsm.curvesHit >= 10) unlockAchievement('curve_master');
  if (currentPitch === 'knuckleball' && result !== 'miss') unlockAchievement('knuckle_hit');
  if (distance >= 150) unlockAchievement('distance_150');
  if (gsm.modesPlayed.size >= 6) unlockAchievement('all_modes');
  if (gsm.triples >= 3) unlockAchievement('triple_play');
}

function checkCareerAchievements() {
  if (gsm.career.totalHits >= 100) unlockAchievement('career_100_hits');
  if (gsm.career.totalHomeRuns >= 50) unlockAchievement('career_50_hr');
  if (gsm.career.totalDistance >= 1000) unlockAchievement('career_1000_dist');
  if (gsm.career.gamesPlayed >= 10) unlockAchievement('games_10');
  if (gsm.career.gamesPlayed >= 50) unlockAchievement('games_50');
  if (gsm.career.perfectRounds >= 3) unlockAchievement('perfect_3');
}

// ============ INPUT ============
function setupInput() {
  window.addEventListener('mousedown', () => {
    if (gsm.state === 'playing') {
      swingCharging = true;
      swingPower = 0;
    }
  });

  window.addEventListener('mouseup', () => {
    if (gsm.state === 'playing' && swingCharging) {
      swingCharging = false;
      attemptSwing();
      const skin = BAT_SKINS[gsm.batSkinIndex] || BAT_SKINS[0];
      (batMesh.material as MeshStandardMaterial).emissiveIntensity = skin.emissiveIntensity;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (gsm.state === 'playing') {
      const centerX = window.innerWidth / 2;
      swingAngle = ((e.clientX - centerX) / centerX) * 30;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (gsm.state === 'playing') {
        gsm.state = 'paused';
        showUI('pause');
        hideUI('hud');
      } else if (gsm.state === 'paused') {
        gsm.state = 'playing';
        hideUI('pause');
        showUI('hud');
      }
    }
  });
}

// ============ UI MANAGEMENT ============
function setupUI() {
  // World panels
  createWorldPanel('title', '/ui/title.json', 0.9, 1.2, new Vector3(0, 1.5, -3));
  createWorldPanel('difficulty', '/ui/difficulty.json', 0.7, 0.8, new Vector3(0, 1.5, -3));
  createWorldPanel('gameover', '/ui/gameover.json', 0.8, 0.9, new Vector3(0, 1.5, -3));
  createWorldPanel('pause', '/ui/pause.json', 0.6, 0.5, new Vector3(0, 1.5, -2));
  createWorldPanel('leaderboard', '/ui/leaderboard.json', 0.85, 1.1, new Vector3(0, 1.5, -3));
  createWorldPanel('achievements', '/ui/achievements.json', 0.85, 1.4, new Vector3(0, 1.5, -3));
  createWorldPanel('settings', '/ui/settings.json', 0.7, 0.9, new Vector3(0, 1.5, -3));
  createWorldPanel('help', '/ui/help.json', 0.8, 1.2, new Vector3(0, 1.5, -3));
  createWorldPanel('tutorial', '/ui/tutorial.json', 0.85, 1.0, new Vector3(0, 1.5, -3));
  createWorldPanel('batskins', '/ui/batskins.json', 0.8, 1.0, new Vector3(0, 1.5, -3));
  createWorldPanel('career', '/ui/career.json', 0.75, 0.9, new Vector3(0, 1.5, -3));

  // Head-following panels
  createFollowerPanel('hud', '/ui/hud.json', 0.35, 0.1, [0, 0.12, -0.5]);
  createFollowerPanel('toast', '/ui/toast.json', 0.25, 0.08, [0, -0.05, -0.5]);
  createFollowerPanel('countdown', '/ui/countdown.json', 0.2, 0.15, [0, 0, -0.5]);
  createFollowerPanel('pitchinfo', '/ui/pitchinfo.json', 0.15, 0.07, [-0.2, 0.1, -0.5]);

  setTimeout(setupUIListeners, 500);
}

function createWorldPanel(name: string, config: string, w: number, h: number, pos: Vector3) {
  const entity = world.createTransformEntity(undefined, { persistent: true });
  entity.object3D!.position.copy(pos);
  entity.object3D!.visible = false;
  entity.addComponent(PanelUI, { config, maxWidth: w, maxHeight: h });
  uiEntities[name] = entity;
}

function createFollowerPanel(name: string, config: string, w: number, h: number, offset: number[]) {
  const entity = world.createTransformEntity(undefined, { persistent: true });
  entity.object3D!.visible = false;
  entity.addComponent(PanelUI, { config, maxWidth: w, maxHeight: h });
  entity.addComponent(Follower, {
    target: world.player.head,
    offsetPosition: offset,
    behavior: FollowBehavior.PivotY,
    speed: 5,
    tolerance: 0.3,
  });
  uiEntities[name] = entity;
}

function showUI(name: string) {
  const entity = uiEntities[name];
  if (entity && entity.object3D) entity.object3D.visible = true;
}

function hideUI(name: string) {
  const entity = uiEntities[name];
  if (entity && entity.object3D) entity.object3D.visible = false;
}

function hideAllUI() {
  Object.keys(uiEntities).forEach(name => hideUI(name));
}

function getDoc(name: string): UIKitDocument | undefined {
  const entity = uiEntities[name];
  if (!entity) return undefined;
  return entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
}

function setText(doc: UIKitDocument | undefined, id: string, text: string) {
  if (!doc) return;
  const el = doc.getElementById(id);
  if (el && (el as any).text) (el as any).text.value = text;
}

function setupUIListeners() {
  if (uiListenersSetup) return;
  uiListenersSetup = true;

  const trySetup = () => {
    // Title buttons
    const titleDoc = getDoc('title');
    if (titleDoc) {
      const bind = (id: string, fn: () => void) => {
        const el = titleDoc.getElementById(id);
        if (el) el.addEventListener('click', () => { audio.playButtonClick(); fn(); });
      };
      bind('btn-play', () => { gsm.mode = 'classic'; hideAllUI(); showUI('difficulty'); });
      bind('btn-derby', () => { gsm.mode = 'derby'; hideAllUI(); showUI('difficulty'); });
      bind('btn-speed', () => { gsm.mode = 'speed'; hideAllUI(); showUI('difficulty'); });
      bind('btn-streak', () => { gsm.mode = 'streak'; hideAllUI(); showUI('difficulty'); });
      bind('btn-daily', () => { gsm.mode = 'daily'; gsm.difficulty = 'medium'; hideAllUI(); startGame(); });
      bind('btn-practice', () => { gsm.mode = 'practice'; gsm.difficulty = 'easy'; hideAllUI(); startGame(); });
      bind('btn-leaderboard', () => { hideAllUI(); updateLeaderboard(); showUI('leaderboard'); });
      bind('btn-achievements', () => { hideAllUI(); updateAchievements(); showUI('achievements'); });
      bind('btn-settings', () => { hideAllUI(); updateSettings(); showUI('settings'); });
      bind('btn-help', () => { hideAllUI(); showUI('help'); });
      bind('btn-career', () => { hideAllUI(); updateCareer(); showUI('career'); });
      bind('btn-batskins', () => { hideAllUI(); updateBatSkins(); showUI('batskins'); });
    }

    // Difficulty buttons
    const diffDoc = getDoc('difficulty');
    if (diffDoc) {
      const bind = (id: string, fn: () => void) => {
        const el = diffDoc.getElementById(id);
        if (el) el.addEventListener('click', () => { audio.playButtonClick(); fn(); });
      };
      bind('btn-easy', () => { gsm.difficulty = 'easy'; hideAllUI(); startGame(); });
      bind('btn-medium', () => { gsm.difficulty = 'medium'; hideAllUI(); startGame(); });
      bind('btn-hard', () => { gsm.difficulty = 'hard'; hideAllUI(); startGame(); });
      bind('btn-diff-back', () => { hideAllUI(); showUI('title'); });
    }

    // Pause buttons
    const pauseDoc = getDoc('pause');
    if (pauseDoc) {
      const bind = (id: string, fn: () => void) => {
        const el = pauseDoc.getElementById(id);
        if (el) el.addEventListener('click', () => { audio.playButtonClick(); fn(); });
      };
      bind('btn-resume', () => { gsm.state = 'playing'; hideUI('pause'); showUI('hud'); });
      bind('btn-quit', () => { gsm.state = 'title'; hideAllUI(); showUI('title'); });
    }

    // Game over buttons
    const goDoc = getDoc('gameover');
    if (goDoc) {
      const bind = (id: string, fn: () => void) => {
        const el = goDoc.getElementById(id);
        if (el) el.addEventListener('click', () => { audio.playButtonClick(); fn(); });
      };
      bind('btn-rematch', () => { hideAllUI(); startGame(); });
      bind('btn-title', () => { gsm.state = 'title'; hideAllUI(); showUI('title'); });
    }

    // Back buttons for sub-screens
    const backBind = (panelName: string, btnId: string) => {
      const doc = getDoc(panelName);
      if (doc) {
        const el = doc.getElementById(btnId);
        if (el) el.addEventListener('click', () => { audio.playButtonClick(); hideAllUI(); showUI('title'); });
      }
    };
    backBind('leaderboard', 'btn-lb-back');
    backBind('achievements', 'btn-ach-back');
    backBind('help', 'btn-help-back');
    backBind('career', 'btn-career-back');
    backBind('batskins', 'btn-skins-back');

    // Tutorial
    const tutDoc = getDoc('tutorial');
    if (tutDoc) {
      const el = tutDoc.getElementById('btn-tutorial-start');
      if (el) el.addEventListener('click', () => {
        audio.playButtonClick();
        gsm.tutorialShown = true;
        gsm.savePersistence();
        hideAllUI();
        showUI('title');
      });
    }

    // Bat skins navigation
    const skinsDoc = getDoc('batskins');
    if (skinsDoc) {
      const prevBtn = skinsDoc.getElementById('btn-skin-prev');
      const nextBtn = skinsDoc.getElementById('btn-skin-next');
      const selectBtn = skinsDoc.getElementById('btn-skin-select');
      if (prevBtn) prevBtn.addEventListener('click', () => {
        audio.playButtonClick();
        gsm.batSkinIndex = (gsm.batSkinIndex - 1 + BAT_SKINS.length) % BAT_SKINS.length;
        applyBatSkin();
        gsm.savePersistence();
        updateBatSkins();
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        audio.playButtonClick();
        gsm.batSkinIndex = (gsm.batSkinIndex + 1) % BAT_SKINS.length;
        applyBatSkin();
        gsm.savePersistence();
        updateBatSkins();
      });
      if (selectBtn) selectBtn.addEventListener('click', () => {
        audio.playButtonClick();
        const skin = BAT_SKINS[gsm.batSkinIndex];
        if (gsm.isBatSkinUnlocked(skin)) {
          applyBatSkin();
          gsm.savePersistence();
          showToast('BAT EQUIPPED', skin.name);
        } else {
          showToast('LOCKED', `Unlock: ${skin.requiresAchievement}`);
        }
      });
    }

    // Settings
    const setDoc = getDoc('settings');
    if (setDoc) {
      const el = setDoc.getElementById('btn-settings-back');
      if (el) el.addEventListener('click', () => { audio.playButtonClick(); hideAllUI(); showUI('title'); });

      const volBind = (btnId: string, getter: () => number, setter: (v: number) => void, displayId: string, delta: number) => {
        const btn = setDoc.getElementById(btnId);
        if (btn) btn.addEventListener('click', () => {
          audio.playButtonClick();
          const val = Math.max(0, Math.min(1, getter() + delta));
          setter(val);
          setText(setDoc, displayId, `${Math.round(val * 100)}`);
        });
      };
      volBind('btn-master-down', () => audio.getMasterVolume(), v => audio.setMasterVolume(v), 'vol-master', -0.1);
      volBind('btn-master-up', () => audio.getMasterVolume(), v => audio.setMasterVolume(v), 'vol-master', 0.1);
      volBind('btn-sfx-down', () => audio.getSfxVolume(), v => audio.setSfxVolume(v), 'vol-sfx', -0.1);
      volBind('btn-sfx-up', () => audio.getSfxVolume(), v => audio.setSfxVolume(v), 'vol-sfx', 0.1);
      volBind('btn-music-down', () => audio.getMusicVolume(), v => audio.setMusicVolume(v), 'vol-music', -0.1);
      volBind('btn-music-up', () => audio.getMusicVolume(), v => audio.setMusicVolume(v), 'vol-music', 0.1);

      const prevBtn = setDoc.getElementById('btn-theme-prev');
      const nextBtn = setDoc.getElementById('btn-theme-next');
      if (prevBtn) prevBtn.addEventListener('click', () => {
        audio.playButtonClick();
        themeIndex = (themeIndex - 1 + THEMES.length) % THEMES.length;
        applyTheme();
        setText(setDoc, 'theme-name', THEMES[themeIndex].name);
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        audio.playButtonClick();
        themeIndex = (themeIndex + 1) % THEMES.length;
        applyTheme();
        setText(setDoc, 'theme-name', THEMES[themeIndex].name);
      });
    }
  };

  trySetup();
  setTimeout(trySetup, 1000);
  setTimeout(trySetup, 2000);
}

// ============ UI UPDATES ============
function updateHUD() {
  const doc = getDoc('hud');
  if (!doc) return;
  setText(doc, 'hud-score', `${gsm.score}`);
  setText(doc, 'hud-combo', `x${gsm.getComboMultiplier()}`);
  setText(doc, 'hud-distance', `${Math.round(gsm.bestDistance)}m`);

  if (gsm.mode === 'speed') {
    setText(doc, 'hud-pitches', `${Math.ceil(gsm.timeRemaining)}s`);
  } else if (gsm.mode === 'streak') {
    setText(doc, 'hud-pitches', `${gsm.missesAllowed} lives`);
  } else if (gsm.mode === 'practice') {
    setText(doc, 'hud-pitches', `${gsm.hits} hits`);
  } else {
    setText(doc, 'hud-pitches', `${gsm.pitchesRemaining}/${gsm.mode === 'classic' ? 10 : gsm.pitchesRemaining + gsm.pitchesThrown}`);
  }

  // Power-up indicator
  if (gsm.activePowerUp) {
    const cfg = POWERUP_CONFIGS[gsm.activePowerUp];
    setText(doc, 'hud-powerup', cfg.name);
  } else {
    setText(doc, 'hud-powerup', '');
  }
}

function updateCountdown() {
  const doc = getDoc('countdown');
  if (!doc) return;
  if (countdownValue > 0) {
    setText(doc, 'cd-number', `${countdownValue}`);
    setText(doc, 'cd-label', 'GET READY');
  } else {
    setText(doc, 'cd-number', 'PLAY!');
    setText(doc, 'cd-label', 'BATTER UP');
    audio.playCountdownGo();
  }
}

function updateGameOver() {
  const doc = getDoc('gameover');
  if (!doc) return;
  const accuracy = gsm.getAccuracy();
  setText(doc, 'go-result', 'GAME OVER');
  setText(doc, 'go-mode', gsm.mode.toUpperCase());
  setText(doc, 'go-score', `${gsm.score}`);
  setText(doc, 'go-hits', `${gsm.hits}`);
  setText(doc, 'go-accuracy', `${accuracy}%`);
  setText(doc, 'go-best', `${Math.round(gsm.bestDistance)}m`);
  setText(doc, 'go-homers', `${gsm.homeRuns}`);

  // Perfect round checks
  if (gsm.pitchesThrown > 0 && gsm.misses === 0 && gsm.hits === gsm.pitchesThrown) {
    unlockAchievement('perfect_round');
  }
  if (accuracy >= 90 && gsm.pitchesThrown >= 5) {
    unlockAchievement('accuracy_90');
  }
}

function updateLeaderboard() {
  const doc = getDoc('leaderboard');
  if (!doc) return;
  for (let i = 0; i < 10; i++) {
    const entry = gsm.leaderboard[i];
    const el = doc.getElementById(`lb-${i + 1}`);
    if (el && entry) {
      const children = (el as any).children;
      if (children && children.length >= 4) {
        if ((children[0] as any).text) (children[0] as any).text.value = `${i + 1}`;
        if ((children[1] as any).text) (children[1] as any).text.value = `${entry.score}`;
        if ((children[2] as any).text) (children[2] as any).text.value = entry.mode.toUpperCase();
        if ((children[3] as any).text) (children[3] as any).text.value = entry.date;
      }
    }
  }
}

function updateAchievements() {
  const doc = getDoc('achievements');
  if (!doc) return;
  setText(doc, 'ach-count', `${gsm.unlockedAchievements.size} / ${ACHIEVEMENTS.length}`);
  ACHIEVEMENTS.forEach((ach, i) => {
    const el = doc.getElementById(`ach-${i + 1}`);
    if (el) {
      const children = (el as any).children;
      if (children && children.length >= 3) {
        if ((children[0] as any).text) (children[0] as any).text.value = ach.name;
        if ((children[1] as any).text) (children[1] as any).text.value = ach.desc;
        if ((children[2] as any).text) (children[2] as any).text.value = gsm.unlockedAchievements.has(ach.id) ? 'YES' : '-';
      }
    }
  });
}

function updateSettings() {
  const doc = getDoc('settings');
  if (!doc) return;
  setText(doc, 'vol-master', `${Math.round(audio.getMasterVolume() * 100)}`);
  setText(doc, 'vol-sfx', `${Math.round(audio.getSfxVolume() * 100)}`);
  setText(doc, 'vol-music', `${Math.round(audio.getMusicVolume() * 100)}`);
  setText(doc, 'theme-name', THEMES[themeIndex].name);
}

function updatePitchInfo() {
  const doc = getDoc('pitchinfo');
  if (!doc) return;
  const cfg = PITCH_CONFIGS[currentPitch];
  const speed = Math.round(cfg.speed * DIFFICULTY_CONFIGS[gsm.difficulty].speedMultiplier * 2.237);
  setText(doc, 'pitch-type', cfg.name);
  setText(doc, 'pitch-speed', `${speed} MPH`);
}

function showToast(text: string, sub: string) {
  showUI('toast');
  toastTimer = 2.5;
  const doc = getDoc('toast');
  if (doc) {
    setText(doc, 'toast-text', text);
    setText(doc, 'toast-sub', sub);
  }
}

function updateCareer() {
  const doc = getDoc('career');
  if (!doc) return;
  const c = gsm.career;
  setText(doc, 'career-games', `${c.gamesPlayed}`);
  setText(doc, 'career-hits', `${c.totalHits}`);
  setText(doc, 'career-hrs', `${c.totalHomeRuns}`);
  setText(doc, 'career-slams', `${c.totalGrandSlams}`);
  setText(doc, 'career-distance', `${Math.round(c.totalDistance)}m`);
  setText(doc, 'career-best-score', `${c.bestScore}`);
  setText(doc, 'career-best-combo', `${c.bestCombo}`);
  setText(doc, 'career-best-dist', `${Math.round(c.bestDistance)}m`);
  setText(doc, 'career-powerups', `${c.powerUpsCollected}`);
  setText(doc, 'career-perfects', `${c.perfectRounds}`);
}

function updateBatSkins() {
  const doc = getDoc('batskins');
  if (!doc) return;
  const skin = BAT_SKINS[gsm.batSkinIndex];
  const unlocked = gsm.isBatSkinUnlocked(skin);
  setText(doc, 'skin-name', skin.name);
  setText(doc, 'skin-status', unlocked ? 'UNLOCKED' : `LOCKED (${skin.requiresAchievement})`);
  setText(doc, 'skin-index', `${gsm.batSkinIndex + 1} / ${BAT_SKINS.length}`);
}

// ============ ENTRY ============
main().catch(console.error);
