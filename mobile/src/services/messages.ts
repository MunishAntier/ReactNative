import { apiFetch } from './api';

export interface Message {
    id: number;
    conversation_id: number;
    sender_id: number;
    sender_device_id?: number;
    receiver_id: number;
    client_message_id: string;
    ciphertext_b64: string;
    header: Record<string, any>;
    created_at: string;
    delivered_at?: string;
    read_at?: string;
}

export interface ConversationItem {
    conversation_id: number;
    peer_user_id: number;
    peer_email?: string;
    peer_phone?: string;
    last_message_id?: number;
    last_message_at?: string;
    unread_count: number;
}

/**
 * Sync messages since a given timestamp (offline sync).
 * Backend returns { items: [...] }
 */
export async function syncMessages(
    since: string,
    limit: number = 200,
): Promise<Message[]> {
    const res = await apiFetch(
        `/messages/sync?since=${encodeURIComponent(since)}&limit=${limit}`,
    );
    if (!res.ok) {
        throw new Error('Failed to sync messages');
    }
    const data = await res.json();
    return data.items || [];
}

/**
 * List conversations for the current user.
 * Backend returns { items: [...] }
 */
export async function listConversations(
    limit: number = 50,
): Promise<ConversationItem[]> {
    const res = await apiFetch(`/conversations?limit=${limit}`);
    if (!res.ok) {
        throw new Error('Failed to list conversations');
    }
    const data = await res.json();
    return data.items || [];
}

/**
 * Mark a message as read.
 */
export async function markMessageRead(messageId: number): Promise<void> {
    const res = await apiFetch(`/messages/${messageId}/read`, { method: 'POST' });
    if (!res.ok) {
        throw new Error('Failed to mark message as read');
    }
}
