import { getAccessToken } from './api';
import { replenishOneTimePreKeys } from './keys';

type EventHandler = (data: any) => void;

interface WebSocketConfig {
    url?: string;
    reconnectMaxAttempts?: number;
    reconnectBaseDelay?: number;
    presencePingInterval?: number;
}

class SecureWebSocket {
    private ws: WebSocket | null = null;
    private userId: number | null = null;
    private handlers = new Map<string, Set<EventHandler>>();
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private presenceTimer: ReturnType<typeof setInterval> | null = null;
    private intentionallyClosed = false;
    private config: Required<WebSocketConfig>;

    constructor(config: WebSocketConfig = {}) {
        this.config = {
            url: config.url || 'ws://127.0.0.1:8080/v1/ws',
            reconnectMaxAttempts: config.reconnectMaxAttempts || 10,
            reconnectBaseDelay: config.reconnectBaseDelay || 1000,
            presencePingInterval: config.presencePingInterval || 60000,
        };
    }

    connect(userId: number): void {
        this.userId = userId;
        const token = getAccessToken();
        if (!token) {
            console.warn('[WS] No access token, cannot connect');
            return;
        }

        this.intentionallyClosed = false;
        const url = `${this.config.url}?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[WS] Connected');
            this.reconnectAttempts = 0;
            this.emit('connection', { status: 'connected' });
            this.startPresencePing();
        };

        this.ws.onmessage = (event: WebSocketMessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);
                const type = data.type as string;

                // Handle system events
                if (type === 'prekeys.low' && this.userId) {
                    replenishOneTimePreKeys(this.userId).catch(err =>
                        console.error('[WS] Failed to replenish pre-keys:', err),
                    );
                }

                this.emit(type, data);
                this.emit('*', data); // wildcard listener
            } catch (err) {
                console.error('[WS] Failed to parse message:', err);
            }
        };

        this.ws.onerror = (event: Event) => {
            console.error('[WS] Error:', event);
            this.emit('error', event);
        };

        this.ws.onclose = (event: WebSocketCloseEvent) => {
            console.log('[WS] Closed:', event.code, event.reason);
            this.stopPresencePing();
            this.emit('connection', { status: 'disconnected' });
            if (!this.intentionallyClosed) {
                this.scheduleReconnect();
            }
        };
    }

    private startPresencePing(): void {
        this.stopPresencePing();
        this.presenceTimer = setInterval(() => {
            this.send({ type: 'presence.ping' });
        }, this.config.presencePingInterval);
    }

    private stopPresencePing(): void {
        if (this.presenceTimer) {
            clearInterval(this.presenceTimer);
            this.presenceTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.config.reconnectMaxAttempts) {
            console.warn('[WS] Max reconnect attempts reached');
            this.emit('connection', { status: 'failed' });
            return;
        }

        const delay =
            this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts) +
            Math.random() * 1000;

        this.reconnectAttempts++;
        console.log(
            `[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`,
        );

        this.reconnectTimer = setTimeout(() => {
            if (this.userId) {
                this.connect(this.userId);
            }
        }, delay);
    }

    send(payload: object): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        } else {
            console.warn('[WS] Cannot send, not connected');
        }
    }

    /**
     * Send an encrypted message through WebSocket.
     */
    sendMessage(
        conversationId: number | null,
        receiverUserId: number,
        clientMessageId: string,
        ciphertextB64: string,
        header: Record<string, any>,
    ): void {
        this.send({
            type: 'message.send',
            conversation_id: conversationId,
            receiver_user_id: receiverUserId,
            client_message_id: clientMessageId,
            ciphertext_b64: ciphertextB64,
            header,
        });
    }

    /**
     * Acknowledge message delivery.
     */
    ackDelivered(serverMessageId: number): void {
        this.send({
            type: 'message.ack.delivered',
            server_message_id: serverMessageId,
        });
    }

    /**
     * Acknowledge message read.
     */
    ackRead(serverMessageId: number): void {
        this.send({
            type: 'message.ack.read',
            server_message_id: serverMessageId,
        });
    }

    on(event: string, handler: EventHandler): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);
        return () => this.handlers.get(event)?.delete(handler);
    }

    private emit(event: string, data: any): void {
        this.handlers.get(event)?.forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error(`[WS] Handler error for ${event}:`, err);
            }
        });
    }

    disconnect(): void {
        this.intentionallyClosed = true;
        this.stopPresencePing();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
        this.userId = null;
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Singleton instance
export const websocket = new SecureWebSocket();
export type { EventHandler };
