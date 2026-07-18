"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Captions from "@/components/Captions";
import GestureLayer from "@/components/GestureLayer";
import MediaLayer from "@/components/MediaLayer";
import StatusBar from "@/components/StatusBar";
import TaskPanel from "@/components/TaskPanel";
import ThoughtStream from "@/components/ThoughtStream";
import { captureFrame, captureScreen } from "@/lib/camera";
import { GestureEngine, type GestureName } from "@/lib/gestures";
import {
  closeLink,
  getLinkedStream,
  handleLinkSignal,
} from "@/lib/linkhost";
import { useLeviathan } from "@/lib/store";
import { speechSupported, VoiceEngine } from "@/lib/voice";
import { LeviathanSocket, type ServerMessage } from "@/lib/ws";

const Entity = dynamic(() => import("@/components/Entity/Entity"), {
  ssr: false,
});

export default function Home() {
  // Browsers require a user gesture before mic + audio — the first click
  // is the summoning.
  const [surfaced, setSurfaced] = useState(false);
  const socketRef = useRef<LeviathanSocket | null>(null);
  const engineRef = useRef<VoiceEngine | null>(null);
  const gesturesRef = useRef<GestureEngine | null>(null);

  const toggleGestures = useCallback((on: boolean) => {
    const s = useLeviathan.getState();
    if (!on) {
      gesturesRef.current?.stop();
      gesturesRef.current = null;
      s.setGesturesOn(false);
      return;
    }
    s.setGesturesOn(true);
    const ge = new GestureEngine({
      onGesture: (name: GestureName) => {
        const st = useLeviathan.getState();
        st.setLastGesture(name);
        if (name === "Open_Palm") {
          engineRef.current?.hush();
          socketRef.current?.sendInterrupt();
          st.setMedia(null);
        } else if (name === "Thumb_Up") {
          socketRef.current?.sendUserText("yes");
        } else if (name === "Thumb_Down") {
          socketRef.current?.sendUserText("no");
        } else if (name === "Victory") {
          engineRef.current?.beginListening();
        }
      },
      onFace: (p) => useLeviathan.getState().setFacePos(p),
      onReady: () => {},
      onError: (m) => {
        useLeviathan.getState().setError(m);
        useLeviathan.getState().setGesturesOn(false);
        setTimeout(() => useLeviathan.getState().setError(""), 5000);
      },
    });
    ge.start();
    gesturesRef.current = ge;
  }, []);

  const surface = useCallback(async () => {
    if (surfaced) return;
    setSurfaced(true);
    const st = useLeviathan.getState();

    const socket = new LeviathanSocket(
      (msg: ServerMessage) => {
        const s = useLeviathan.getState();
        switch (msg.type) {
          case "meta":
            s.setMeta(msg.provider, msg.model);
            break;
          case "state":
            if (msg.state === "thinking") {
              s.clearCaptions();
              s.clearThoughts();
            }
            s.setEntityState(msg.state as any);
            break;
          case "thought":
            s.pushThought(msg.text);
            break;
          case "task":
            s.upsertTask({
              id: msg.id,
              kind: msg.kind,
              label: msg.label,
              status:
                msg.event === "done"
                  ? "done"
                  : msg.event === "failed"
                    ? "failed"
                    : "running",
              latest: msg.text ?? "",
            });
            break;
          case "announce":
            // Background work surfacing on its own — voice it
            s.clearCaptions();
            engineRef.current?.speak(msg.text);
            break;
          case "action":
            if (msg.action === "show_image") {
              s.setMedia({ kind: "image", url: msg.url, title: msg.title });
            } else if (msg.action === "show_report") {
              s.setMedia({
                kind: "report",
                title: msg.title,
                markdown: msg.markdown,
              });
            } else if (msg.action === "show_link_invite") {
              s.setMedia({
                kind: "invite",
                url: msg.url,
                purpose: msg.purpose,
              });
              navigator.clipboard?.writeText(msg.url).catch(() => {});
            } else if (msg.action === "play_music") {
              s.setMedia({
                kind: "music",
                videoId: msg.video_id,
                title: msg.title,
                url: msg.url,
              });
            } else if (msg.action === "open_url") {
              // Popup blockers eat non-gesture window.open — the link
              // card is the reliable path, the tab a best effort.
              s.setMedia({ kind: "link", url: msg.url, reason: msg.reason });
              window.open(msg.url, "_blank", "noopener");
            }
            break;
          case "request_frame":
            (msg.source === "screen" ? captureScreen() : captureFrame()).then(
              (frame) => socketRef.current?.sendFrame(frame ?? "")
            );
            break;
          case "translation":
            s.setTranslationLang(msg.lang ? (msg.name ?? msg.lang) : null);
            break;
          case "companion":
            s.setCompanionOnline(msg.status === "online");
            break;
          case "link_signal":
            handleLinkSignal(
              msg.data,
              (data) => socketRef.current?.sendLinkSignal(data),
              () => {
                const st = useLeviathan.getState();
                const purpose =
                  st.media?.kind === "invite" ? st.media.purpose : "camera";
                st.setMedia({ kind: "live", purpose });
              }
            );
            break;
          case "link_closed":
            closeLink();
            if (["live", "invite"].includes(s.media?.kind ?? "")) {
              s.setMedia(null);
            }
            break;
          case "reply_done":
            if (speechSupported() && "speechSynthesis" in window) {
              engineRef.current?.speak(msg.text, msg.lang);
              // Non-English voices often skip word-boundary events, so
              // captions surface at once in translation mode
              if (msg.lang && !msg.lang.startsWith("en")) {
                msg.text.split(/\s+/).forEach((w) => s.pushCaptionWord(w));
              }
            } else {
              // No TTS available: reveal the words directly
              s.setEntityState("speaking");
              msg.text.split(/\s+/).forEach((w) => s.pushCaptionWord(w));
              setTimeout(() => s.setEntityState("idle"), 2500);
            }
            break;
          case "error":
            s.setError(msg.message);
            setTimeout(() => {
              useLeviathan.getState().setError("");
              useLeviathan.getState().setEntityState("idle");
            }, 5000);
            break;
        }
      },
      (connected) => useLeviathan.getState().setConnected(connected)
    );
    socket.connect();
    socketRef.current = socket;

    const engine = new VoiceEngine({
      onWake: () => {
        const s = useLeviathan.getState();
        s.setUserTranscript("");
        s.clearCaptions();
        s.setEntityState("listening");
      },
      onInterim: (t) => useLeviathan.getState().setUserTranscript(t),
      onFinal: (text) => {
        useLeviathan.getState().setUserTranscript(text);
        socket.sendUserText(text);
      },
      onBargeIn: () => socket.sendInterrupt(),
      onSpokenWord: (w) => useLeviathan.getState().pushCaptionWord(w),
      onSpeakStart: () => useLeviathan.getState().setEntityState("speaking"),
      onSpeakEnd: () => {
        const s = useLeviathan.getState();
        if (s.entityState === "speaking") s.setEntityState("idle");
        s.setUserTranscript("");
      },
      onLevel: (v) => useLeviathan.getState().setAudioLevel(v),
      onMicReady: (ok) => {
        useLeviathan.getState().setMicReady(ok);
        if (!ok) {
          useLeviathan
            .getState()
            .setError("microphone denied — grant access and reload");
        }
      },
    });
    await engine.start();
    engineRef.current = engine;

    if (!speechSupported()) {
      st.setError("speech recognition needs Chrome or Edge");
    }
  }, [surfaced]);

  // Push-to-talk: hold Space
  useEffect(() => {
    if (!surfaced) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        engineRef.current?.pttDown();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        engineRef.current?.pttUp();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [surfaced]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      gesturesRef.current?.stop();
      socketRef.current?.close();
    };
  }, []);

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden">
      {surfaced && <Entity />}

      {surfaced ? (
        <>
          <StatusBar />
          <Captions />
          <ThoughtStream />
          <TaskPanel />
          <MediaLayer
            getLiveStream={getLinkedStream}
            onDismiss={(kind) => {
              if (kind === "live" || kind === "invite") {
                closeLink();
                socketRef.current?.sendLinkClose();
              }
            }}
          />
          <GestureLayer onToggle={toggleGestures} />
        </>
      ) : (
        <button
          onClick={surface}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-6 outline-none"
          aria-label="Summon Leviathan — enables microphone and audio"
        >
          <span className="font-voice text-4xl font-light tracking-[0.45em] text-foam/80 transition-colors duration-700 group-hover:text-lumen md:text-5xl">
            LEVIATHAN
          </span>
          <span className="font-data text-[11px] uppercase tracking-[0.4em] text-foam/30 transition-colors duration-700 group-hover:text-foam/60 group-focus-visible:text-lumen">
            click to surface
          </span>
        </button>
      )}
    </main>
  );
}
