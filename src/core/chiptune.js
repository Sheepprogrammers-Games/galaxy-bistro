// Galaxy Hunter: Gourmet Odyssey - Chiptune BGM
// 方波 / 三角波 / 噪声三种音色的 16 分音符步进音序器。
// 每条曲目自带调性、速度与四条声部（主旋律 / 贝斯 / 琶音 / 打击），循环播放。

const NOTE_OFFSETS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** 音名转频率，支持 C#4 / Bb1 这类写法。 */
function noteFreq(token) {
  const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(token);
  if (!m) return null;
  const semi = NOTE_OFFSETS[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 把 "A4 - - C5" 这样的谱面拆成每步一个音名或 null。 */
function parseLine(line) {
  return line.trim().split(/\s+/).map(t => (t === '-' ? null : t));
}

/** 多行谱面按顺序接成一条声部。 */
function seq(...lines) {
  return lines.flatMap(parseLine);
}

// 四条曲目。step 是 16 分音符，stepsPerBar 固定 16。
export const TRACKS = {
  // 荒野漫游：A 多利亚调，中速，飘忽的五声主题
  wilderness: {
    name: '荒野漫游',
    bpm: 112,
    lead: seq(
      'A4 -  -  C5 -  -  B4 -  D5 -  -  -  E5 -  -  - ',
      'D5 -  C5 -  A4 -  -  -  G4 -  A4 -  -  -  -  - ',
      'E5 -  -  D5 -  -  C5 -  B4 -  -  -  A4 -  -  - ',
      'G4 -  A4 -  C5 -  D5 -  E5 -  -  -  -  -  -  - '
    ),
    bass: seq(
      'A2 -  -  -  A2 -  -  -  E2 -  -  -  E2 -  -  - ',
      'G2 -  -  -  G2 -  -  -  D2 -  -  -  D2 -  -  - ',
      'F2 -  -  -  F2 -  -  -  C3 -  -  -  C3 -  -  - ',
      'G2 -  -  -  G2 -  -  -  D3 -  -  -  E2 -  -  - '
    ),
    arp: seq('A3 E4 A4 E4 A3 E4 C5 E4 G3 D4 G4 D4 A3 E4 A4 C5'),
    drums: seq('K -  -  H  -  -  K  -  H  -  -  -  K  -  H  - '),
    leadWave: 'square',
    leadDuty: 0.5,
    gain: 1
  },

  // 猎杀频段：D 小调，快速，八分音符推进的贝斯
  combat: {
    name: '猎杀频段',
    bpm: 150,
    lead: seq(
      'D5 -  D5 -  F5 -  E5 -  D5 -  C5 -  D5 -  -  - ',
      'A4 -  A4 -  C5 -  D5 -  E5 -  -  -  F5 -  E5 - ',
      'D5 -  D5 -  F5 -  A5 -  G5 -  F5 -  E5 -  D5 - ',
      'Bb4 - C5 -  D5 -  E5 -  F5 -  -  -  -  -  -  - '
    ),
    bass: seq(
      'D2 -  D2 -  D2 -  D2 -  D2 -  D2 -  C2 -  C2 - ',
      'Bb1 - Bb1 - Bb1 - Bb1 - C2 -  C2 -  C2 -  C2 - ',
      'D2 -  D2 -  D2 -  D2 -  F2 -  F2 -  F2 -  F2 - ',
      'Bb1 - Bb1 - C2 -  C2 -  D2 -  D2 -  D2 -  -  - '
    ),
    arp: seq('D4 A4 D5 A4 F4 C5 F5 C5 D4 A4 D5 F5 C4 G4 C5 E5'),
    drums: seq('K -  H  -  S  -  H  -  K  -  K  -  S  -  H  H '),
    leadWave: 'square',
    leadDuty: 0.25,
    gain: 1.05
  },

  // 营地夜话：F 大调五声，慢速，暖调拨弦
  camp: {
    name: '营地夜话',
    bpm: 88,
    lead: seq(
      'F4 -  -  A4 -  -  C5 -  -  A4 -  -  G4 -  -  - ',
      'C5 -  -  D5 -  -  C5 -  A4 -  -  F4 -  -  -  - ',
      'A4 -  -  C5 -  -  D5 -  F5 -  -  D5 -  C5 -  - ',
      'A4 -  -  G4 -  -  F4 -  -  -  -  -  -  -  -  - '
    ),
    bass: seq(
      'F2 -  -  -  -  -  -  -  C3 -  -  -  -  -  -  - ',
      'Bb2 - -  -  -  -  -  -  C3 -  -  -  -  -  -  - ',
      'F2 -  -  -  -  -  -  -  A2 -  -  -  -  -  -  - ',
      'Bb2 - -  -  -  -  -  -  C3 -  -  -  -  -  -  - '
    ),
    arp: seq('F3 C4 F4 A4 C4 F4 A4 C5 Bb3 F4 Bb4 D5 C4 G4 C5 E5'),
    drums: seq('-  -  H  -  -  -  H  -  -  -  H  -  -  -  H  - '),
    leadWave: 'triangle',
    leadDuty: 0.5,
    gain: 0.95
  },

  // 深空夜航：C 小调，极慢，只有长音与低频，不带鼓
  night: {
    name: '深空夜航',
    bpm: 72,
    lead: seq(
      'C5 -  -  -  -  -  Eb5 - -  -  -  -  G4 -  -  - ',
      'Bb4 - -  -  -  -  -  -  Ab4 - -  -  -  -  -  - ',
      'G4 -  -  -  -  -  Bb4 - -  -  -  -  C5 -  -  - ',
      'Eb5 - -  -  -  -  -  -  -  -  -  -  -  -  -  - '
    ),
    bass: seq(
      'C2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - ',
      'Ab1 - -  -  -  -  -  -  -  -  -  -  -  -  -  - ',
      'Eb2 - -  -  -  -  -  -  -  -  -  -  -  -  -  - ',
      'Bb1 - -  -  -  -  -  -  -  -  -  -  -  -  -  - '
    ),
    arp: seq('C4 -  -  G4 -  -  -  -  Eb4 - -  Bb4 - -  -  - '),
    drums: seq('-  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '),
    leadWave: 'triangle',
    leadDuty: 0.5,
    gain: 0.82
  }
};

/** 方波占空比用自定义周期波实现，25% 的脉冲比纯方波更"游戏机"。 */
function pulseWave(ctx, duty) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export class Chiptune {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} destination BGM 总线
   */
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(destination);

    this.trackId = null;
    this.track = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.waveCache = new Map();
    this.noiseBuffer = this._makeNoise();
  }

  _makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 0.28);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _wave(duty) {
    if (!this.waveCache.has(duty)) this.waveCache.set(duty, pulseWave(this.ctx, duty));
    return this.waveCache.get(duty);
  }

  get stepDuration() {
    return 60 / (this.track?.bpm || 120) / 4;
  }

  /** 切曲：淡出旧的，从头起新的。同一首重复调用不做任何事。 */
  play(trackId) {
    const track = TRACKS[trackId] || TRACKS.wilderness;
    if (this.trackId === trackId && this.timer) return;

    this.trackId = trackId;
    this.track = track;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.08;

    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.linearRampToValueAtTime(track.gain ?? 1, t + 1.1);

    if (!this.timer) this.timer = setInterval(() => this._schedule(), 40);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.trackId = null;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.linearRampToValueAtTime(0.0001, t + 0.25);
  }

  /** 提前 0.25 秒把音符排进音频线程，避免 setInterval 抖动被听出来。 */
  _schedule() {
    if (!this.track || this.ctx.state !== 'running') return;
    const horizon = this.ctx.currentTime + 0.25;

    while (this.nextStepTime < horizon) {
      this._emitStep(this.step, this.nextStepTime);
      this.nextStepTime += this.stepDuration;
      this.step++;
    }
  }

  _emitStep(step, when) {
    const tr = this.track;
    const sd = this.stepDuration;

    const at = (line) => (line && line.length ? line[step % line.length] : null);

    const lead = at(tr.lead);
    if (lead) this._pulse(noteFreq(lead), when, sd * 3.4, 0.085, tr.leadWave, tr.leadDuty);

    const bass = at(tr.bass);
    if (bass) this._pulse(noteFreq(bass), when, sd * 3.2, 0.13, 'triangle', 0.5);

    const arp = at(tr.arp);
    if (arp) this._pulse(noteFreq(arp), when, sd * 0.82, 0.028, 'square', 0.125);

    const drum = at(tr.drums);
    if (drum === 'K') this._kick(when);
    else if (drum === 'S') this._snare(when);
    else if (drum === 'H') this._hat(when);
  }

  _pulse(freq, when, dur, level, wave, duty) {
    if (!freq) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (wave === 'square') {
      osc.setPeriodicWave(this._wave(duty ?? 0.5));
    } else {
      osc.type = wave || 'triangle';
    }
    osc.frequency.setValueAtTime(freq, when);

    // 方块机的音量包络：瞬间起音，线性掉到底，没有拖尾
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.008);
    gain.gain.linearRampToValueAtTime(level * 0.55, when + dur * 0.35);
    gain.gain.linearRampToValueAtTime(0.0001, when + dur);

    osc.connect(gain);
    gain.connect(this.out);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  _kick(when) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(132, when);
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.1);
    gain.gain.setValueAtTime(0.2, when);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + 0.14);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(when);
    osc.stop(when + 0.16);
  }

  _snare(when) {
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    gain.gain.setValueAtTime(0.1, when);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + 0.13);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.out);
    src.start(when);
    src.stop(when + 0.15);
  }

  _hat(when) {
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    hp.type = 'highpass';
    hp.frequency.value = 6200;
    gain.gain.setValueAtTime(0.045, when);
    gain.gain.exponentialRampToValueAtTime(0.0006, when + 0.045);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.out);
    src.start(when);
    src.stop(when + 0.06);
  }
}
