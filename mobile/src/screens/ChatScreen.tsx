import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
    Image,
    useWindowDimensions,
    ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

type TimelineItem =
    | {
        type: 'day';
        id: string;
        label: string;
    }
    | {
        type: 'message';
        id: string;
        message: ChatMessage;
    }
    | {
        type: 'call';
        id: string;
        mode: 'video' | 'voice';
        durationLabel: string;
    };

interface ChatScreenProps {
    conversationId: number | null;
    peerUserId: number;
    myUserId: number;
    myDeviceId: number;
    peerDisplayName?: string;
    peerAvatar?: string | null;
    onGoBack: () => void;
}

const FONT_FAMILIES = {
    clashRegular: 'ClashDisplay-Regular',
    clashMedium: 'ClashDisplay-Medium',
};

const DEFAULT_AVATAR = require('../assets/images/profile_avatar.png');

function cacheKey(myUserId: number, peerUserId: number): string {
    const a = Math.min(myUserId, peerUserId);
    const b = Math.max(myUserId, peerUserId);
    return `chat_cache:${a}:${b}`;
}

function syncTimestampKey(myUserId: number): string {
    return `last_sync_ts:${myUserId}`;
}

function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function toDayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDayLabel(date: Date): string {
    const now = new Date();
    if (sameDay(date, now)) {
        return 'Today';
    }

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
    });
}

function formatTimeLabel(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}

async function loadCachedMessages(myUserId: number, peerUserId: number): Promise<ChatMessage[]> {
    try {
        const raw = await AsyncStorage.getItem(cacheKey(myUserId, peerUserId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveCachedMessages(myUserId: number, peerUserId: number, msgs: ChatMessage[]): Promise<void> {
    const trimmed = msgs.slice(-500);
    await AsyncStorage.setItem(cacheKey(myUserId, peerUserId), JSON.stringify(trimmed));
}

function toTimelineItems(messages: ChatMessage[]): TimelineItem[] {
    const items: TimelineItem[] = [];
    let previousDayKey: string | null = null;
    let messageCount = 0;
    let addedVideo = false;
    let addedVoice = false;

    for (const message of messages) {
        const date = new Date(message.timestamp);
        const dayKey = toDayKey(date);

        if (dayKey !== previousDayKey) {
            items.push({
                type: 'day',
                id: `day-${dayKey}`,
                label: formatDayLabel(date),
            });
            previousDayKey = dayKey;
        }

        items.push({
            type: 'message',
            id: `msg-${message.id}`,
            message,
        });

        messageCount += 1;

        if (messageCount === 2) {
            items.push({
                type: 'call',
                id: 'mock-call-video',
                mode: 'video',
                durationLabel: '15m',
            });
            addedVideo = true;
        }

        if (messageCount === 4) {
            items.push({
                type: 'call',
                id: 'mock-call-voice',
                mode: 'voice',
                durationLabel: '48m',
            });
            addedVoice = true;
        }
    }

    if (messages.length > 0) {
        if (!addedVideo) {
            items.push({
                type: 'call',
                id: 'mock-call-video',
                mode: 'video',
                durationLabel: '15m',
            });
        }
        if (!addedVoice) {
            items.push({
                type: 'call',
                id: 'mock-call-voice',
                mode: 'voice',
                durationLabel: '48m',
            });
        }
    }

    return items;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
    conversationId,
    peerUserId,
    myUserId,
    myDeviceId,
    peerDisplayName,
    peerAvatar,
    onGoBack,
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [securityWarning, setSecurityWarning] = useState(false);
    const [composerHeight, setComposerHeight] = useState(46);

    const lastPeerDeviceIdRef = useRef(1);
    const flatListRef = useRef<FlatList<TimelineItem>>(null);
    const convIdRef = useRef(conversationId);

    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();

    const uiScale = Math.min(Math.max(screenWidth / 390, 0.92), 1.12);
    const ui = useMemo(
        () => ({
            headerHorizontal: 22 * uiScale,
            messageHorizontal: 22 * uiScale,
            headerTop: insets.top + 10 * uiScale,
            headerBottom: 14 * uiScale,
            iconSize: 22 * uiScale,
            actionIconSize: 20 * uiScale,
            actionButtonSize: 44 * uiScale,
            avatarSize: 42 * uiScale,
            bubbleRadius: 16 * uiScale,
            inputHeight: Math.min(Math.max(composerHeight, 42 * uiScale), 100 * uiScale),
            composerPaddingBottom: Math.max(insets.bottom, 10),
        }),
        [composerHeight, insets.bottom, insets.top, uiScale],
    );

    const displayName = useMemo(() => {
        if (peerDisplayName && peerDisplayName.trim().length > 0) {
            return peerDisplayName;
        }
        return `User #${peerUserId}`;
    }, [peerDisplayName, peerUserId]);

    const avatarSource = useMemo(() => {
        if (peerAvatar && peerAvatar.trim().length > 0) {
            return { uri: peerAvatar };
        }
        return DEFAULT_AVATAR;
    }, [peerAvatar]);

    const timelineItems = useMemo(() => toTimelineItems(messages), [messages]);

    useEffect(() => {
        convIdRef.current = conversationId;
    }, [conversationId]);

    useEffect(() => {
        const loadMessages = async () => {
            const cached = await loadCachedMessages(myUserId, peerUserId);
            if (cached.length > 0) {
                setMessages(cached);
            }

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
                    const existingIds = new Set(cached.map(m => m.id));
                    const newMessages: ChatMessage[] = [];

                    for (const msg of relevant) {
                        if (existingIds.has(msg.client_message_id)) continue;
                        if (isMessageAlreadyDecrypted(msg.client_message_id)) {
                            continue;
                        }

                        try {
                            if (msg.sender_id === myUserId) {
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
                                if (msg.sender_device_id) {
                                    lastPeerDeviceIdRef.current = msg.sender_device_id;
                                }
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
                                text: 'Unable to decrypt',
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

                await AsyncStorage.setItem(syncTimestampKey(myUserId), new Date().toISOString());
            } catch {
            }
        };

        loadMessages();
    }, [peerUserId, myUserId]);

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

                if (data.sender_device_id) {
                    lastPeerDeviceIdRef.current = data.sender_device_id;
                }

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
                    saveCachedMessages(myUserId, peerUserId, updated).catch(() => { });
                    return updated;
                });

                websocket.ackDelivered(data.server_message_id);
            } catch (err: any) {
                if (err.message?.startsWith('IDENTITY_CHANGED')) {
                    setSecurityWarning(true);
                }
                setMessages(prev => [
                    ...prev,
                    {
                        id: data.client_message_id || `msg-${Date.now()}`,
                        text: 'Unable to decrypt',
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

        const unsubIdentity = websocket.on('session.identity_changed', (data: any) => {
            if (data.changed_user_id === peerUserId) {
                setSecurityWarning(true);
                Alert.alert(
                    'Security Number Changed',
                    'The security number for this contact has changed. Please verify identity before continuing.',
                );
            }
        });

        return () => {
            unsubNew();
            unsubStatus();
            unsubIdentity();
        };
    }, [peerUserId, myUserId]);

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
                myDeviceId,
            );

            setMessages(prev => {
                const updated = prev.map(m =>
                    m.id === tempId ? { ...m, id: clientMessageId, text, status: 'sent' as const } : m,
                );
                saveCachedMessages(myUserId, peerUserId, updated).catch(() => { });
                return updated;
            });
        } catch (err: any) {
            setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)));
            Alert.alert('Send Failed', err.message);
        }
    }, [inputText, peerUserId, myUserId, myDeviceId]);

    const statusIcon = (status: ChatMessage['status']) => {
        switch (status) {
            case 'sending':
                return '○';
            case 'sent':
                return '✓';
            case 'delivered':
            case 'read':
                return '✓✓';
            case 'failed':
                return '⚠';
            default:
                return '';
        }
    };

    const handleActionPress = (label: string) => {
        Alert.alert(label, `${label} action will be wired next.`);
    };

    const handleCallChipPress = (mode: 'video' | 'voice') => {
        const label = mode === 'video' ? 'Video call event' : 'Voice call event';
        Alert.alert(label, 'Timeline call events are placeholders in this version.');
    };

    const renderTimelineItem: ListRenderItem<TimelineItem> = ({ item }) => {
        if (item.type === 'day') {
            return (
                <View style={styles.dayRow}>
                    <Text style={[styles.dayLabel, { fontSize: 15 * uiScale }]}>{item.label}</Text>
                </View>
            );
        }

        if (item.type === 'call') {
            return (
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.callChip}
                    onPress={() => handleCallChipPress(item.mode)}>
                    <Ionicons
                        name={item.mode === 'video' ? 'videocam-outline' : 'call-outline'}
                        size={17 * uiScale}
                        color="#757575"
                    />
                    <Text style={[styles.callChipText, { fontSize: 14 * uiScale }]}>
                        {`Outgoing ${item.mode} call - ${item.durationLabel}`}
                    </Text>
                </TouchableOpacity>
            );
        }

        const message = item.message;
        const isMine = message.isMine;
        const statusGlyph = statusIcon(message.status);

        return (
            <View style={[styles.messageBlock, isMine ? styles.messageBlockMine : styles.messageBlockTheirs]}>
                <View
                    style={[
                        styles.messageBubble,
                        {
                            borderRadius: ui.bubbleRadius,
                            maxWidth: screenWidth * 0.72,
                            paddingHorizontal: 18 * uiScale,
                            paddingVertical: 14 * uiScale,
                        },
                        isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
                    ]}>
                    <Text
                        style={[
                            styles.messageText,
                            { fontSize: 16 * uiScale, lineHeight: 23 * uiScale },
                            isMine ? styles.messageTextMine : styles.messageTextTheirs,
                            message.status === 'failed' && styles.failedText,
                        ]}>
                        {message.text}
                    </Text>
                </View>

                <View
                    style={[
                        styles.metaRow,
                        isMine ? styles.metaRowMine : styles.metaRowTheirs,
                        { marginTop: 7 * uiScale },
                    ]}>
                    <Text style={[styles.metaTime, { fontSize: 15 * 0.8 * uiScale }]}>{formatTimeLabel(message.timestamp)}</Text>
                    {isMine && (
                        <Text
                            style={[
                                styles.metaStatus,
                                { fontSize: 15 * 0.8 * uiScale },
                                message.status === 'failed' ? styles.metaStatusFailed : styles.metaStatusOk,
                            ]}>
                            {statusGlyph}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}>
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: ui.headerTop,
                        paddingBottom: ui.headerBottom,
                        paddingHorizontal: ui.headerHorizontal,
                    },
                ]}>
                <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={ui.iconSize} color="#161616" />
                </TouchableOpacity>

                <Image
                    source={avatarSource}
                    style={{
                        width: ui.avatarSize,
                        height: ui.avatarSize,
                        borderRadius: ui.avatarSize / 2,
                        marginRight: 14 * uiScale,
                    }}
                />

                <Text
                    style={[styles.headerName, { fontSize: 31 * 0.8 * uiScale }]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {displayName}
                </Text>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.headerActionButton, { width: ui.actionButtonSize, height: ui.actionButtonSize, borderRadius: 16 * uiScale }]}
                        onPress={() => handleActionPress('Video call')}>
                        <Ionicons name="videocam-outline" size={ui.actionIconSize} color="#2a2a2a" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.headerActionButton, { width: ui.actionButtonSize, height: ui.actionButtonSize, borderRadius: 16 * uiScale }]}
                        onPress={() => handleActionPress('Voice call')}>
                        <Ionicons name="call-outline" size={ui.actionIconSize} color="#2a2a2a" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.headerActionButton, { width: ui.actionButtonSize, height: ui.actionButtonSize, borderRadius: 16 * uiScale }]}
                        onPress={() => handleActionPress('More options')}>
                        <Ionicons name="ellipsis-vertical" size={ui.actionIconSize} color="#2a2a2a" />
                    </TouchableOpacity>
                </View>
            </View>

            {securityWarning && (
                <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                        Security number changed. Please verify identity before sharing sensitive details.
                    </Text>
                </View>
            )}

            <FlatList
                ref={flatListRef}
                data={timelineItems}
                renderItem={renderTimelineItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{
                    paddingHorizontal: ui.messageHorizontal,
                    paddingVertical: 14 * uiScale,
                    paddingBottom: 22 * uiScale,
                }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            <View
                style={[
                    styles.composerWrap,
                    {
                        paddingHorizontal: ui.messageHorizontal,
                        paddingBottom: ui.composerPaddingBottom,
                        paddingTop: 8 * uiScale,
                    },
                ]}>
                <View style={styles.composerRow}>
                    <View style={styles.composerInputShell}>
                        <Ionicons name="attach-outline" size={20 * uiScale} color="#232323" style={styles.inputLeadingIcon} />

                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    fontSize: 14.5 * uiScale,
                                    minHeight: ui.inputHeight,
                                    maxHeight: 100 * uiScale,
                                },
                            ]}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Secure message..."
                            placeholderTextColor="#7A7A7A"
                            multiline
                            textAlignVertical="center"
                            returnKeyType="send"
                            onSubmitEditing={handleSend}
                            onContentSizeChange={event => {
                                const nextHeight = event.nativeEvent.contentSize.height + 10;
                                setComposerHeight(nextHeight);
                            }}
                        />

                        <TouchableOpacity onPress={() => handleActionPress('Add attachment')} style={styles.inlineIconBtn}>
                            <Ionicons name="add-circle-outline" size={20 * uiScale} color="#232323" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleActionPress('Voice note')} style={styles.inlineIconBtn}>
                            <Ionicons name="mic-outline" size={20 * uiScale} color="#232323" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}>
                        <Ionicons name="send" size={20 * uiScale} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#D7DBDE',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#C5C9CD',
        backgroundColor: '#D7DBDE',
    },
    backButton: {
        paddingVertical: 4,
        paddingRight: 10,
    },
    headerName: {
        flex: 1,
        color: '#1E1E1E',
        fontFamily: FONT_FAMILIES.clashMedium,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerActionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E7E8EA',
    },
    warningBanner: {
        marginTop: 8,
        marginHorizontal: 22,
        borderRadius: 12,
        backgroundColor: '#FFEECF',
        borderWidth: 1,
        borderColor: '#F1C679',
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    warningText: {
        color: '#704B0A',
        fontSize: 12,
        lineHeight: 16,
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    dayRow: {
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 16,
    },
    dayLabel: {
        color: '#2F2F2F',
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    messageBlock: {
        marginBottom: 14,
    },
    messageBlockMine: {
        alignItems: 'flex-end',
    },
    messageBlockTheirs: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        shadowColor: '#000000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    messageBubbleMine: {
        backgroundColor: '#1340EE',
        borderBottomRightRadius: 5,
    },
    messageBubbleTheirs: {
        backgroundColor: '#F4F5F6',
        borderBottomLeftRadius: 5,
    },
    messageText: {
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    messageTextMine: {
        color: '#FFFFFF',
    },
    messageTextTheirs: {
        color: '#181818',
    },
    failedText: {
        color: '#D33232',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaRowMine: {
        justifyContent: 'flex-end',
    },
    metaRowTheirs: {
        justifyContent: 'flex-start',
    },
    metaTime: {
        color: '#6A6A6A',
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    metaStatus: {
        marginLeft: 4,
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    metaStatusOk: {
        color: '#32B364',
    },
    metaStatusFailed: {
        color: '#D33232',
    },
    callChip: {
        minHeight: 42,
        borderRadius: 22,
        backgroundColor: '#DCDCDD',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 22,
        paddingHorizontal: 14,
    },
    callChipText: {
        color: '#6E6E6E',
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    composerWrap: {
        borderTopWidth: 1,
        borderTopColor: '#D0D2D5',
        backgroundColor: '#D7DBDE',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    composerInputShell: {
        flex: 1,
        backgroundColor: '#F6F7F8',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 8,
        marginRight: 10,
        minHeight: 46,
    },
    inputLeadingIcon: {
        marginRight: 8,
    },
    textInput: {
        flex: 1,
        color: '#181818',
        fontFamily: FONT_FAMILIES.clashRegular,
        paddingVertical: 9,
        paddingHorizontal: 0,
    },
    inlineIconBtn: {
        paddingHorizontal: 4,
        paddingVertical: 6,
    },
    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#1340EE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.45,
    },
});

export default ChatScreen;
