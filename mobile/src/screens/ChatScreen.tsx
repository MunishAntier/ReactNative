import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { websocket } from '../services/websocket';
import { sendEncryptedMessage, decryptIncomingMessage, isMessageAlreadyDecrypted } from '../services/signal';
import { syncMessages } from '../services/messages';

interface ChatMessage {
    id: string;
    text: string;
    isMine: boolean;
    timestamp: string;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    serverMessageId?: number;
}

interface ChatScreenProps {
    conversationId: number | null;
    peerUserId: number;
    myUserId: number;
    onGoBack: () => void;
}

// ── Local message cache helpers (Issue 15) ──

function cacheKey(myUserId: number, peerUserId: number): string {
    const a = Math.min(myUserId, peerUserId);
    const b = Math.max(myUserId, peerUserId);
    return `chat_cache:${a}:${b}`;
}

function syncTimestampKey(myUserId: number): string {
    return `last_sync_ts:${myUserId}`;
}

async function loadCachedMessages(myUserId: number, peerUserId: number): Promise<ChatMessage[]> {
    try {
        const raw = await AsyncStorage.getItem(cacheKey(myUserId, peerUserId));
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

async function saveCachedMessages(myUserId: number, peerUserId: number, msgs: ChatMessage[]): Promise<void> {
    // Keep only the latest 500 messages per conversation
    const trimmed = msgs.slice(-500);
    await AsyncStorage.setItem(cacheKey(myUserId, peerUserId), JSON.stringify(trimmed));
}

const ChatScreen: React.FC<ChatScreenProps> = ({
    conversationId,
    peerUserId,
    myUserId,
    onGoBack,
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [securityWarning, setSecurityWarning] = useState(false);
    const lastPeerDeviceIdRef = useRef(1); // Use ref to avoid stale closure (Issue 14)
    const flatListRef = useRef<FlatList>(null);
    const convIdRef = useRef(conversationId);

    // Load existing messages: first from local cache, then sync new ones (Issue 13, 15)
    useEffect(() => {
        const loadMessages = async () => {
            // Step 1: Load from local cache immediately
            const cached = await loadCachedMessages(myUserId, peerUserId);
            if (cached.length > 0) {
                setMessages(cached);
            }

            // Step 2: Sync only NEW messages from server (Issue 13)
            try {
                const lastSync = await AsyncStorage.getItem(syncTimestampKey(myUserId));
                const since = lastSync || '2000-01-01T00:00:00Z';

                const synced = await syncMessages(since, 200);
                const relevant = synced.filter(
                    m =>
                        (m.sender_id === peerUserId && m.receiver_id === myUserId) ||
                        (m.sender_id === myUserId && m.receiver_id === peerUserId),
                );

                if (relevant.length > 0) {
                    // Build a set of existing message IDs to avoid duplicates
                    const existingIds = new Set(cached.map(m => m.id));
                    const newMessages: ChatMessage[] = [];

                    for (const msg of relevant) {
                        if (existingIds.has(msg.client_message_id)) continue;
                        // Skip messages already decrypted via message.new (prevents session reset)
                        if (isMessageAlreadyDecrypted(msg.client_message_id)) {
                            continue;
                        }
                        try {
                            if (msg.sender_id === myUserId) {
                                // Own messages — store with placeholder text (Issue 12)
                                newMessages.push({
                                    id: msg.client_message_id,
                                    text: '[sent message]',
                                    isMine: true,
                                    timestamp: msg.created_at,
                                    status: msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent',
                                    serverMessageId: msg.id,
                                });
                            } else {
                                const plaintext = await decryptIncomingMessage(
                                    msg.ciphertext_b64,
                                    msg.header,
                                    msg.sender_id,
                                    msg.sender_device_id || 1,
                                    myUserId,
                                    msg.client_message_id,
                                );
                                if (msg.sender_device_id) lastPeerDeviceIdRef.current = msg.sender_device_id;
                                newMessages.push({
                                    id: msg.client_message_id,
                                    text: plaintext,
                                    isMine: false,
                                    timestamp: msg.created_at,
                                    status: 'delivered',
                                    serverMessageId: msg.id,
                                });
                            }
                        } catch (err: any) {
                            if (err.message?.startsWith('IDENTITY_CHANGED')) {
                                setSecurityWarning(true);
                            }
                            newMessages.push({
                                id: msg.client_message_id || `msg-${msg.id}`,
                                text: '🔒 Unable to decrypt',
                                isMine: msg.sender_id === myUserId,
                                timestamp: msg.created_at,
                                status: 'failed',
                                serverMessageId: msg.id,
                            });
                        }
                    }

                    if (newMessages.length > 0) {
                        const merged = [...cached, ...newMessages];
                        setMessages(merged);
                        await saveCachedMessages(myUserId, peerUserId, merged);
                    }
                }

                // Update last sync timestamp
                await AsyncStorage.setItem(
                    syncTimestampKey(myUserId),
                    new Date().toISOString(),
                );
            } catch (err) {
            }
        };
        loadMessages();
    }, [peerUserId, myUserId]);

    // Listen for incoming messages
    useEffect(() => {
        const unsubNew = websocket.on('message.new', async (data: any) => {
            if (data.sender_user_id !== peerUserId) return;
            if (!convIdRef.current && data.conversation_id) {
                convIdRef.current = data.conversation_id;
            }

            try {
                const plaintext = await decryptIncomingMessage(
                    data.ciphertext_b64,
                    data.header,
                    data.sender_user_id,
                    data.sender_device_id || 1,
                    myUserId,
                    data.client_message_id,
                );
                if (data.sender_device_id) lastPeerDeviceIdRef.current = data.sender_device_id;
                const newMsg: ChatMessage = {
                    id: data.client_message_id,
                    text: plaintext,
                    isMine: false,
                    timestamp: data.created_at || new Date().toISOString(),
                    status: 'delivered',
                    serverMessageId: data.server_message_id,
                };
                setMessages(prev => {
                    const updated = [...prev, newMsg];
                    // Persist to local cache (Issue 15)
                    saveCachedMessages(myUserId, peerUserId, updated).catch(() => { });
                    return updated;
                });

                // Ack delivery
                websocket.ackDelivered(data.server_message_id);
            } catch (err: any) {
                if (err.message?.startsWith('IDENTITY_CHANGED')) {
                    setSecurityWarning(true);
                }
                setMessages(prev => [
                    ...prev,
                    {
                        id: data.client_message_id || `msg-${Date.now()}`,
                        text: '🔒 Unable to decrypt',
                        isMine: false,
                        timestamp: new Date().toISOString(),
                        status: 'failed',
                    },
                ]);
            }
        });

        const unsubStatus = websocket.on('message.status', (data: any) => {
            setMessages(prev =>
                prev.map(m =>
                    m.serverMessageId === data.server_message_id
                        ? { ...m, status: data.status }
                        : m,
                ),
            );
        });

        // Fixed: backend sends 'session.identity_changed', not 'identity.changed'
        const unsubIdentity = websocket.on('session.identity_changed', (data: any) => {
            if (data.changed_user_id === peerUserId) {
                setSecurityWarning(true);
                Alert.alert(
                    '⚠️ Security Number Changed',
                    'The security number for this contact has changed. This may mean they reinstalled the app.',
                );
            }
        });

        return () => {
            unsubNew();
            unsubStatus();
            unsubIdentity();
        };
    }, [peerUserId, myUserId]);

    // Fix Issue 14: useCallback now uses refs for mutable values (no stale closure)
    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text) return;

        const tempId = `temp-${Date.now()}`;
        const newMsg: ChatMessage = {
            id: tempId,
            text,
            isMine: true,
            timestamp: new Date().toISOString(),
            status: 'sending',
        };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');

        try {
            const clientMessageId = await sendEncryptedMessage(
                peerUserId,
                text,
                convIdRef.current,
                myUserId,
                lastPeerDeviceIdRef.current || null,
            );
            setMessages(prev => {
                const updated = prev.map(m =>
                    m.id === tempId ? { ...m, id: clientMessageId, text, status: 'sent' as const } : m,
                );
                // Persist sent message with its plaintext (Issue 12)
                saveCachedMessages(myUserId, peerUserId, updated).catch(() => { });
                return updated;
            });
        } catch (err: any) {
            setMessages(prev =>
                prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)),
            );
            Alert.alert('Send Failed', err.message);
        }
    }, [inputText, peerUserId, myUserId]);

    const statusIcon = (status: ChatMessage['status']) => {
        switch (status) {
            case 'sending': return '○';
            case 'sent': return '✓';
            case 'delivered': return '✓✓';
            case 'read': return '✓✓';
            case 'failed': return '⚠';
            default: return '';
        }
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => (
        <View
            style={[
                styles.messageBubble,
                item.isMine ? styles.myMessage : styles.theirMessage,
            ]}>
            <Text style={[styles.messageText, item.status === 'failed' && styles.failedText]}>
                {item.text}
            </Text>
            <View style={styles.messageFooter}>
                <Text style={styles.messageTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Text>
                {item.isMine && (
                    <Text
                        style={[
                            styles.messageStatus,
                            item.status === 'read' && styles.statusRead,
                            item.status === 'failed' && styles.statusFailed,
                        ]}>
                        {statusIcon(item.status)}
                    </Text>
                )}
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onGoBack} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.peerName}>User #{peerUserId}</Text>
                    <Text style={styles.encryptedLabel}>🔒 End-to-end encrypted</Text>
                </View>
            </View>

            {/* Security Warning */}
            {securityWarning && (
                <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                        ⚠️ Security number changed. Verify this contact's identity.
                    </Text>
                </View>
            )}

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Message..."
                    placeholderTextColor="#666"
                    multiline
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                />
                <TouchableOpacity
                    style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}>
                    <Text style={styles.sendButtonText}>▶</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 52,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    backBtn: {
        padding: 8,
        marginRight: 8,
    },
    backText: {
        fontSize: 22,
        color: '#6c63ff',
    },
    headerInfo: {
        flex: 1,
    },
    peerName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#ffffff',
    },
    encryptedLabel: {
        fontSize: 12,
        color: '#4ade80',
        marginTop: 2,
    },
    warningBanner: {
        backgroundColor: '#5c3d00',
        padding: 10,
        alignItems: 'center',
    },
    warningText: {
        color: '#ffd700',
        fontSize: 13,
        fontWeight: '500',
    },
    messageList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    messageBubble: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        marginBottom: 8,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#6c63ff',
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#1a1a2e',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        color: '#ffffff',
        lineHeight: 20,
    },
    failedText: {
        color: '#ff6b6b',
        fontStyle: 'italic',
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    messageTime: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
    },
    messageStatus: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
    },
    statusRead: {
        color: '#4ade80',
    },
    statusFailed: {
        color: '#ff6b6b',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#1a1a2e',
        backgroundColor: '#0f0f18',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#ffffff',
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#2a2a3e',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#6c63ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: {
        opacity: 0.4,
    },
    sendButtonText: {
        fontSize: 16,
        color: '#ffffff',
    },
});

export default ChatScreen;
