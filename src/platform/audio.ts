/**
 * Small synthesized sound effects (no audio files needed). Soft and short, so they stay
 * pleasant even after hundreds of snaps.
 */
export class SoundEffects {
  enabled = true;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  /** Must be called from a user gesture (e.g. the first touch) to allow audio on mobile. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      // Short burst of noise for the "click" of cardboard pieces.
      const length = Math.floor(this.ctx.sampleRate * 0.05);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Piece joined a neighbour (`locked` = false) or locked into its place on the board. */
  snap(locked: boolean): void {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;

    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = locked ? 1500 : 2200;
    band.Q.value = 1.2;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.5;
    click.connect(band).connect(clickGain).connect(ctx.destination);
    click.start(t);

    // A soft low "thock" gives the click some body.
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(locked ? 210 : 260, t);
    body.frequency.exponentialRampToValueAtTime(locked ? 120 : 160, t + 0.08);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(locked ? 0.35 : 0.22, t + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    body.connect(bodyGain).connect(ctx.destination);
    body.start(t);
    body.stop(t + 0.13);
  }

  /** Gentle rising chime when the puzzle is complete. */
  complete(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.05;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 1.4 : 0.6));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }
}
