// Types, constants, themes, achievements, and game state for Neon Slugger VR
import { Color, Vector3 } from '@iwsdk/core';

// --- Game States ---
export type GameState = 'title' | 'difficulty' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'leaderboard' | 'achievements' | 'settings' | 'help';
export type GameMode = 'classic' | 'derby' | 'speed' | 'streak' | 'daily' | 'practice';
export type Difficulty = 'easy' | 'medium' | 'hard';

// --- Pitch Types ---
export type PitchType = 'fastball' | 'curveball' | 'slider' | 'changeup' | 'knuckleball';

export interface PitchConfig {
  name: string;
  color: Color;
  speed: number; // base m/s
  spinX: number; // curve factor
  spinY: number; // drop factor
  spinZ: number; // lateral break
  wobble: number; // knuckleball wobble
}

export const PITCH_CONFIGS: Record<PitchType, PitchConfig> = {
  fastball: { name: 'FASTBALL', color: new Color(0x00ffff), speed: 18, spinX: 0, spinY: -0.3, spinZ: 0, wobble: 0 },
  curveball: { name: 'CURVEBALL', color: new Color(0x00ff80), speed: 13, spinX: 0, spinY: -4.5, spinZ: 0, wobble: 0 },
  slider: { name: 'SLIDER', color: new Color(0xffa500), speed: 15, spinX: 0, spinY: -1.0, spinZ: 3.5, wobble: 0 },
  changeup: { name: 'CHANGEUP', color: new Color(0xff00ff), speed: 10, spinX: 0, spinY: -1.5, spinZ: 0.5, wobble: 0 },
  knuckleball: { name: 'KNUCKLEBALL', color: new Color(0xffffff), speed: 9, spinX: 0, spinY: -0.8, spinZ: 0, wobble: 3.0 },
};

export const PITCH_TYPES: PitchType[] = ['fastball', 'curveball', 'slider', 'changeup', 'knuckleball'];

// --- Difficulty configs ---
export interface DifficultyConfig {
  speedMultiplier: number;
  pitchPool: PitchType[];
  pitchInterval: number; // seconds between pitches
  accuracyNoise: number; // pitch aiming noise
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: { speedMultiplier: 0.7, pitchPool: ['fastball', 'changeup'], pitchInterval: 3.5, accuracyNoise: 0.15 },
  medium: { speedMultiplier: 1.0, pitchPool: ['fastball', 'curveball', 'slider', 'changeup'], pitchInterval: 2.8, accuracyNoise: 0.08 },
  hard: { speedMultiplier: 1.3, pitchPool: ['fastball', 'curveball', 'slider', 'changeup', 'knuckleball'], pitchInterval: 2.2, accuracyNoise: 0.03 },
};

// --- Hit zones / scoring ---
export type HitResult = 'miss' | 'foul' | 'single' | 'double' | 'triple' | 'homerun' | 'grandslam';

export const HIT_SCORES: Record<HitResult, number> = {
  miss: 0,
  foul: 25,
  single: 100,
  double: 200,
  triple: 400,
  homerun: 1000,
  grandslam: 2000,
};

export const HIT_DISTANCE: Record<HitResult, [number, number]> = {
  miss: [0, 0],
  foul: [0, 20],
  single: [20, 50],
  double: [50, 75],
  triple: [75, 100],
  homerun: [100, 120],
  grandslam: [120, 200],
};

export function classifyHit(distance: number, angle: number): HitResult {
  if (distance <= 0) return 'miss';
  const absFoul = Math.abs(angle);
  if (absFoul > 45) return 'foul';
  if (distance >= 120) return 'grandslam';
  if (distance >= 100) return 'homerun';
  if (distance >= 75) return 'triple';
  if (distance >= 50) return 'double';
  if (distance >= 20) return 'single';
  return 'foul';
}

export const HIT_COLORS: Record<HitResult, Color> = {
  miss: new Color(0x808080),
  foul: new Color(0xffff00),
  single: new Color(0x00ff80),
  double: new Color(0x00ffff),
  triple: new Color(0xff00ff),
  homerun: new Color(0xffd700),
  grandslam: new Color(0xff4444),
};

// --- Themes ---
export interface Theme {
  name: string;
  grid: Color;
  accent: Color;
  field: Color;
  fence: Color;
  ambient: Color;
  fog: Color;
}

export const THEMES: Theme[] = [
  { name: 'Holodeck', grid: new Color(0x00ffff), accent: new Color(0xff00ff), field: new Color(0x001a1a), fence: new Color(0x00ffff), ambient: new Color(0x003333), fog: new Color(0x000808) },
  { name: 'Crimson', grid: new Color(0xff2020), accent: new Color(0xffd700), field: new Color(0x1a0000), fence: new Color(0xff4040), ambient: new Color(0x330000), fog: new Color(0x080000) },
  { name: 'Toxic', grid: new Color(0x00ff40), accent: new Color(0x80ff00), field: new Color(0x001a00), fence: new Color(0x40ff40), ambient: new Color(0x003300), fog: new Color(0x000800) },
  { name: 'Ultraviolet', grid: new Color(0x8000ff), accent: new Color(0xff00ff), field: new Color(0x0a001a), fence: new Color(0xa040ff), ambient: new Color(0x1a0033), fog: new Color(0x040008) },
  { name: 'Solar', grid: new Color(0xffa500), accent: new Color(0xff4500), field: new Color(0x1a0a00), fence: new Color(0xffaa40), ambient: new Color(0x331a00), fog: new Color(0x080400) },
];

// --- Achievements ---
export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_hit', name: 'First Contact', desc: 'Hit your first pitch' },
  { id: 'first_hr', name: 'Going Yard', desc: 'Hit your first home run' },
  { id: 'grand_slam', name: 'Grand Slam', desc: 'Hit a ball 120m+' },
  { id: 'combo_5', name: 'On Fire', desc: 'Reach a 5x combo' },
  { id: 'combo_10', name: 'Untouchable', desc: 'Reach a 10x combo' },
  { id: 'score_1k', name: 'Thousand Club', desc: 'Score 1,000 in one game' },
  { id: 'score_5k', name: 'Five Grand', desc: 'Score 5,000 in one game' },
  { id: 'score_10k', name: 'Ten Thousand', desc: 'Score 10,000 in one game' },
  { id: 'perfect_round', name: 'Perfect Round', desc: 'Hit every pitch in a round' },
  { id: 'derby_champ', name: 'Derby Champion', desc: 'Hit 5+ HRs in Home Run Derby' },
  { id: 'speed_demon', name: 'Speed Demon', desc: 'Hit 15+ in Speed Batting' },
  { id: 'streak_10', name: 'Streak King', desc: 'Hit 10 consecutive pitches' },
  { id: 'streak_20', name: 'Untouchable Streak', desc: '20 consecutive hits' },
  { id: 'daily_done', name: 'Daily Player', desc: 'Complete a Daily Challenge' },
  { id: 'hard_mode', name: 'Slugger Elite', desc: 'Win a game on Hard' },
  { id: 'curve_master', name: 'Curve Crusher', desc: 'Hit 10 curveballs' },
  { id: 'knuckle_hit', name: 'Knuckle Buster', desc: 'Hit a knuckleball' },
  { id: 'accuracy_90', name: 'Sharpshooter', desc: '90%+ accuracy in a game' },
  { id: 'distance_150', name: 'Moon Shot', desc: 'Hit a ball 150m+' },
  { id: 'all_modes', name: 'Versatile', desc: 'Play every game mode' },
];

// --- Game State Manager ---
export class GameStateManager {
  state: GameState = 'title';
  mode: GameMode = 'classic';
  difficulty: Difficulty = 'medium';
  score = 0;
  combo = 0;
  maxCombo = 0;
  hits = 0;
  misses = 0;
  homeRuns = 0;
  bestDistance = 0;
  pitchesThrown = 0;
  pitchesRemaining = 0;
  timeRemaining = 0;
  round = 1;
  maxRounds = 3;
  missesAllowed = 3;
  curvesHit = 0;
  knucklesHit = 0;
  modesPlayed = new Set<GameMode>();

  // Leaderboard
  leaderboard: { score: number; mode: string; date: string; accuracy: number }[] = [];
  // Achievements
  unlockedAchievements = new Set<string>();

  constructor() {
    this.loadPersistence();
  }

  loadPersistence(): void {
    try {
      const lb = localStorage.getItem('ns_leaderboard');
      if (lb) this.leaderboard = JSON.parse(lb);
      const ach = localStorage.getItem('ns_achievements');
      if (ach) this.unlockedAchievements = new Set(JSON.parse(ach));
      const mp = localStorage.getItem('ns_modes_played');
      if (mp) this.modesPlayed = new Set(JSON.parse(mp));
    } catch { /* ignore */ }
  }

  savePersistence(): void {
    try {
      localStorage.setItem('ns_leaderboard', JSON.stringify(this.leaderboard));
      localStorage.setItem('ns_achievements', JSON.stringify([...this.unlockedAchievements]));
      localStorage.setItem('ns_modes_played', JSON.stringify([...this.modesPlayed]));
    } catch { /* ignore */ }
  }

  resetGame(): void {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.homeRuns = 0;
    this.bestDistance = 0;
    this.pitchesThrown = 0;
    this.curvesHit = 0;
    this.knucklesHit = 0;
    this.round = 1;

    switch (this.mode) {
      case 'classic':
        this.pitchesRemaining = 10;
        this.maxRounds = 3;
        this.timeRemaining = 0;
        break;
      case 'derby':
        this.pitchesRemaining = 10;
        this.maxRounds = 1;
        this.timeRemaining = 0;
        break;
      case 'speed':
        this.pitchesRemaining = 999;
        this.maxRounds = 1;
        this.timeRemaining = 60;
        break;
      case 'streak':
        this.pitchesRemaining = 999;
        this.missesAllowed = 3;
        this.maxRounds = 1;
        this.timeRemaining = 0;
        break;
      case 'daily':
        this.pitchesRemaining = 15;
        this.maxRounds = 1;
        this.timeRemaining = 0;
        break;
      case 'practice':
        this.pitchesRemaining = 999;
        this.maxRounds = 1;
        this.timeRemaining = 0;
        break;
    }
  }

  addToLeaderboard(): void {
    const accuracy = this.pitchesThrown > 0 ? Math.round((this.hits / this.pitchesThrown) * 100) : 0;
    const entry = {
      score: this.score,
      mode: this.mode,
      date: new Date().toLocaleDateString(),
      accuracy,
    };
    this.leaderboard.push(entry);
    this.leaderboard.sort((a, b) => b.score - a.score);
    this.leaderboard = this.leaderboard.slice(0, 20);
    this.savePersistence();
  }

  getAccuracy(): number {
    return this.pitchesThrown > 0 ? Math.round((this.hits / this.pitchesThrown) * 100) : 0;
  }

  getComboMultiplier(): number {
    if (this.combo >= 20) return 10;
    if (this.combo >= 15) return 5;
    if (this.combo >= 10) return 3;
    if (this.combo >= 5) return 2;
    return 1;
  }
}
