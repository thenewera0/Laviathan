// Host side of a device link: answers the guest's WebRTC offer relayed
// through the backend, and exposes the live stream once tracks arrive.
// Media flows peer-to-peer; the backend only ever sees the handshake.

import { iceServers } from "./rtc";

let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;

export function getLinkedStream(): MediaStream | null {
  return stream;
}

export async function handleLinkSignal(
  data: any,
  sendSignal: (data: any) => void,
  onStream: (s: MediaStream) => void
) {
  if (data?.sdp?.type === "offer") {
    closeLink();
    pc = new RTCPeerConnection({ iceServers: iceServers() });
    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendSignal({ candidate: ev.candidate.toJSON() });
    };
    pc.ontrack = (ev) => {
      stream = ev.streams[0] ?? new MediaStream([ev.track]);
      onStream(stream);
    };
    await pc.setRemoteDescription(data.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal({ sdp: pc.localDescription?.toJSON() });
  } else if (data?.candidate && pc) {
    try {
      await pc.addIceCandidate(data.candidate);
    } catch {
      /* stale candidate after teardown */
    }
  }
}

export function closeLink() {
  pc?.close();
  pc = null;
  stream = null;
}
