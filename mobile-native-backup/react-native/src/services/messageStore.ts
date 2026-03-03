import AsyncStorage from '@react-native-async-storage/async-storage';

import type {StoredCiphertextMessage, SyncMessage} from '../types';

const messagesKey = 'securemsg.messages';
const lastSyncKey = 'securemsg.last_sync';

export class MessageStore {
  async list(): Promise<StoredCiphertextMessage[]> {
    const raw = await AsyncStorage.getItem(messagesKey);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as StoredCiphertextMessage[];
    } catch {
      return [];
    }
  }

  async saveMessage(message: StoredCiphertextMessage): Promise<void> {
    const current = await this.list();
    const deduped = current.filter(existing => existing.id !== message.id);
    const next = [message, ...deduped].slice(0, 1000);
    await AsyncStorage.setItem(messagesKey, JSON.stringify(next));

    const currentLastSync = await this.getLastSync();
    if (!currentLastSync || Date.parse(message.createdAt) > Date.parse(currentLastSync)) {
      await this.setLastSync(message.createdAt);
    }
  }

  async saveSyncedMessages(items: SyncMessage[]): Promise<void> {
    for (const item of items) {
      await this.saveMessage({
        id: item.id,
        conversationId: item.conversation_id,
        senderId: item.sender_id,
        receiverId: item.receiver_id,
        ciphertextB64: item.ciphertext_b64,
        headerJSON: JSON.stringify(item.header ?? {}),
        createdAt: item.created_at
      });
    }
  }

  async getLastSync(): Promise<string | null> {
    return AsyncStorage.getItem(lastSyncKey);
  }

  async setLastSync(value: string): Promise<void> {
    await AsyncStorage.setItem(lastSyncKey, value);
  }
}
