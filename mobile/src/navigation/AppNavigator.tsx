import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'react-native';
import { loadTokens } from '../services/api';
import { logout, loadUserInfo } from '../services/auth';
import { websocket } from '../services/websocket';
import * as SignalManager from '../crypto/SignalManager';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import type { ConversationPeerMeta } from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import SecretScreen from '../screens/SecretScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CharacterScreen from '../screens/CharacterScreen';

type Screen =
    | { name: 'login' }
    | { name: 'profile' }
    | { name: 'character' }
    | { name: 'secret'; userId: number; deviceId: number }
    | { name: 'conversations'; userId: number; deviceId: number }
    | {
        name: 'chat';
        userId: number;
        deviceId: number;
        conversationId: number | null;
        peerUserId: number;
        peerDisplayName?: string;
        peerAvatar?: string | null;
    };

const AppNavigator: React.FC = () => {
    const [screen, setScreen] = useState<Screen>({ name: 'login' });
    const [showSplash, setShowSplash] = useState(true);

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
                    await SignalManager.initialize(userId);
                } catch {
                }

                setScreen({ name: 'conversations', userId, deviceId });
                websocket.connect(userId);
            }
        };
        checkAuth();
    }, []);

    const handleLoginSuccess = useCallback(async (userId: number, deviceId: number) => {
        setScreen({ name: 'conversations', userId, deviceId });
        websocket.connect(userId);
    }, []);

    const handleShowSecret = useCallback((userId: number, deviceId: number) => {
        setScreen({ name: 'secret', userId, deviceId });
        // After some delay or after keys are uploaded, move to conversations
        setTimeout(() => {
            setScreen({ name: 'conversations', userId, deviceId });
            websocket.connect(userId);
        }, 3000);
    }, []);

    const handleLogout = useCallback(async () => {
        websocket.disconnect();
        await logout();
        await SignalManager.clearAll();
        setScreen({ name: 'login' });
    }, []);

    const handleGoToProfile = useCallback(() => {
        setScreen({ name: 'profile' });
    }, []);

    const handleGoBackFromProfile = useCallback(() => {
        setScreen({ name: 'login' });
    }, []);

    const handleGoToSecretFromProfile = useCallback(() => {
        setScreen({ name: 'secret', userId: 0, deviceId: 0 });
    }, []);

    const handleGoToCharacter = useCallback(() => {
        setScreen({ name: 'character' });
    }, []);

    const handleCloseCharacter = useCallback(() => {
        setScreen({ name: 'profile' });
    }, []);

    // ... handleSelectConversation, handleStartNewChat, handleGoBack omitted for brevity but should remain ...
    const handleSelectConversation = useCallback(
        (conversationId: number, peerUserId: number, peerMeta?: ConversationPeerMeta) => {
            if (screen.name !== 'conversations') return;
            setScreen({
                name: 'chat',
                userId: screen.userId,
                deviceId: screen.deviceId,
                conversationId,
                peerUserId,
                peerDisplayName: peerMeta?.peerDisplayName,
                peerAvatar: peerMeta?.peerAvatar ?? null,
            });
        },
        [screen],
    );

    const handleStartNewChat = useCallback(
        (peerUserId: number, peerMeta?: ConversationPeerMeta) => {
            if (screen.name !== 'conversations') return;
            setScreen({
                name: 'chat',
                userId: screen.userId,
                deviceId: screen.deviceId,
                conversationId: null,
                peerUserId,
                peerDisplayName: peerMeta?.peerDisplayName,
                peerAvatar: peerMeta?.peerAvatar ?? null,
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

    if (showSplash) {
        return (
            <>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <SplashScreen onFinish={() => setShowSplash(false)} />
            </>
        );
    }

    const renderScreen = () => {
        switch (screen.name) {
            case 'login':
                return (
                    <LoginScreen
                        onLoginSuccess={handleLoginSuccess}
                        onShowSecret={handleShowSecret}
                        onGoToProfile={handleGoToProfile}
                    />
                );
            case 'profile':
                return <ProfileScreen onGoBack={handleGoBackFromProfile} onSave={handleGoToSecretFromProfile} onEditAvatar={handleGoToCharacter} />;
            case 'character':
                return <CharacterScreen onClose={handleCloseCharacter} />;
            case 'secret':
                return <SecretScreen />;
            case 'conversations':
                return (
                    <ConversationsScreen
                        userId={screen.userId}
                        onSelectConversation={handleSelectConversation}
                        onStartNewChat={handleStartNewChat}
                        onLogout={handleLogout}
                    />
                );
            case 'chat':
                return (
                    <ChatScreen
                        conversationId={screen.conversationId}
                        peerUserId={screen.peerUserId}
                        myUserId={screen.userId}
                        myDeviceId={screen.deviceId}
                        peerDisplayName={screen.peerDisplayName}
                        peerAvatar={screen.peerAvatar}
                        onGoBack={handleGoBack}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            <StatusBar
                barStyle={screen.name === 'chat' ? 'dark-content' : 'light-content'}
                backgroundColor={screen.name === 'chat' ? '#D7DBDE' : '#000000'}
            />
            {renderScreen()}
        </>
    );
};

export default AppNavigator;


