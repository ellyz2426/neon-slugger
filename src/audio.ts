// Audio manager for Neon Slugger VR
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicPad: OscillatorNode | null = null;
  private musicLfo: OscillatorNode | null = null;
  private masterVol = 1.0;
  private sfxVol = 1.0;
  private musicVol = 0.3;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.musicGain.gain.value = this.musicVol;
    this.startAmbientMusic();
  }

  private ensure(): AudioContext {
    if (!this.ctx) this.init();
    return this.ctx!;
  }

  private startAmbientMusic(): void {
    const ctx = this.ensure();
    // Bass drone
    this.musicOsc = ctx.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.value = 55;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.15;
    this.musicOsc.connect(bassGain);
    bassGain.connect(this.musicGain!);
    this.musicOsc.start();

    // Pad
    this.musicPad = ctx.createOscillator();
    this.musicPad.type = 'triangle';
    this.musicPad.frequency.value = 110;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.08;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 400;
    this.musicPad.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.musicGain!);
    this.musicPad.start();

    // LFO
    this.musicLfo = ctx.createOscillator();
    this.musicLfo.type = 'sine';
    this.musicLfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    this.musicLfo.connect(lfoGain);
    lfoGain.connect(this.musicOsc.frequency);
    this.musicLfo.start();
  }

  setMasterVolume(v: number): void {
    this.masterVol = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }
  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }
  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }
  getMasterVolume(): number { return this.masterVol; }
  getSfxVolume(): number { return this.sfxVol; }
  getMusicVolume(): number { return this.musicVol; }

  private playSfx(freq: number, type: OscillatorType, dur: number, vol: number): void {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private playNoise(dur: number, vol: number, freq?: number): void {
    const ctx = this.ensure();
    const bufSize = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    if (freq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 2;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(this.sfxGain!);
    src.start();
  }

  playPitchThrow(): void {
    this.playNoise(0.15, 0.2, 2000);
    this.playSfx(800, 'sine', 0.1, 0.15);
  }

  playSwing(): void {
    this.playNoise(0.2, 0.35, 1500);
    this.playSfx(400, 'sawtooth', 0.15, 0.1);
  }

  playHit(intensity: number): void {
    const ctx = this.ensure();
    // Crack
    this.playNoise(0.08, 0.5 * intensity, 3000);
    // Ping
    this.playSfx(1200 * intensity, 'square', 0.12, 0.2 * intensity);
    // Sub thud
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;
    const g = ctx.createGain();
    g.gain.value = 0.3 * intensity * this.sfxVol;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playMiss(): void {
    this.playSfx(200, 'sawtooth', 0.3, 0.15);
    this.playSfx(150, 'sine', 0.4, 0.1);
  }

  playHomeRun(): void {
    const ctx = this.ensure();
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      g.gain.linearRampToValueAtTime(0.2 * this.sfxVol, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  }

  playFoul(): void {
    this.playNoise(0.1, 0.2, 2500);
    this.playSfx(300, 'triangle', 0.2, 0.1);
  }

  playCountdownTick(): void {
    this.playSfx(880, 'sine', 0.08, 0.2);
  }

  playCountdownGo(): void {
    this.playSfx(1320, 'sine', 0.15, 0.3);
    this.playSfx(1760, 'square', 0.2, 0.15);
  }

  playGameStart(): void {
    const ctx = this.ensure();
    [440, 554, 659, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      g.gain.linearRampToValueAtTime(0.15 * this.sfxVol, ctx.currentTime + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.25);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.25);
    });
  }

  playGameOver(): void {
    const ctx = this.ensure();
    [660, 523, 440, 330].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      g.gain.linearRampToValueAtTime(0.12 * this.sfxVol, ctx.currentTime + i * 0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  }

  playAchievement(): void {
    const ctx = this.ensure();
    [880, 1100, 1320, 1760, 2200].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      g.gain.linearRampToValueAtTime(0.12 * this.sfxVol, ctx.currentTime + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.2);
    });
  }

  playButtonClick(): void {
    this.playSfx(1000, 'sine', 0.05, 0.15);
  }

  playCombo(level: number): void {
    this.playSfx(600 + level * 100, 'triangle', 0.15, 0.2);
  }

  playPowerUp(): void {
    const ctx = this.ensure();
    // Rising shimmer
    [660, 880, 1100, 1320].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
      g.gain.linearRampToValueAtTime(0.15 * this.sfxVol, ctx.currentTime + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.18);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.18);
    });
    // Sub pulse
    this.playSfx(80, 'sine', 0.15, 0.2);
  }
}
