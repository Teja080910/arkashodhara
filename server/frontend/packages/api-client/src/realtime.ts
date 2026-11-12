export interface RealtimeClientOptions {
  wsUrl: string;
  token: string;
  onEvent: (event: Record<string, unknown>) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private readonly topics = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(private readonly options: RealtimeClientOptions) {}

  connect(): void {
    if (this.closed) return;
    const socket = new WebSocket(this.options.wsUrl);
    this.socket = socket;

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token: this.options.token }));
    });

    socket.addEventListener('message', (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (message.type === 'ready') {
        if (this.topics.size > 0) {
          socket.send(JSON.stringify({ type: 'subscribe', topics: [...this.topics] }));
        }
        this.options.onReady?.();
        return;
      }

      if (message.type === 'error') {
        this.options.onError?.(String(message.message ?? 'unknown'));
        return;
      }

      this.options.onEvent(message);
    });

    socket.addEventListener('close', () => {
      if (this.closed) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  subscribe(topic: string): void {
    this.topics.add(topic);
    this.socket?.send(JSON.stringify({ type: 'subscribe', topics: [topic] }));
  }

  unsubscribe(topic: string): void {
    this.topics.delete(topic);
    this.socket?.send(JSON.stringify({ type: 'unsubscribe', topics: [topic] }));
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }
}
