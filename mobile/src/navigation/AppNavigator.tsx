import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'react-native';
import { loadTokens, clearTokens } from '../services/api';
import { logout, loadUserInfo } from '../services/auth';
import { websocket } from '../services/websocket';
import * as SignalManager from '../crypto/SignalManager';
import LoginScreen from '../screens/LoginScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';

type Screen =
    | { name: 'login' }
    | { name: 'conversations'; userId: number; deviceId: number }
    | {
        name: 'chat';
        userId: number;
        conversationId: number | null;
        peerUserId: number;
    };

const AppNavigator: React.FC = () => {
    const [screen, setScreen] = useState<Screen>({ name: 'login' });

    // Check for existing tokens on mount
    useEffect(() => {
        const checkAuth = async () => {
            const tokens = await loadTokens();
            if (tokens?.accessToken) {
                // Load persisted user info
                const userInfo = await loadUserInfo();
                const userId = userInfo?.userId ?? 0;
                const deviceId = userInfo?.deviceId ?? 0;

                // Initialize Signal stores
                try {
                    await SignalManager.initialize();
                } catch (err) {
                    console.warn('[App] Signal init on resume:', err);
                }

                setScreen({ name: 'conversations', userId, deviceId });
                websocket.connect();
            }
        };
        checkAuth();
    }, []);

    const handleLoginSuccess = useCallback((userId: number, deviceId: number) => {
        setScreen({ name: 'conversations', userId, deviceId });
        websocket.connect();
    }, []);

    const handleLogout = useCallback(async () => {
        websocket.disconnect();
        await logout();
        await SignalManager.clearAll();
        setScreen({ name: 'login' });
    }, []);

    const handleSelectConversation = useCallback(
        (conversationId: number, peerUserId: number) => {
            if (screen.name !== 'conversations') return;
            setScreen({
                name: 'chat',
                userId: screen.userId,
                conversationId,
                peerUserId,
            });
        },
        [screen],
    );

    const handleStartNewChat = useCallback(
        (peerUserId: number) => {
            if (screen.name !== 'conversations') return;
            setScreen({
                name: 'chat',
                userId: screen.userId,
                conversationId: null,
                peerUserId,
            });
        },
        [screen],
    );

    const handleGoBack = useCallback(() => {
        if (screen.name === 'chat') {
            setScreen({
                name: 'conversations',
                userId: screen.userId,
                deviceId: 0,
            });
        }
    }, [screen]);

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
            {screen.name === 'login' && (
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
            )}
            {screen.name === 'conversations' && (
                <ConversationsScreen
                    userId={screen.userId}
                    onSelectConversation={handleSelectConversation}
                    onStartNewChat={handleStartNewChat}
                    onLogout={handleLogout}
                />
            )}
            {screen.name === 'chat' && (
                <ChatScreen
                    conversationId={screen.conversationId}
                    peerUserId={screen.peerUserId}
                    myUserId={screen.userId}
                    onGoBack={handleGoBack}
                />
            )}
        </>
    );
};

export default AppNavigator;
