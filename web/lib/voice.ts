// Voice engine: wake word + speech capture (Web Speech API), spoken
// replies (speechSynthesis), and a live amplitude signal for the entity.
//
// Phase 1 runs entirely in the browser — zero-install, low-latency.
// The backend exposes an optional faster-whisper /stt path, and Piper TTS
// arrives when voice quality matters more than setup cost (see README).
//
// Requires Chrome or Edge (Web Speech API). Wake phrase: "leviathan".

// Recognition mangles rare names — accept the common mishearings too
const WAKE_WORDS = [
  "leviathan",
  "leviathon",
  "leviaton",
  "levithan",
  "laviathan",
  "leviatan",
  "leviathin",
  "levi athan",
  "levia than",
  "hey leviathan",
  "okay leviathan",
];

// Fuzzy wake match: ASR rarely nails "leviathan", so also accept its
// distinctive phoneme clusters and near-spellings. Requires the "…viath…"
// core so it catches "leviathin", "the viathan", "love eeathan" — but NOT
// common words like level/lever/leverage. Hands-free, but not trigger-happy.
const WAKE_FUZZY =
  /\b(le?v[iy]a?th|l[ae]v[iy]ath)\w*|\w*(viath|iathan|eviath|iathon|vaithan|eeathan)\w*/i;

function isWake(heard: string): boolean {
  const h = heard.toLowerCase();
  return WAKE_WORDS.some((w) => h.includes(w)) || WAKE_FUZZY.test(h);
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
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
  private lastInterim = ""; // newest interim — the safety net on silence
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private recPaused = false; // recognition muted while Leviathan speaks
  private recRunning = false; // is SpeechRecognition actually live right now
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private signatureVoice: SpeechSynthesisVoice | null = null; // pinned once
  private signatureNeural = false; // is the pinned voice a neural voice
  private voiceResolved = false;
  // Neural TTS (Gemini) playback
  private ttsCtx: AudioContext | null = null;
  private ttsAnalyser: AnalyserNode | null = null;
  private ttsData: Uint8Array | null = null;
  private ttsSource: AudioBufferSourceNode | null = null;
  private ttsCaptionTimer: ReturnType<typeof setInterval> | null = null;
  private neuralOk = true; // flips false if the endpoint keeps failing

  constructor(private cb: VoiceCallbacks) {}

  async start() {
    this.stopped = false;
    this.resolveSignatureVoice();
    await this.initMicLevel();
    this.initRecognition();
    this.levelLoop();
  }

  // Leviathan must sound the SAME every time, and sound REAL — not a flat
  // synth. We resolve one voice once, strongly preferring the neural
  // "Natural"/"Online" voices (Edge/Chrome on Windows ship these; they are
  // near-human), and never re-pick it. `signatureNeural` then tunes prosody.
  private resolveSignatureVoice() {
    const pick = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      if (voices.length === 0) return;
      const en = voices.filter((v) => /^en/i.test(v.lang));
      const pool = en.length ? en : voices;
      const by = (re: RegExp) => pool.find((v) => re.test(v.name));

      this.signatureVoice =
        // 1) Microsoft neural male voices — deep, composed, authoritative
        by(/Microsoft (Guy|Andrew|Christopher|Roger|Eric|Steffan).*(Online|Natural)/i) ??
        by(/(Guy|Andrew|Christopher|Roger|Steffan).*Natural/i) ??
        // 2) any male "Natural"/"Online" neural voice
        pool.find((v) => /Natural|Online/i.test(v.name) && /male|guy|andrew|christopher|roger|eric|steffan|brian|davis/i.test(v.name)) ??
        // 3) Google's fuller male voice
        by(/Google UK English Male/i) ??
        by(/Google US English/i) ??
        // 4) classic local male voices
        by(/Microsoft (David|Mark|George|Ryan)/i) ??
        by(/\b(Daniel|Arthur|Oliver|George|Ryan|Guy|Alex)\b/i) ??
        // 5) anything English
        pool[0] ??
        voices[0] ??
        null;
      this.signatureNeural = !!(
        this.signatureVoice &&
        /Natural|Online|Google/i.test(this.signatureVoice.name)
      );
      this.voiceResolved = true;
    };
    pick();
    if (!this.voiceResolved && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        if (!this.voiceResolved) pick();
      };
    }
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.rafId);
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.ttsCaptionTimer) clearInterval(this.ttsCaptionTimer);
    try {
      this.ttsSource?.stop();
    } catch {
      /* already stopped */
    }
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
    if (this.speaking && this.ttsAnalyser && this.ttsData) {
      // Neural voice: the entity pulses to Leviathan's ACTUAL waveform.
      this.ttsAnalyser.getByteTimeDomainData(this.ttsData);
      let sum = 0;
      for (let i = 0; i < this.ttsData.length; i++) {
        const d = (this.ttsData[i] - 128) / 128;
        sum += d * d;
      }
      level = Math.min(1, Math.sqrt(sum / this.ttsData.length) * 5);
    } else if (this.speaking) {
      // Browser TTS exposes no amplitude — a decaying envelope stands in.
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
    rec.maxAlternatives = 3; // scan alternatives for the wake word

    rec.onstart = () => {
      this.recRunning = true;
    };

    rec.onresult = (ev: any) => {
      let interim = "";
      let final = "";
      let altPool = ""; // all alternatives, for forgiving wake detection
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const t = res[0].transcript;
        if (res.isFinal) final += t;
        else interim += t;
        for (let a = 0; a < res.length; a++) altPool += " " + res[a].transcript;
      }
      this.handleSpeech(interim, final, altPool);
    };

    // Chrome halts continuous recognition periodically — resurface it.
    // While recPaused (Leviathan is speaking), stay silent: otherwise the
    // mic hears the TTS voice and feeds it back as user speech.
    rec.onend = () => {
      this.recRunning = false;
      if (!this.stopped && !this.recPaused) this.startRecognition();
    };
    rec.onerror = (ev: any) => {
      this.recRunning = false;
      // 'no-speech'/'aborted'/'network' are recoverable — the watchdog and
      // onend restart. 'not-allowed' means the mic was denied: surface it.
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        this.cb.onMicReady(false);
      }
    };

    this.recognition = rec;
    this.startRecognition();
    this.startWatchdog();
  }

  // A single, guarded start — never double-starts (that throws in Chrome).
  private startRecognition() {
    if (this.stopped || this.recPaused || this.recRunning || !this.recognition)
      return;
    try {
      this.recognition.start();
    } catch {
      /* already starting; onstart/watchdog will reconcile */
    }
  }

  // Self-healing: continuous recognition silently dies (tab throttling, a
  // dropped onend, a swallowed error). Every 2.5s, if it should be running
  // but isn't, restart it. THIS is what keeps the wake word alive after
  // Leviathan speaks — the single-shot resume used to fail and never retry.
  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      if (!this.stopped && !this.recPaused && !this.recRunning) {
        this.startRecognition();
      }
    }, 2500);
  }

  private handleSpeech(interim: string, final: string, altPool = "") {
    // Recognition is paused during TTS; anything that still arrives is
    // the tail of Leviathan's own voice — drop it.
    if (this.speaking) return;

    if (!this.awake && !this.ptt) {
      // Check the top transcript AND every alternative for the wake word.
      if (!isWake(interim + " " + final + " " + altPool)) return;
      this.wakeUp();
      // DO NOT return: "leviathan tell me X" often arrives as ONE event —
      // the command rides in the same breath as the name. Fall through so
      // this event's text (wake word stripped) is captured as the command.
    }

    if (interim.trim()) {
      this.lastInterim = this.stripWake(interim);
      this.cb.onInterim(this.lastInterim);
      this.bumpSilenceTimer();
    }
    if (final.trim()) {
      this.pendingUtterance += " " + this.stripWake(final);
      this.lastInterim = "";
      this.bumpSilenceTimer(1300); // grace after a final chunk
    }
  }

  private wakeUp() {
    this.awake = true;
    this.pendingUtterance = "";
    this.lastInterim = "";
    this.cb.onWake();
    this.bumpSilenceTimer(8000); // wake window: speak within 8s
  }

  private stripWake(text: string): string {
    let out = text;
    for (const w of [...WAKE_WORDS].sort((a, b) => b.length - a.length)) {
      out = out.replace(new RegExp(w.replace(/\s+/g, "\\s*"), "gi"), "");
    }
    return out.replace(/^[\s,.]+/, "").trim();
  }

  private bumpSilenceTimer(ms = 2100) {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this.finishUtterance(), ms);
  }

  private finishUtterance() {
    if (this.ptt) return; // PTT ends on key release, not on silence
    // Finals lag interims by a second or more — if silence hit before the
    // browser finalized, the interim IS the utterance. Never drop words.
    const text = (this.pendingUtterance + " " + this.lastInterim).trim();
    this.awake = false;
    this.pendingUtterance = "";
    this.lastInterim = "";
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
    const text = (this.pendingUtterance + " " + this.lastInterim).trim();
    this.pendingUtterance = "";
    this.lastInterim = "";
    if (text) this.cb.onFinal(text);
  }

  // ---- gesture hooks ----

  /** Start listening as if the wake word was heard (gesture-triggered). */
  beginListening() {
    if (this.speaking) {
      this.stopSpeaking();
      this.cb.onBargeIn();
    }
    this.wakeUp();
  }

  /** Silence any speech in progress (open-palm gesture). */
  hush() {
    if (this.speaking) {
      this.stopSpeaking();
      this.cb.onSpeakEnd();
    }
  }

  // ---- spoken replies ----

  private ttsUrl(): string {
    const ws =
      process.env.NEXT_PUBLIC_LEVIATHAN_WS ?? "ws://localhost:8000/ws";
    return ws.replace(/^ws/, "http").replace(/\/ws$/, "") + "/tts";
  }

  // Leviathan's real voice: fetch neural audio from the backend and play it,
  // driving the entity from the ACTUAL waveform. Returns false on any
  // failure so the caller can fall back to browser TTS.
  private async speakNeural(text: string): Promise<boolean> {
    if (!this.neuralOk) return false;
    let buf: ArrayBuffer;
    try {
      const res = await fetch(this.ttsUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        if (res.status === 503) this.neuralOk = false; // TTS disabled server-side
        return false;
      }
      buf = await res.arrayBuffer();
    } catch {
      return false;
    }
    if (this.stopped) return true;

    try {
      const ctx = this.ttsCtx ?? new AudioContext();
      this.ttsCtx = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const audio = await ctx.decodeAudioData(buf.slice(0));

      const source = ctx.createBufferSource();
      source.buffer = audio;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      this.ttsAnalyser = analyser;
      this.ttsData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      this.ttsSource = source;

      this.speaking = true;
      this.pauseRecognition();
      this.cb.onSpeakStart();
      this.startCaptionReveal(text, audio.duration);

      const done = () => this.endNeural();
      source.onended = done;
      source.start();
      return true;
    } catch {
      this.endNeural();
      return false;
    }
  }

  private startCaptionReveal(text: string, duration: number) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    const step = Math.max(120, (duration * 1000) / words.length);
    let i = 0;
    this.ttsCaptionTimer = setInterval(() => {
      if (i >= words.length) {
        if (this.ttsCaptionTimer) clearInterval(this.ttsCaptionTimer);
        this.ttsCaptionTimer = null;
        return;
      }
      this.cb.onSpokenWord(words[i++]);
    }, step);
  }

  private endNeural() {
    if (this.ttsCaptionTimer) clearInterval(this.ttsCaptionTimer);
    this.ttsCaptionTimer = null;
    this.ttsAnalyser = null;
    this.ttsData = null;
    try {
      this.ttsSource?.stop();
    } catch {
      /* already stopped */
    }
    this.ttsSource = null;
    if (!this.speaking) return;
    this.speaking = false;
    this.resumeRecognition();
    this.cb.onSpeakEnd();
  }

  speak(text: string, lang?: string) {
    if (!text.trim()) {
      this.cb.onSpeakEnd();
      return;
    }
    // Non-English (translation mode) uses browser voices matched to the
    // target tongue. English uses Leviathan's neural voice, with browser
    // TTS as the fallback.
    if (lang && !lang.startsWith("en")) {
      this.speakBrowser(text, lang);
      return;
    }
    this.speakNeural(text).then((ok) => {
      if (!ok) this.speakBrowser(text);
    });
  }

  private speakBrowser(text: string, lang?: string) {
    if (!("speechSynthesis" in window) || !text.trim()) {
      this.cb.onSpeakEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);

    if (lang && !lang.startsWith("en")) {
      // Translation mode only: the voice must match the target tongue
      const voices = window.speechSynthesis.getVoices();
      const match =
        voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ??
        voices.find((v) => v.lang.toLowerCase().split("-")[0] === lang);
      if (match) utter.voice = match;
      utter.lang = match?.lang ?? lang;
      utter.pitch = 0.9;
      utter.rate = 0.95;
    } else {
      // Leviathan's signature voice — the SAME pinned voice every time.
      if (!this.signatureVoice) this.resolveSignatureVoice();
      if (this.signatureVoice) utter.voice = this.signatureVoice;
      if (this.signatureNeural) {
        // Neural voices already sound human — pushing pitch/rate hard makes
        // them robotic again. Keep near-natural, just a touch lower and
        // slower for gravitas: an authoritative, composed super-mind.
        utter.pitch = 0.92;
        utter.rate = 0.96;
      } else {
        // Flat local synth — a deeper, slower delivery masks the machine.
        utter.pitch = 0.78;
        utter.rate = 0.95;
      }
    }

    utter.onstart = () => {
      this.speaking = true;
      this.synthLevel = 0.6;
      // Mute the ears while the mouth works — otherwise the mic hears
      // Leviathan's own voice and mangles the next utterance.
      this.pauseRecognition();
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
      this.resumeRecognition();
      this.cb.onSpeakEnd();
    };
    utter.onend = end;
    utter.onerror = end;

    window.speechSynthesis.speak(utter);
  }

  private stopSpeaking() {
    const wasSpeaking = this.speaking;
    this.speaking = false;
    this.synthLevel = 0;
    // stop neural playback
    if (this.ttsCaptionTimer) clearInterval(this.ttsCaptionTimer);
    this.ttsCaptionTimer = null;
    this.ttsAnalyser = null;
    this.ttsData = null;
    try {
      this.ttsSource?.stop();
    } catch {
      /* already stopped */
    }
    this.ttsSource = null;
    // stop browser TTS
    window.speechSynthesis?.cancel();
    if (wasSpeaking) this.resumeRecognition();
  }

  private pauseRecognition() {
    this.recPaused = true;
    try {
      this.recognition?.abort();
    } catch {
      /* not running */
    }
  }

  private resumeRecognition() {
    if (!this.recPaused) return;
    this.recPaused = false;
    // Brief gap so the tail of the TTS audio isn't captured. The watchdog
    // is the real safety net — even if this exact restart misses, the
    // 2.5s loop brings the mic back, so the wake word never dies.
    setTimeout(() => this.startRecognition(), 300);
  }
}
