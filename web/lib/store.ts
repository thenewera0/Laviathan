import { create } from "zustand";

export type EntityState = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface CaptionWord {
  id: number;
  text: string;
}

export interface Thought {
  id: number;
  text: string;
}

export type Media =
  | { kind: "image"; url: string; title: string }
  | { kind: "music"; videoId: string; title: string; url: string }
  | { kind: "link"; url: string; reason?: string }
  | { kind: "report"; title: string; markdown: string }
  | { kind: "invite"; url: string; purpose: string }
  | { kind: "live"; purpose: string };

export interface BgTask {
  id: string;
  kind: string;
  label: string;
  status: "running" | "done" | "failed";
  latest: string;
}

interface LeviathanStore {
  entityState: EntityState;
  /** Live mic / synthetic speech amplitude, 0..1. Written every frame —
   *  read via subscribe or getState() inside useFrame, not via hooks. */
  audioLevel: number;
  connected: boolean;
  micReady: boolean;
  wakeActive: boolean;
  model: string;
  provider: string;
  /** What the user is saying (interim transcript) */
  userTranscript: string;
  /** What Leviathan is saying, revealed word by word */
  captionWords: CaptionWord[];
  errorMessage: string;
  /** Live tool-activity log while it works (the ThoughtStream) */
  thoughts: Thought[];
  /** What the tools surfaced: an image, a player, a link card */
  media: Media | null;
  /** Long-running background work (research descents) */
  tasks: BgTask[];
  /** Phase 4: on-device gesture control + gaze */
  gesturesOn: boolean;
  lastGesture: { name: string; at: number } | null;
  /** Face position in [-1,1] (webcam-mirrored); null = no face / off */
  facePos: { x: number; y: number } | null;
  /** Live translation target language name, or null */
  translationLang: string | null;
  /** Whether a PC companion is paired to this session */
  companionOnline: boolean;
  /** Names of every paired PC */
  pcDevices: string[];
  deviceVitals: Record<string, any> | null;
  /** Code the builder wrote — shown in the IDE panel */
  codeProject: { project: string | null; files: { path: string; content: string }[] } | null;
  /** Device links minted this session — pinned in the dashboard, newest
   *  first, so the user can always copy them. */
  deviceLinks: { url: string; purpose: string; at: number }[];

  setEntityState: (s: EntityState) => void;
  setAudioLevel: (v: number) => void;
  setConnected: (v: boolean) => void;
  setMicReady: (v: boolean) => void;
  setWakeActive: (v: boolean) => void;
  setMeta: (provider: string, model: string) => void;
  setUserTranscript: (t: string) => void;
  pushCaptionWord: (text: string) => void;
  clearCaptions: () => void;
  setError: (m: string) => void;
  pushThought: (text: string) => void;
  clearThoughts: () => void;
  setMedia: (m: Media | null) => void;
  upsertTask: (t: BgTask) => void;
  removeTask: (id: string) => void;
  setGesturesOn: (v: boolean) => void;
  setLastGesture: (name: string) => void;
  setFacePos: (p: { x: number; y: number } | null) => void;
  setTranslationLang: (l: string | null) => void;
  setCompanionOnline: (v: boolean) => void;
  setPcDevices: (d: string[]) => void;
  setDeviceVitals: (v: Record<string, any>) => void;
  setCodeProject: (
    p: { project: string | null; files: { path: string; content: string }[] } | null
  ) => void;
  pushDeviceLink: (url: string, purpose: string) => void;
}

let wordId = 0;
let thoughtId = 0;

export const useLeviathan = create<LeviathanStore>((set) => ({
  entityState: "idle",
  audioLevel: 0,
  connected: false,
  micReady: false,
  wakeActive: false,
  model: "—",
  provider: "—",
  userTranscript: "",
  captionWords: [],
  errorMessage: "",
  thoughts: [],
  media: null,
  tasks: [],
  gesturesOn: false,
  lastGesture: null,
  facePos: null,
  translationLang: null,
  companionOnline: false,
  pcDevices: [],
  deviceVitals: null,
  codeProject: null,
  deviceLinks: [],

  setEntityState: (s) => set({ entityState: s }),
  setAudioLevel: (v) => set({ audioLevel: v }),
  setConnected: (v) => set({ connected: v }),
  setMicReady: (v) => set({ micReady: v }),
  setWakeActive: (v) => set({ wakeActive: v }),
  setMeta: (provider, model) => set({ provider, model }),
  setUserTranscript: (t) => set({ userTranscript: t }),
  pushCaptionWord: (text) =>
    set((st) => ({
      captionWords: [...st.captionWords, { id: wordId++, text }].slice(-40),
    })),
  clearCaptions: () => set({ captionWords: [] }),
  setError: (m) => set({ errorMessage: m }),
  pushThought: (text) =>
    set((st) => ({
      thoughts: [...st.thoughts, { id: thoughtId++, text }].slice(-6),
    })),
  clearThoughts: () => set({ thoughts: [] }),
  setMedia: (m) => set({ media: m }),
  upsertTask: (t) =>
    set((st) => {
      const rest = st.tasks.filter((x) => x.id !== t.id);
      return { tasks: [...rest, t].slice(-4) };
    }),
  removeTask: (id) =>
    set((st) => ({ tasks: st.tasks.filter((x) => x.id !== id) })),
  setGesturesOn: (v) => set({ gesturesOn: v }),
  setLastGesture: (name) => set({ lastGesture: { name, at: Date.now() } }),
  setFacePos: (p) => set({ facePos: p }),
  setTranslationLang: (l) => set({ translationLang: l }),
  setCompanionOnline: (v) => set({ companionOnline: v }),
  setPcDevices: (d) => set({ pcDevices: d, companionOnline: d.length > 0 }),
  setDeviceVitals: (v) => set({ deviceVitals: v }),
  setCodeProject: (p) => set({ codeProject: p }),
  pushDeviceLink: (url, purpose) =>
    set((st) => ({
      deviceLinks: [
        { url, purpose, at: Date.now() },
        ...st.deviceLinks.filter((l) => l.url !== url),
      ].slice(0, 5),
    })),
}));
