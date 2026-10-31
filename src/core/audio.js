/**
 * Galaxy Hunter: Gourmet Odyssey - Web Audio Synthesizer & Procedural Sound Engine
 * Provides rich procedural sound effects and dynamic alien wilderness ambient BGM
 * without external audio file dependencies.
 */

import { Chiptune, TRACKS } from './chiptune.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;

    this.isMuted = false;
    this.masterVolume = 0.8;
    this.sfxVolume = 0.85;
    this.bgmVolume = 0.45;

    // Chiptune BGM State
    this.chiptune = null;
    this.bgmPlaying = false;
    this.currentTheme = 'wilderness'; // 'wilderness' | 'combat' | 'camp' | 'night'
    this.bgmNodes = [];
    this.bgmTimer = null;
    this.stepCounter = 0;

    // SFX throttle / cooldown to prevent sound clipping
    this.sfxCooldowns = new Map();
  }

  /**
   * Initializes or resumes the Web Audio context upon user interaction.
   */
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }
      this.ctx = new AudioContextClass();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // BGM Bus
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Toggles master mute state.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (!this.isMuted && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setSFXVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setBGMVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.05);
    }
  }

  // ==========================================
  // PROCEDURAL SOUND EFFECTS
  // ==========================================

  /**
   * Main entry point to play sound effects.
   * @param {string} type - SFX name identifier
   * @param {object} [options] - Custom pitch/volume params
   */
  playSFX(type, options = {}) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    // Cooldown check for rapid triggers (e.g. footsteps)
    const now = performance.now();
    const minInterval = options.throttle || (type === 'footstep' ? 120 : 30);
    const cooldownKey = options.cooldownKey || type;
    const lastTime = this.sfxCooldowns.get(cooldownKey) || 0;
    if (now - lastTime < minInterval) return;
    this.sfxCooldowns.set(cooldownKey, now);

    switch (type) {
      case 'footstep':
        this._sfxFootstep(options);
        break;
      case 'sword_slash':
        this._sfxSwordSlash(options);
        break;
      case 'sword_heavy':
        this._sfxSwordHeavy(options);
        break;
      case 'shield_parry':
        this._sfxShieldParry(options);
        break;
      case 'hit_impact':
        this._sfxHitImpact(options);
        break;
      case 'monster_roar':
        this._sfxMonsterRoar(options);
        break;
      case 'item_pickup':
        this._sfxItemPickup(options);
        break;
      case 'ui_hover':
        this._sfxUiHover(options);
        break;
      case 'dash':
        this._sfxDash(options);
        break;
      case 'level_up':
        this._sfxLevelUp(options);
        break;
      case 'cook_sizzle':
        this._sfxCookSizzle(options);
        break;
      case 'cook_fanfare':
        this._sfxCookFanfare(options);
        break;
      default:
        console.warn(`[AudioManager] Unknown SFX type: ${type}`);
    }
  }

  // Backwards-compatible shorthand used by gameplay systems.
  play(type, options = {}) {
    return this.playSFX(type, options);
  }

  /**
   * Footstep: alien dirt/moss thud with subtle pitch jitter
   */
  _sfxFootstep(opts = {}) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const volume = opts.volume ?? 1;

    const baseFreq = opts.pitch || (75 + Math.random() * 25);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    gain.gain.setValueAtTime(0.2 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * Sword Slash: crisp swoosh with fast frequency sweep & white noise slice
   */
  _sfxSwordSlash(opts = {}) {
    const t = this.ctx.currentTime;
    const duration = opts.duration || 0.16;
    const basePitch = opts.pitch || 520;
    const volume = opts.volume ?? 1;

    // 1. Tonal swoosh
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(basePitch, t);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.27, t + duration);

    oscGain.gain.setValueAtTime(0.28 * volume, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration);

    // 2. High-pass noise blade whoosh
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(basePitch * 3.45, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(basePitch * 0.86, t + duration);
    noiseFilter.Q.setValueAtTime(3.0, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35 * volume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(t);
  }

  /**
   * Sword Heavy: charged energy cleave with bass thump and plasma crackle
   */
  _sfxSwordHeavy(opts = {}) {
    const t = this.ctx.currentTime;
    const duration = opts.duration || 0.35;
    const basePitch = opts.pitch || 260;
    const volume = opts.volume ?? 1;

    // Sub rumble & down-sweep
    const osc1 = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(basePitch, t);
    osc1.frequency.exponentialRampToValueAtTime(Math.max(28, basePitch * 0.17), t + duration);

    oscGain.gain.setValueAtTime(0.5 * volume, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(420, basePitch * 3.45), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, basePitch * 0.46), t + duration);

    osc1.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc1.start(t);
    osc1.stop(t + duration + 0.01);

    // Energy buzz
    const osc2 = this.ctx.createOscillator();
    const osc2Gain = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(basePitch * 0.62, t);
    osc2.frequency.setValueAtTime(basePitch * 0.92, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(Math.max(35, basePitch * 0.23), t + duration * 0.72);

    osc2Gain.gain.setValueAtTime(0.25 * volume, t);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.72);

    osc2.connect(osc2Gain);
    osc2Gain.connect(this.sfxGain);

    osc2.start(t);
    osc2.stop(t + duration * 0.75);
  }

  /**
   * Shield Parry: crisp metal ring with high resonant ping (perfect guard)
   */
  _sfxShieldParry(opts = {}) {
    const t = this.ctx.currentTime;
    const pitchScale = (opts.pitch || 1200) / 1200;
    const volume = opts.volume ?? 1;

    // Metal ping harmonics
    const freqs = [1200, 1850, 2600, 3800];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * pitchScale, t);
      osc.frequency.exponentialRampToValueAtTime(freq * pitchScale * 0.95, t + 0.4);

      const vol = (0.25 * volume) / (idx + 1);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.35 + idx * 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.45);
    });

    // Sub shockwave impact
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(180 * pitchScale, t);
    subOsc.frequency.exponentialRampToValueAtTime(Math.max(28, 40 * pitchScale), t + 0.15);

    subGain.gain.setValueAtTime(0.4 * volume, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    subOsc.start(t);
    subOsc.stop(t + 0.16);
  }

  /**
   * Hit Impact: punchy meat/armor impact with noise pop
   */
  _sfxHitImpact(opts = {}) {
    const t = this.ctx.currentTime;
    const isCrit = !!opts.crit;
    const basePitch = opts.pitch || (isCrit ? 380 : 220);
    const volume = opts.volume ?? 1;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isCrit ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(basePitch, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);

    gain.gain.setValueAtTime((isCrit ? 0.6 : 0.4) * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.19);

    // Crunch noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.3 * volume, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  /**
   * Monster Roar: deep FM synthesized low guttural alien roar
   */
  _sfxMonsterRoar(opts = {}) {
    const t = this.ctx.currentTime;
    const duration = opts.duration || 0.6;
    const basePitch = opts.pitch || 90;
    const volume = opts.volume ?? 1;

    // Carrier Oscillator
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(basePitch, t);
    carrier.frequency.exponentialRampToValueAtTime(basePitch * 1.6, t + duration * 0.3);
    carrier.frequency.exponentialRampToValueAtTime(basePitch * 0.6, t + duration);

    // Modulator Oscillator for guttural texture
    const mod = this.ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(35, t);
    mod.frequency.linearRampToValueAtTime(18, t + duration);

    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(80, t);
    modGain.gain.exponentialRampToValueAtTime(20, t + duration);

    mod.connect(carrier.frequency);

    // Formant Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + duration * 0.3);
    filter.frequency.exponentialRampToValueAtTime(300, t + duration);
    filter.Q.setValueAtTime(4.0, t);

    // Gain Envelope
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.55 * volume, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    mod.start(t);
    carrier.start(t);
    mod.stop(t + duration);
    carrier.stop(t + duration + 0.02);
  }

  /**
   * Item Pickup: sparkling upward 3-tone chime
   */
  _sfxItemPickup(opts = {}) {
    const t = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    const volume = opts.volume ?? 1;

    notes.forEach((freq, i) => {
      const noteTime = t + i * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.22 * volume, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  }

  /**
   * 菜单移动：一声很短的三角波点击。
   */
  _sfxUiHover(opts = {}) {
    const t = this.ctx.currentTime;
    const volume = opts.volume ?? 1;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046.5, t);
    osc.frequency.exponentialRampToValueAtTime(1568.0, t + 0.05);

    gain.gain.setValueAtTime(0.14 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Dash: aerodynamic whoosh with rapid pitch drop
   */
  _sfxDash(opts = {}) {
    const t = this.ctx.currentTime;
    const duration = opts.duration || 0.2;
    const pitch = opts.pitch || 1400;
    const volume = opts.volume ?? 1;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(pitch, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, pitch * 0.18), t + duration);
    filter.Q.setValueAtTime(2.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
  }

  /**
   * Level Up: triumphant ascending 4-chord fanfare
   */
  _sfxLevelUp(opts = {}) {
    const t = this.ctx.currentTime;
    const volume = opts.volume ?? 1;
    const chords = [
      [261.63, 329.63, 392.0], // C
      [293.66, 369.99, 440.0], // D
      [329.63, 415.3, 493.88], // E
      [523.25, 659.25, 783.99, 1046.5] // C octave
    ];

    chords.forEach((chord, step) => {
      const stepTime = t + step * 0.12;
      const stepDuration = step === chords.length - 1 ? 0.5 : 0.18;

      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, stepTime);

        gain.gain.setValueAtTime((0.18 * volume) / chord.length, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.0005, stepTime + stepDuration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(stepTime);
        osc.stop(stepTime + stepDuration + 0.02);
      });
    });
  }

  /**
   * Cook Sizzle: hot pan sizzle and crackle burst
   */
  _sfxCookSizzle(opts = {}) {
    const t = this.ctx.currentTime;
    const duration = opts.duration || 0.28;
    const volume = opts.volume ?? 1;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Crackle bursts
      const crackle = Math.random() > 0.94 ? (Math.random() * 2 - 1) * 2.5 : (Math.random() * 2 - 1) * 0.4;
      data[i] = crackle;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1600, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
  }

  /**
   * Cook Fanfare: gourmet dish completion celebration melody
   */
  _sfxCookFanfare(opts = {}) {
    const t = this.ctx.currentTime;
    const volume = opts.volume ?? 1;
    const melody = [
      { f: 523.25, d: 0.1 },  // C5
      { f: 659.25, d: 0.1 },  // E5
      { f: 783.99, d: 0.1 },  // G5
      { f: 1046.5, d: 0.28 }, // C6
      { f: 880.0, d: 0.12 },  // A5
      { f: 1046.5, d: 0.45 }  // C6 long
    ];

    let offset = 0;
    melody.forEach((note) => {
      const noteTime = t + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, noteTime);

      gain.gain.setValueAtTime(0.24 * volume, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.d);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + note.d + 0.05);

      offset += note.d * 0.85;
    });
  }

  // ==========================================
  // DYNAMIC PROCEDURAL AMBIENT BGM
  // ==========================================

  /**
   * Starts or transitions procedural ambient BGM for alien wilderness.
   * @param {string} [theme='wilderness'] - 'wilderness' | 'combat' | 'camp' | 'night'
   */
  startBGM(theme = 'wilderness') {
    this.init();
    if (!this.ctx) return;

    this.currentTheme = theme;
    this.bgmPlaying = true;

    if (!this.chiptune) this.chiptune = new Chiptune(this.ctx, this.bgmGain);
    this.chiptune.play(theme);
  }

  /** 当前正在播的曲目 id。 */
  getBGMTheme() {
    return this.currentTheme || null;
  }

  /**
   * Stops BGM playback and clears active loops.
   */
  stopBGM() {
    this.bgmPlaying = false;
    this.currentTheme = null;
    this.chiptune?.stop();

    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }

    this.bgmNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.bgmNodes = [];
  }




}

// Export singleton instance for global convenience
export const audio = new AudioManager();
