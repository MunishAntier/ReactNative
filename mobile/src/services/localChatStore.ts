import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredConversation = {
  conversationId: number;
  peerUserId: number;
  peerDisplayName: string;
  peerAvatar?: string | null;
  lastMessageAt?: string;
  unreadCount: number;
};

function conversationsKey(myUserId: number) {
  return `conversations:${myUserId}`;
}

export async function loadConversations(myUserId: number): Promise<StoredConversation[]> {
  const raw = await AsyncStorage.getItem(conversationsKey(myUserId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function upsertConversation(
  myUserId: number,
  conversation: Omit<StoredConversation, 'unreadCount'> & Partial<Pick<StoredConversation, 'unreadCount'>>,
): Promise<StoredConversation> {
  const existing = await loadConversations(myUserId);
  const idx = existing.findIndex(
    c => c.conversationId === conversation.conversationId || c.peerUserId === conversation.peerUserId,
  );

  const base: StoredConversation =
    idx >= 0
      ? existing[idx]
      : {
          conversationId: conversation.conversationId,
          peerUserId: conversation.peerUserId,
          peerDisplayName: conversation.peerDisplayName,
          peerAvatar: conversation.peerAvatar ?? null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: 0,
        };

  const merged: StoredConversation = {
    ...base,
    ...conversation,
    unreadCount: conversation.unreadCount ?? base.unreadCount ?? 0,
  };

  const next = idx >= 0 ? [...existing.slice(0, idx), merged, ...existing.slice(idx + 1)] : [...existing, merged];
  next.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  await AsyncStorage.setItem(conversationsKey(myUserId), JSON.stringify(next));
  return merged;
}

export async function touchConversationLastMessageAt(
  myUserId: number,
  peerUserId: number,
  conversationId: number | null,
  lastMessageAt: string,
  peerDisplayNameFallback?: string,
): Promise<void> {
  const existing = await loadConversations(myUserId);
  const idx = existing.findIndex(c => c.peerUserId === peerUserId || (conversationId != null && c.conversationId === conversationId));
  if (idx < 0) {
    const id = conversationId ?? Date.now();
    await upsertConversation(myUserId, {
      conversationId: id,
      peerUserId,
      peerDisplayName: peerDisplayNameFallback || `User #${peerUserId}`,
      peerAvatar: null,
      lastMessageAt,
      unreadCount: 0,
    });
    return;
  }

  const conv = existing[idx];
  await upsertConversation(myUserId, {
    ...conv,
    lastMessageAt,
  });
}

