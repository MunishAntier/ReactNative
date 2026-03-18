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
    onAboutUser?: (name: string, avatar?: any) => void;
}

const FONT_FAMILIES = {
    clashRegular: 'ClashDisplay-Regular',
    clashMedium: 'ClashDisplay-Regular',
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
    onAboutUser,
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [securityWarning, setSecurityWarning] = useState(false);

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
            inputHeight: 42 * uiScale,
            composerPaddingBottom: Math.max(insets.bottom, 10),
        }),
        [insets.bottom, insets.top, uiScale],
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
                return <Ionicons name="time-outline" size={12} color="#8E8E93" />;
            case 'sent':
                return <Ionicons name="checkmark-outline" size={14} color="#8E8E93" />;
            case 'delivered':
            case 'read':
                return <Ionicons name="checkmark-done" size={14} color="#34C759" />;
            case 'failed':
                return <Ionicons name="alert-circle-outline" size={14} color="#FF3B30" />;
            default:
                return null;
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
                            borderRadius: 20 * uiScale,
                            maxWidth: screenWidth * 0.75,
                            paddingHorizontal: 20 * uiScale,
                            paddingVertical: 14 * uiScale,
                        },
                        isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
                    ]}>
                    <Text
                        style={[
                            styles.messageText,
                            { fontSize: 16 * uiScale, lineHeight: 22 * uiScale },
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
                        { marginTop: 6 * uiScale },
                    ]}>
                    <Text style={[styles.metaTime, { fontSize: 13 * uiScale }]}>{formatTimeLabel(message.timestamp)}</Text>
                    {isMine && statusGlyph && (
                        <View style={{ marginLeft: 4 }}>
                            {statusGlyph}
                        </View>
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
                        marginTop: 60, // Increased for better clearance
                    },
                ]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={24} color="#161616" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.headerProfileTrigger} 
                        onPress={() => onAboutUser?.(displayName, avatarSource)}
                        activeOpacity={0.7}
                    >
                        <Image
                            source={avatarSource}
                            style={styles.headerAvatar}
                        />

                        <View style={styles.headerNameWrapper}>
                            <Text
                                style={styles.headerName}
                                numberOfLines={1}
                                ellipsizeMode="tail">
                                {displayName}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={() => handleActionPress('Video call')}>
                        <Ionicons name="videocam-outline" size={20} color="#1E1E1E" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={() => handleActionPress('Voice call')}>
                        <Ionicons name="call-outline" size={20} color="#1E1E1E" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={() => setShowMenu(true)}>
                        <Ionicons name="ellipsis-vertical" size={20} color="#1E1E1E" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Header Menu */}
            {showMenu && (
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleActionPress('All media'); }}>
                            <Text style={styles.menuItemText}>All media</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleActionPress('Chat settings'); }}>
                            <Text style={styles.menuItemText}>Chat settings</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleActionPress('Search'); }}>
                            <Text style={styles.menuItemText}>Search</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleActionPress('Add to home screen'); }}>
                            <Text style={styles.menuItemText}>Add to home screen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleActionPress('Mute Notifications'); }}>
                            <Text style={styles.menuItemText}>Mute Notifications</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            )}

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
                        width: 382,
                        alignSelf: 'center',
                        marginBottom: Math.max(insets.bottom, 14),
                    },
                ]}>
                <View style={styles.composerRow}>
                    <View style={styles.composerInputShell}>
                        <TouchableOpacity onPress={() => handleActionPress('Add attachment')} style={styles.leadingIconBtn}>
                            <Ionicons name="attach-outline" size={24} color="#070707" />
                        </TouchableOpacity>

                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    fontSize: 16,
                                    height: 42,
                                },
                            ]}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Secure message.."
                            placeholderTextColor="#ABABAB"
                            textAlignVertical="center"
                            returnKeyType="send"
                        />

                        <TouchableOpacity onPress={() => handleActionPress('More options')} style={styles.inlineIconBtn}>
                            <Ionicons name="add-circle-outline" size={24} color="#070707" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleActionPress('Voice note')} style={styles.inlineIconBtn}>
                            <Ionicons name="mic-outline" size={24} color="#070707" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}>
                        <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EBEBEC',
    },
    header: {
        width: '100%',
        maxWidth: 430,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 24,
        paddingRight: 24,
        backgroundColor: '#EBEBEC',
        alignSelf: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1, // Restored to allow name to occupy space
    },
    headerProfileTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginLeft: 10,
    },
    backButton: {
        paddingRight: 10,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        marginRight: 10,
    },
    headerNameWrapper: {
        flex: 1, // Allow wrapper to take remaining space
        justifyContent: 'center',
    },
    headerName: {
        fontSize: 20,
        color: '#1E1E1E',
        fontFamily: 'Gilroy-Regular',
        fontWeight: '400',
        lineHeight: 20,
        letterSpacing: 0,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13.42, // gap: 13.42px from design
    },
    headerActionButton: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    menuOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        zIndex: 1000,
    },
    menuContainer: {
        position: 'absolute',
        top: 115, // Adjusted to appear below the header icon
        right: 24,
        width: 162,
        height: 157,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        gap: 10,
        // Premium shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    menuItem: {
        width: 130,
        height: 17, // Adjusted to match item layout
        justifyContent: 'center',
    },
    menuItemText: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 14,
        fontWeight: '400',
        color: '#606060',
        lineHeight: 14, // 100%
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
        marginTop: 4,
        marginBottom: 20,
    },
    dayLabel: {
        color: '#6E6E6E',
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    messageBlock: {
        marginBottom: 20,
    },
    messageBlockMine: {
        alignItems: 'flex-end',
    },
    messageBlockTheirs: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1,
    },
    messageBubbleMine: {
        backgroundColor: '#0147FF',
        borderBottomRightRadius: 4,
    },
    messageBubbleTheirs: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    messageTextMine: {
        color: '#FFFFFF',
    },
    messageTextTheirs: {
        color: '#1E1E1E',
    },
    failedText: {
        color: '#FF3B30',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    metaRowMine: {
        justifyContent: 'flex-end',
    },
    metaRowTheirs: {
        justifyContent: 'flex-start',
    },
    metaTime: {
        color: '#8E8E93',
        fontFamily: FONT_FAMILIES.clashRegular,
    },
    callChip: {
        minHeight: 44,
        borderRadius: 22,
        backgroundColor: '#E4E4E5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
        width: '85%',
    },
    callChipText: {
        color: '#6E6E6E',
        fontFamily: FONT_FAMILIES.clashRegular,
        marginLeft: 8,
    },
    composerWrap: {
        backgroundColor: 'transparent',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    composerInputShell: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 4,
        paddingRight: 4,
        height: 42,
    },
    leadingIconBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textInput: {
        flex: 1,
        color: '#1E1E1E',
        fontFamily: FONT_FAMILIES.clashRegular,
        paddingVertical: 0,
        paddingHorizontal: 4,
    },
    inlineIconBtn: {
        width: 32,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#0147FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.7,
    },
});

export default ChatScreen;
