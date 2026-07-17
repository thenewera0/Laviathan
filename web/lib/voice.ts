// Voice engine: wake word + speech capture (Web Speech API), spoken
// replies (speechSynthesis), and a live amplitude signal for the entity.
//
// Phase 1 runs entirely in the browser — zero-install, low-latency.
// The backend exposes an optional faster-whisper /stt path, and Piper TTS
// arrives when voice quality matters more than setup cost (see README).
//
// Requires Chrome or Edge (Web Speech API). Wake phrase: "leviathan".

const WAKE_WORDS = ["leviathan", "leviathon", "leviaton", "hey leviathan"];

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: any) => void) | null;
};

export interface VoiceCallbacks {
  onWake: () => void;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onBargeIn: () => void;
  onSpokenWord: (word: string) => void;
  onSpeakStart: () => void;
  onSpeakEnd: () => void;
  onLevel: (v: number) => void;
  onMicReady: (ok: boolean) => void;
}

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export class VoiceEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array | null = null;
  private rafId = 0;

  private awake = false; // captured speech goes to the brain
  private ptt = false; // push-to-talk held
  private speaking = false; // TTS is playing
  private synthLevel = 0; // synthetic envelope while speaking
  private pendingUtterance = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  constructor(private cb: VoiceCallbacks) {}

  async start() {
    this.stopped = false;
    await this.initMicLevel();
    this.initRecognition();
    this.levelLoop();
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.rafId);
    this.recognition?.abort();
    window.speechSynthesis?.cancel();
  }

  // ---- microphone amplitude (drives the entity's listening ripple) ----

  private async initMicLevel() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.levelData = new Uint8Array(this.analyser.frequencyBinCount);
      src.connect(this.analyser);
      this.cb.onMicReady(true);
    } catch {
      this.cb.onMicReady(false);
    }
  }

  private levelLoop = () => {
    if (this.stopped) return;
    let level = 0;
    if (this.speaking) {
      // speechSynthesis exposes no amplitude — a decaying envelope,
      // re-struck on each word boundary, stands in for the voice.
      this.synthLevel *= 0.92;
      level = this.synthLevel + Math.random() * 0.04 * this.synthLevel;
    } else if (this.analyser && this.levelData) {
      this.analyser.getByteTimeDomainData(this.levelData);
      let sum = 0;
      for (let i = 0; i < this.levelData.length; i++) {
        const d = (this.levelData[i] - 128) / 128;
        sum += d * d;
      }
      level = Math.min(1, Math.sqrt(sum / this.levelData.length) * 4);
    }
    this.cb.onLevel(level);
    this.rafId = requestAnimationFrame(this.levelLoop);
  };

  // ---- speech recognition: wake word + capture ----

  private initRecognition() {
    if (!speechSupported()) return;
    const Ctor =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    const rec: SpeechRecognitionLike = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev: any) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t;
        else interim += t;
      }
      this.handleSpeech(interim, final);
    };

    // Chrome halts continuous recognition periodically — resurface it.
    rec.onend = () => {
      if (!this.stopped) {
        try {
          rec.start();
        } catch {
          setTimeout(() => !this.stopped && rec.start(), 400);
        }
      }
    };
    rec.onerror = () => {
      /* onend will restart */
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  private handleSpeech(interim: string, final: string) {
    const heard = (interim + " " + final).toLowerCase();

    // Barge-in: any speech while Leviathan talks silences it and hands
    // the floor back to you.
    if (this.speaking && (interim.trim() || final.trim())) {
      this.stopSpeaking();
      this.cb.onBargeIn();
      this.wakeUp();
    }

    if (!this.awake && !this.ptt) {
      if (WAKE_WORDS.some((w) => heard.includes(w))) this.wakeUp();
      return;
    }

    if (interim.trim()) {
      this.cb.onInterim(this.stripWake(interim));
      this.bumpSilenceTimer();
    }
    if (final.trim()) {
      this.pendingUtterance += " " + this.stripWake(final);
      this.bumpSilenceTimer(900); // short grace after a final chunk
    }
  }

  private wakeUp() {
    this.awake = true;
    this.pendingUtterance = "";
    this.cb.onWake();
    this.bumpSilenceTimer(6000); // wake window: speak within 6s
  }

  private stripWake(text: string): string {
    let out = text;
    for (const w of ["hey leviathan", "leviathan"]) {
      out = out.replace(new RegExp(w, "gi"), "");
    }
    return out.trim();
  }

  private bumpSilenceTimer(ms = 1600) {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this.finishUtterance(), ms);
  }

  private finishUtterance() {
    if (this.ptt) return; // PTT ends on key release, not on silence
    const text = this.pendingUtterance.trim();
    this.awake = false;
    this.pendingUtterance = "";
    if (text) this.cb.onFinal(text);
  }

  // ---- push-to-talk (hold Space) ----

  pttDown() {
    if (this.ptt) return;
    this.ptt = true;
    if (this.speaking) {
      this.stopSpeaking();
      this.cb.onBargeIn();
    }
    this.awake = true;
    this.pendingUtterance = "";
    this.cb.onWake();
  }

  pttUp() {
    if (!this.ptt) return;
    this.ptt = false;
    this.awake = false;
    const text = this.pendingUtterance.trim();
    this.pendingUtterance = "";
    if (text) this.cb.onFinal(text);
  }

  // ---- spoken replies ----

  speak(text: string) {
    if (!("speechSynthesis" in window) || !text.trim()) {
      this.cb.onSpeakEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);

    // Leviathan speaks low and deliberately — pick the deepest sane voice.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en.*(Daniel|George|Ryan)/i.test(v.name + v.lang)) ??
      voices.find((v) => /Google UK English Male/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en") && /male/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;
    utter.pitch = 0.75;
    utter.rate = 0.95;

    utter.onstart = () => {
      this.speaking = true;
      this.synthLevel = 0.6;
      this.cb.onSpeakStart();
    };
    utter.onboundary = (ev) => {
      this.synthLevel = 0.55 + Math.random() * 0.35;
      if (ev.name === "word") {
        const word = text.slice(ev.charIndex).split(/\s+/)[0];
        if (word) this.cb.onSpokenWord(word);
      }
    };
    const end = () => {
      if (!this.speaking) return;
      this.speaking = false;
      this.synthLevel = 0;
      this.cb.onSpeakEnd();
    };
    utter.onend = end;
    utter.onerror = end;

    window.speechSynthesis.speak(utter);
  }

  private stopSpeaking() {
    this.speaking = false;
    this.synthLevel = 0;
    window.speechSynthesis.cancel();
  }
}
