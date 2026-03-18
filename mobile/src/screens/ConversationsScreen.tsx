import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    Alert,
} from 'react-native';
import { loadConversations as loadStoredConversations, upsertConversation } from '../services/localChatStore';

export interface ConversationItem {
    conversation_id: number;
    peer_user_id: number;
    peer_display_name?: string;
    peer_avatar?: string | null;
    last_message_at?: string;
    unread_count: number;
}

export interface ConversationPeerMeta {
    peerDisplayName: string;
    peerAvatar?: string | null;
}

interface ConversationsScreenProps {
    userId: number;
    onSelectConversation: (conversationId: number, peerUserId: number, peerMeta?: ConversationPeerMeta) => void;
    onStartNewChat: (peerUserId: number, peerMeta?: ConversationPeerMeta) => void;
    onLogout: () => void;
}

const ConversationsScreen: React.FC<ConversationsScreenProps> = ({
    userId,
    onSelectConversation,
    onStartNewChat,
    onLogout,
}) => {
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [newChatEmail, setNewChatEmail] = useState('');

    const getPeerDisplayName = useCallback((peerUserId: number, rawName?: string) => {
        if (!rawName) return `User #${peerUserId}`;
        if (rawName.includes('@')) {
            const localPart = rawName.split('@')[0]?.trim();
            return localPart ? localPart : rawName;
        }
        return rawName;
    }, []);

    const loadConversations = useCallback(async () => {
        const stored = await loadStoredConversations(userId);
        setConversations(
            stored.map(c => ({
                conversation_id: c.conversationId,
                peer_user_id: c.peerUserId,
                peer_display_name: c.peerDisplayName,
                peer_avatar: c.peerAvatar ?? null,
                last_message_at: c.lastMessageAt,
                unread_count: c.unreadCount,
            })),
        );
    }, [userId]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadConversations();
        setRefreshing(false);
    };

    const handleNewChat = async () => {
        const email = newChatEmail.trim();
        if (!email) {
            Alert.alert('Error', 'Please enter an email address');
            return;
        }
        
        setShowNewChat(false);
        setNewChatEmail('');
        
        // Mocking user lookup and conversation creation for now to match master's "frontend-only" spirit
        // but keeping the structure functional.
        const peerUserId = Math.floor(Math.random() * 1000) + 1;
        const conversationId = Date.now();
        const peerDisplayName = getPeerDisplayName(peerUserId, email);
        
        await upsertConversation(userId, {
            conversationId,
            peerUserId,
            peerDisplayName,
            peerAvatar: null,
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
        });
        
        await loadConversations();
        onSelectConversation(conversationId, peerUserId, { peerDisplayName, peerAvatar: null });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const renderConversation = ({ item }: { item: ConversationItem }) => {
        const peerDisplayName = item.peer_display_name || getPeerDisplayName(item.peer_user_id);

        return (
            <TouchableOpacity
                style={styles.conversationItem}
                onPress={() =>
                    onSelectConversation(item.conversation_id, item.peer_user_id, {
                        peerDisplayName,
                        peerAvatar: item.peer_avatar ?? null,
                    })
                }
                activeOpacity={0.7}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {(peerDisplayName || '?').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                        <Text style={styles.peerName} numberOfLines={1}>
                            {peerDisplayName}
                        </Text>
                        <Text style={styles.timeText}>{item.last_message_at ? formatTime(item.last_message_at) : ''}</Text>
                    </View>
                    <View style={styles.conversationFooter}>
                        <Text style={styles.lastMessage} numberOfLines={1}>
                            Encrypted message
                        </Text>
                        {item.unread_count > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{item.unread_count}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setShowNewChat(true)} style={styles.headerButton}>
                        <Text style={styles.headerButtonText}>＋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onLogout} style={styles.headerButton}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {showNewChat && (
                <View style={styles.newChatBanner}>
                    <View style={styles.newChatRow}>
                        <View style={styles.newChatInputContainer}>
                            <Text style={styles.newChatLabel}>Start a new chat</Text>
                            <View style={styles.newChatInputRow}>
                                <View style={styles.newChatInputWrapper}>
                                    <TextInput
                                        style={styles.newChatInput}
                                        placeholder="Enter email address..."
                                        placeholderTextColor="#666"
                                        value={newChatEmail}
                                        onChangeText={setNewChatEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.newChatSend} onPress={handleNewChat}>
                                    <Text style={styles.newChatSendText}>Go</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                setShowNewChat(false);
                                setNewChatEmail('');
                            }}
                            style={styles.newChatClose}>
                            <Text style={styles.newChatCloseText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <FlatList
                data={conversations}
                renderItem={renderConversation}
                keyExtractor={item => item.conversation_id.toString()}
                contentContainerStyle={conversations.length === 0 ? styles.empty : undefined}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#6c63ff"
                        colors={['#6c63ff']}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>💬</Text>
                        <Text style={styles.emptyTitle}>No Conversations</Text>
                        <Text style={styles.emptySubtitle}>
                            Tap + to start a secure chat
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        width: '100%',
        height: 50,
        marginTop: 60,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    headerTitle: {
        fontSize: 28,
        color: '#ffffff',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerButton: {
        padding: 8,
    },
    headerButtonText: {
        fontSize: 24,
        color: '#6c63ff',
    },
    logoutText: {
        fontSize: 14,
        color: '#ff6b6b',
    },
    newChatBanner: {
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a3e',
    },
    newChatRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    newChatInputContainer: {
        flex: 1,
    },
    newChatLabel: {
        color: '#ccc',
        fontSize: 13,
        marginBottom: 8,
    },
    newChatInputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    newChatInputWrapper: {
        flex: 1,
    },
    newChatInput: {
        backgroundColor: '#0a0a0f',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#2a2a3e',
    },
    newChatSend: {
        backgroundColor: '#6c63ff',
        borderRadius: 8,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    newChatSendText: {
        color: '#fff',
    },
    newChatClose: {
        padding: 8,
        marginLeft: 4,
    },
    newChatCloseText: {
        color: '#888',
        fontSize: 16,
    },
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#2d2b55',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    avatarText: {
        color: '#6c63ff',
        fontSize: 20,
    },
    conversationInfo: {
        flex: 1,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    peerName: {
        fontSize: 16,
        color: '#ffffff',
        flex: 1,
        marginRight: 8,
    },
    timeText: {
        fontSize: 12,
        color: '#666',
    },
    conversationFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        color: '#888',
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: '#6c63ff',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: '#fff',
        fontSize: 12,
    },
    empty: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        color: '#ccc',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
    },
});

export default ConversationsScreen;
