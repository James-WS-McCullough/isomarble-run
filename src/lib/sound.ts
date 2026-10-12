import { assetPath } from "./assets";
import type { Marble } from "./simulation";
import { PHYSICS } from "./simulation";

interface RollingVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Marble sounds with the Web Audio API: a tap when a marble lands (louder
 * for harder landings) and a rolling loop per marble whose pitch and volume
 * follow its speed.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private tapBuffer: AudioBuffer | null = null;
  private rollBuffer: AudioBuffer | null = null;
  private readonly voices = new Map<string, RollingVoice>();
  private enabled = false;

  /** Must be called from a user gesture so the browser allows audio */
  async enable() {
    this.enabled = true;
    if (!this.context) {
      this.context = new AudioContext();
      const [tap, roll] = await Promise.all([
        this.load("/audio/MarbleTap.ogg"),
        this.load("/audio/MarbleRoll.ogg"),
      ]);
      this.tapBuffer = tap;
      this.rollBuffer = roll;
    }
    await this.context.resume();
  }

  disable() {
    this.enabled = false;
    for (const id of [...this.voices.keys()]) this.stopRolling(id);
  }

  /** Play a landing tap; `impact` is the falling speed */
  tap(impact: number) {
    const context = this.context;
    if (!this.enabled || !context || !this.tapBuffer) return;
    const source = context.createBufferSource();
    source.buffer = this.tapBuffer;
    source.playbackRate.value = 0.9 + Math.random() * 0.2;
    const gain = context.createGain();
    gain.gain.value = 0.15 + 0.55 * Math.min(1, impact / PHYSICS.MAX_SPEED);
    source.connect(gain).connect(context.destination);
    source.start();
  }

  /** Keep the rolling sounds in step with the marbles; call every frame */
  update(marbles: Marble[]) {
    const context = this.context;
    if (!this.enabled || !context || !this.rollBuffer) return;

    const rollingIds = new Set<string>();
    for (const marble of marbles) {
      if (marble.motion.mode !== "rolling") continue;
      rollingIds.add(marble.id);

      let voice = this.voices.get(marble.id);
      if (!voice) {
        const source = context.createBufferSource();
        source.buffer = this.rollBuffer;
        source.loop = true;
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(context.destination);
        source.start();
        voice = { source, gain };
        this.voices.set(marble.id, voice);
      }

      const pace = Math.min(1, marble.speed / PHYSICS.MAX_SPEED);
      const now = context.currentTime;
      voice.gain.gain.setTargetAtTime(0.12 + 0.35 * pace, now, 0.05);
      voice.source.playbackRate.setTargetAtTime(0.75 + 0.7 * pace, now, 0.05);
    }

    for (const id of [...this.voices.keys()]) {
      if (!rollingIds.has(id)) this.stopRolling(id);
    }
  }

  private stopRolling(id: string) {
    const voice = this.voices.get(id);
    if (!voice || !this.context) return;
    voice.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
    voice.source.stop(this.context.currentTime + 0.15);
    this.voices.delete(id);
  }

  private async load(path: string): Promise<AudioBuffer> {
    const response = await fetch(assetPath(path));
    const data = await response.arrayBuffer();
    if (!this.context) throw new Error("Audio is not set up");
    return this.context.decodeAudioData(data);
  }
}
