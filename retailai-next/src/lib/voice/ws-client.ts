import { getAccessToken } from "../cognito";

export type CatalogMatch = {
  mention: string;
  match_type: "exact" | "fuzzy";
  score: number;
  product_names: string[];
  product_ids: string[];
  ambiguous: boolean;
  size_hint: string | null;
};

export type VoiceServerEvent =
  | {
      type: "transcript.partial" | "transcript.final";
      text: string;
      confidence: number;
      is_final: boolean;
      language_segments: unknown[];
    }
  | {
      type: "catalog.matches";
      query: string;
      product_names: string[];
      matches: CatalogMatch[];
    }
  | { type: "error"; error: string; detail?: string };

export class VoiceSocket {
  private ws: WebSocket | null = null;

  constructor(
    private onEvent: (event: VoiceServerEvent) => void,
    private onClose?: (reason: string) => void
  ) {}

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(sessionId: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not signed in");

    const base = process.env.NEXT_PUBLIC_VOICE_WS_URL ?? "ws://localhost:8000";
    const storeId = process.env.NEXT_PUBLIC_STORE_ID;
    if (!storeId) throw new Error("NEXT_PUBLIC_STORE_ID is not set");

    const url =
      `${base}/v1/voice/sessions/${encodeURIComponent(sessionId)}/stream` +
      `?token=${encodeURIComponent(token)}&store_id=${encodeURIComponent(storeId)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection failed"));
      ws.onmessage = (msg) => {
        if (typeof msg.data !== "string") return;
        try {
          this.onEvent(JSON.parse(msg.data) as VoiceServerEvent);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = (ev) => this.onClose?.(ev.reason || `closed (${ev.code})`);
      this.ws = ws;
    });
  }

  sendAudio(chunk: Blob | ArrayBuffer): void {
    if (this.isOpen) this.ws!.send(chunk);
  }

  endOfTurn(): void {
    if (this.isOpen) this.ws!.send(JSON.stringify({ type: "end_of_turn" }));
  }

  close(): void {
    if (this.isOpen) this.ws!.send(JSON.stringify({ type: "end_session" }));
    this.ws?.close();
    this.ws = null;
  }
}