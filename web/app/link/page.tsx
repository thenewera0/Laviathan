"use client";

// The guest side of a device link. Nothing is shared until the person
// on THIS device clicks share and approves the browser's permission
// prompt. A visible indicator stays on while sharing; stop ends it
// instantly. The link stays valid for the host session's lifetime and
// reconnects after drops — one device at a time.

import { useCallback, useEffect, useRef, useState } from "react";
import { iceServers } from "@/lib/rtc";

const WS_BASE =
  process.env.NEXT_PUBLIC_LEVIATHAN_WS ?? "ws://localhost:8000/ws";

type Stage = "idle" | "connecting" | "choose" | "sharing" | "ended" | "invalid";

export default function LinkPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [purpose, setPurpose] = useState("camera");
  const [conn, setConn] = useState(""); // live connection state, shown to user
  const [shareError, setShareError] = useState(""); // never fail silently
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

    let gotReady = false;
    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "link_invalid") setStage("invalid");
      if (msg.type === "link_ready") {
        gotReady = true;
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
    // A close during "connecting" must never hang the page on
    // "reaching across…" — surface it as ended so RETRY appears.
    ws.onclose = () =>
      setStage((s) =>
        s === "sharing" || s === "choose" || (s === "connecting" && !gotReady)
          ? "ended"
          : s
      );

    return () => stopSharing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = useCallback(async (kind: "camera" | "screen") => {
    setShareError("");
    try {
      const stream =
        kind === "camera"
          ? await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            })
          : await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      pcRef.current = pc;
      // Surface the real connection state so a failed link is never silent.
      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (st === "checking") setConn("connecting to the other device…");
        else if (st === "connected" || st === "completed")
          setConn("connected — live");
        else if (st === "failed")
          setConn("could not reach the other device (network blocked it)");
        else if (st === "disconnected") setConn("connection dropped");
      };
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
    } catch (err: any) {
      // NEVER fail silently — tell the person exactly what to fix.
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setShareError(
          kind === "camera"
            ? "camera blocked — tap the lock icon in the address bar, allow Camera & Microphone, then try again"
            : "screen share was cancelled or blocked — try again and pick a screen"
        );
      } else if (name === "NotFoundError") {
        setShareError("no camera found on this device");
      } else if (name === "NotReadableError") {
        setShareError("the camera is busy in another app — close it and try again");
      } else {
        setShareError("could not start sharing — reload this page and try again");
      }
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
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-sm font-data text-[12px] leading-5 text-cold">
            this link isn&apos;t active — either another device is connected
            on it right now, or the Leviathan session that created it has
            closed. Ask for a fresh link, or retry.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="border border-lumen/30 px-5 py-2 font-data text-[12px] tracking-wider text-lumen transition-colors hover:bg-lumen/10"
          >
            retry
          </button>
        </div>
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
          {shareError && (
            <p className="max-w-sm font-data text-[11px] leading-5 text-glint">
              {shareError}
            </p>
          )}
        </>
      )}

      {stage === "sharing" && (
        <>
          <p className="font-data text-[12px] tracking-[0.3em] text-glint status-live">
            ● SHARING LIVE
          </p>
          {conn && (
            <p className="max-w-xs font-data text-[11px] leading-4 text-foam/45">
              {conn}
            </p>
          )}
          <button
            onClick={() => stopSharing()}
            className="border border-cold/50 px-6 py-2 font-data text-[12px] tracking-wider text-cold transition-colors hover:bg-cold/10 focus-visible:bg-cold/10"
          >
            stop sharing
          </button>
        </>
      )}

      {stage === "ended" && (
        <div className="flex flex-col items-center gap-4">
          <p className="font-data text-[12px] tracking-wider text-foam/40">
            the connection closed. this device shares nothing now — the link
            is still valid, so you can reconnect.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="border border-lumen/30 px-5 py-2 font-data text-[12px] tracking-wider text-lumen transition-colors hover:bg-lumen/10"
          >
            reconnect
          </button>
        </div>
      )}
    </main>
  );
}
