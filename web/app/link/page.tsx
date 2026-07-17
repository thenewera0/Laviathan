"use client";

// The guest side of a device link. Nothing is shared until the person
// on THIS device clicks share and approves the browser's permission
// prompt. A visible indicator stays on while sharing; stop ends it
// instantly. The link token works once and expires.

import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE =
  process.env.NEXT_PUBLIC_LEVIATHAN_WS ?? "ws://localhost:8000/ws";

type Stage = "idle" | "connecting" | "choose" | "sharing" | "ended" | "invalid";

export default function LinkPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [purpose, setPurpose] = useState("camera");
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!token) {
      setStage("invalid");
      return;
    }
    setStage("connecting");
    const ws = new WebSocket(WS_BASE.replace(/\/ws$/, "") + `/link/${token}`);
    wsRef.current = ws;

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "link_invalid") setStage("invalid");
      if (msg.type === "link_ready") {
        setPurpose(msg.purpose ?? "camera");
        setStage("choose");
      }
      if (msg.type === "signal" && pcRef.current) {
        if (msg.data?.sdp?.type === "answer") {
          await pcRef.current.setRemoteDescription(msg.data.sdp);
        } else if (msg.data?.candidate) {
          try {
            await pcRef.current.addIceCandidate(msg.data.candidate);
          } catch {
            /* teardown race */
          }
        }
      }
    };
    ws.onclose = () =>
      setStage((s) => (s === "sharing" || s === "choose" ? "ended" : s));

    return () => stopSharing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = useCallback(async (kind: "camera" | "screen") => {
    try {
      const stream =
        kind === "camera"
          ? await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            })
          : await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => {
        pc.addTrack(t, stream);
        t.onended = () => stopSharing(); // browser "stop sharing" bar
      });
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          wsRef.current?.send(
            JSON.stringify({
              type: "signal",
              data: { candidate: ev.candidate.toJSON() },
            })
          );
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(
        JSON.stringify({
          type: "signal",
          data: { sdp: pc.localDescription?.toJSON() },
        })
      );
      setStage("sharing");
    } catch {
      /* permission denied — stay on choose */
    }
  }, []);

  function stopSharing(silent = false) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    wsRef.current?.close();
    if (!silent) setStage("ended");
  }

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      <p className="font-voice text-3xl font-light tracking-[0.35em] text-foam/80">
        LEVIATHAN
      </p>

      {stage === "connecting" && (
        <p className="font-data text-[12px] tracking-wider text-foam/40 status-live">
          reaching across…
        </p>
      )}

      {stage === "invalid" && (
        <p className="max-w-sm font-data text-[12px] leading-5 text-cold">
          this link is spent or expired — links work once and die after ten
          minutes. Ask for a fresh one.
        </p>
      )}

      {stage === "choose" && (
        <>
          <p className="max-w-md font-voice text-lg italic leading-relaxed text-foam/70">
            Someone asked to see through this device. Nothing is shared until
            you choose — and you can stop at any moment.
          </p>
          <div className="flex gap-4">
            {(purpose === "camera" || purpose === "any") && (
              <button
                onClick={() => share("camera")}
                className="border border-lumen/30 px-5 py-2 font-data text-[12px] tracking-wider text-lumen transition-colors hover:bg-lumen/10 focus-visible:bg-lumen/10"
              >
                share camera + mic
              </button>
            )}
            <button
              onClick={() => share("screen")}
              className="border border-foam/20 px-5 py-2 font-data text-[12px] tracking-wider text-foam/70 transition-colors hover:bg-foam/10 focus-visible:bg-foam/10"
            >
              share screen
            </button>
          </div>
        </>
      )}

      {stage === "sharing" && (
        <>
          <p className="font-data text-[12px] tracking-[0.3em] text-glint status-live">
            ● SHARING LIVE
          </p>
          <button
            onClick={() => stopSharing()}
            className="border border-cold/50 px-6 py-2 font-data text-[12px] tracking-wider text-cold transition-colors hover:bg-cold/10 focus-visible:bg-cold/10"
          >
            stop sharing
          </button>
        </>
      )}

      {stage === "ended" && (
        <p className="font-data text-[12px] tracking-wider text-foam/40">
          the link is closed. this device shares nothing now.
        </p>
      )}
    </main>
  );
}
