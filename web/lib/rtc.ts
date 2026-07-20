// Shared ICE configuration for device links. STUN alone cannot traverse
// most real-world NATs (a phone on cellular reaching a PC on wi-fi), which
// is why a link can "do nothing" — the peers never find a path. We add
// free TURN relays so a route almost always exists.
//
// For maximum reliability, drop in your own TURN (e.g. a free Metered
// account, 50 GB/mo) via NEXT_PUBLIC_TURN_URL / _USER / _CRED.

export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Free public TURN (best-effort) — covers most cross-network cases
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];

  const url = process.env.NEXT_PUBLIC_TURN_URL;
  if (url) {
    servers.push({
      urls: url,
      username: process.env.NEXT_PUBLIC_TURN_USER,
      credential: process.env.NEXT_PUBLIC_TURN_CRED,
    });
  }
  return servers;
}
