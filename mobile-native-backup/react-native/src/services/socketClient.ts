export type SocketEventHandler = (event: Record<string, unknown>) => void;
export type SocketStatusHandler = (status: 'connecting' | 'connected' | 'disconnected', reason?: string) => void;

export class SocketClient {
  private socket: WebSocket | null = null;

  public onEvent: SocketEventHandler = () => {};
  public onStatus: SocketStatusHandler = () => {};

  constructor(private readonly baseURL: string) {}

  connect(accessToken: string): void {
    this.disconnect();

    const wsBase = toWSBaseURL(this.baseURL);
    const wsURL = `${wsBase}/v1/ws?token=${encodeURIComponent(accessToken)}`;

    this.onStatus('connecting');
    this.socket = new WebSocket(wsURL);

    this.socket.onopen = () => {
      this.onStatus('connected');
    };

    this.socket.onclose = event => {
      this.onStatus('disconnected', event.reason || `code=${event.code}`);
      this.socket = null;
    };

    this.socket.onerror = () => {
      this.onStatus('disconnected', 'websocket error');
    };

    this.socket.onmessage = message => {
      const data = typeof message.data === 'string' ? message.data : '';
      try {
        const event = JSON.parse(data) as Record<string, unknown>;
        this.onEvent(event);
      } catch {
        this.onEvent({type: 'error', error: 'invalid websocket payload'});
      }
    };
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(event: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('websocket not connected');
    }
    this.socket.send(JSON.stringify(event));
  }
}

function toWSBaseURL(httpBaseURL: string): string {
  if (httpBaseURL.startsWith('https://')) {
    return `wss://${httpBaseURL.slice('https://'.length)}`;
  }
  if (httpBaseURL.startsWith('http://')) {
    return `ws://${httpBaseURL.slice('http://'.length)}`;
  }
  throw new Error(`unsupported backend URL: ${httpBaseURL}`);
}
