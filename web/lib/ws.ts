// WebSocket client for the Leviathan Core. Reconnects with backoff;
// all model traffic flows through the backend — no keys ever live here.

export type ServerAction =
  | { type: "action"; action: "open_url"; url: string; reason?: string }
  | {
      type: "action";
      action: "play_music";
      video_id: string;
      title: string;
      url: string;
    }
  | { type: "action"; action: "show_image"; url: string; title: string }
  | { type: "action"; action: "show_report"; title: string; markdown: string }
  | {
      type: "action";
      action: "show_link_invite";
      url: string;
      purpose: string;
      token?: string;
    }
  | {
      type: "action";
      action: "show_code";
      project: string | null;
      files: { path: string; content: string }[];
    };

export type ServerMessage =
  | { type: "meta"; provider: string; model: string; tools?: string[] }
  | { type: "state"; state: string }
  | { type: "reply_delta"; text: string }
  | { type: "reply_done"; text: string; lang?: string }
  | { type: "thought"; text: string }
  | {
      type: "task";
      event: "started" | "update" | "done" | "failed";
      id: string;
      kind: string;
      label: string;
      text?: string;
    }
  | { type: "announce"; text: string }
  | { type: "translation"; lang: string | null; name?: string }
  | { type: "request_frame"; source?: "camera" | "screen" }
  | { type: "link_guest_joined"; purpose: string }
  | { type: "link_signal"; data: any }
  | { type: "link_closed" }
  | { type: "companion"; status: "online" | "offline"; devices?: string[] }
  | { type: "vitals"; device?: string; data: Record<string, any> }
  | { type: "memories"; items: { id: string; text: string; created: string }[] }
  | { type: "schedules"; items: any[] }
  | { type: "error"; message: string }
  | ServerAction;

const WS_URL =
  process.env.NEXT_PUBLIC_LEVIATHAN_WS ?? "ws://localhost:8000/ws";

export class LeviathanSocket {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closed = false;

  constructor(
    private onMessage: (msg: ServerMessage) => void,
    private onStatus: (connected: boolean) => void
  ) {}

  connect() {
    this.closed = false;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.retry = 0;
      this.onStatus(true);
      // Re-register any active device link so it survives this reconnect
      // (and backend restarts) — the guest URL keeps working.
      try {
        const saved = localStorage.getItem("leviathan_link");
        if (saved) {
          const { token, purpose } = JSON.parse(saved);
          if (token) this.send({ type: "relink", token, purpose });
        }
      } catch {
        /* no stored link */
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };

    this.ws.onclose = () => {
      this.onStatus(false);
      if (!this.closed) {
        const delay = Math.min(1000 * 2 ** this.retry++, 10000);
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendUserText(text: string) {
    this.send({ type: "user_text", text });
  }

  sendInterrupt() {
    this.send({ type: "interrupt" });
  }

  sendFrame(base64Jpeg: string) {
    this.send({ type: "frame", data: base64Jpeg });
  }

  sendLinkSignal(data: any) {
    this.send({ type: "link_signal", data });
  }

  sendLinkClose() {
    this.send({ type: "link_close" });
  }

  getMemories() {
    this.send({ type: "get_memories" });
  }

  forgetMemory(id: string) {
    this.send({ type: "forget_memory", id });
  }

  getSchedules() {
    this.send({ type: "get_schedules" });
  }

  cancelSchedule(id: string) {
    this.send({ type: "cancel_schedule_ui", id });
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
