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
  | { kind: "report"; title: string; markdown: string };

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
}));
