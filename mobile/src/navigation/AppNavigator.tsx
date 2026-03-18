import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, AppState, AppStateStatus, ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';

import { loadTokens } from '../services/api';
import { logout, loadUserInfo } from '../services/auth';
import { websocket } from '../services/websocket';
import { permissionManager } from '../services/PermissionManager';
import * as SignalManager from '../crypto/SignalManager';

// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import type { ConversationPeerMeta } from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import SecretScreen from '../screens/SecretScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CharacterScreen from '../screens/CharacterScreen';
import PermissionScreen from '../screens/PermissionScreen';
import VerifyScreen from '../screens/VerifyScreen';
import CreatePINScreen from '../screens/CreatePINScreen';
import ConfirmPINScreen from '../screens/ConfirmPINScreen';
import PhoneScreen from '../screens/PhoneScreen';
import HomeScreen from '../screens/HomeScreen';
import CallMenu from '../screens/CallMenu';
import ContactPickerScreen from '../screens/ContactPickerScreen';
import FindUserScreen from '../screens/FindUserScreen';
import AboutUserScreen from '../screens/AboutUserScreen';

type Screen =
    | { name: 'loading' }
    | { name: 'permissions' }
    | { name: 'phone' }
    | { name: 'verify'; phoneNumber: string }
    | { name: 'create_pin' }
    | { name: 'confirm_pin'; createdPin: string }
    | { name: 'home' }
    | { name: 'call_menu' }
    | { name: 'select_contact' }
    | { name: 'select_member' }
    | { name: 'find_by_username' }
    | { name: 'find_by_phone' }
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
    }
    | {
        name: 'about_user';
        userName: string;
        userAvatar?: any;
    };

const AppNavigator: React.FC = () => {
    const [fontsLoaded] = useFonts({
        'ClashDisplay-Regular': require('../assets/fonts/ClashDisplay-Regular.otf'),
        'ClashDisplay-Medium': require('../assets/fonts/ClashDisplay-Regular.otf'),
        'ClashDisplay-Bold': require('../assets/fonts/ClashDisplay-Regular.otf'),
        'Gilroy-Medium': require('../assets/fonts/ClashDisplay-Regular.otf'),
        'Gilroy-Regular': require('../assets/fonts/ClashDisplay-Regular.otf'),
    });

    const [screen, setScreen] = useState<Screen>({ name: 'loading' });
    const [history, setHistory] = useState<Screen[]>([]);
    const [showSplash, setShowSplash] = useState(true);

    const navigateTo = useCallback((nextScreen: Screen) => {
        setHistory(prev => [...prev, screen]);
        setScreen(nextScreen);
    }, [screen]);

    const goBack = useCallback(() => {
        if (history.length > 0) {
            const lastScreen = history[history.length - 1];
            setHistory(prev => prev.slice(0, -1));
            setScreen(lastScreen);
        } else {
            setScreen({ name: 'home' });
        }
    }, [history]);

    const checkAppStatus = useCallback(async () => {
        // 1. Auth Check: Verify if the user is already logged in
        const tokens = await loadTokens();
        if (tokens?.accessToken) {
            const userInfo = await loadUserInfo();
            const userId = userInfo?.userId ?? 0;
            const deviceId = userInfo?.deviceId ?? 0;

            try {
                await SignalManager.initialize(userId);
            } catch (err) {
                console.error("Signal Init Failed", err);
            }

            setScreen({ name: 'home' });
            websocket.connect(userId);
        } else {
            // Default to login screen as the entry point
            setScreen({ name: 'login' });
        }
    }, []);

    // Initial Bootstrap: Run the app status check once fonts are loaded
    useEffect(() => {
        if (fontsLoaded) {
            checkAppStatus();
        }
    }, [fontsLoaded, checkAppStatus]);

    // Re-check permissions if user returns from System Settings while on the permissions screen
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextStatus: AppStateStatus) => {
            if (nextStatus === 'active' && screen.name === 'permissions') {
                const isHardwareReady = await permissionManager.checkAllMandatory();
                if (isHardwareReady) {
                    setScreen({ name: 'phone' });
                }
            }
        });
        return () => subscription.remove();
    }, [screen.name]);

    /**
     * Logic for standard login success.
     * Triggered when the user enters a valid OTP and no new keys need to be displayed.
     * Navigates directly to the list of conversations and connects the WebSocket.
     */
    const handleLoginSuccess = useCallback(async (userId: number, deviceId: number) => {
        setScreen({ name: 'conversations', userId, deviceId });
        websocket.connect(userId);
    }, []);

    /**
     * Logic for showing the 'Secret' screen (Signal keys/recovery phrase).
     * Triggered during the first-time login on a device or when a new identity is generated.
     * Displays the secret screen for 3 seconds before automatically transitioning to the main app.
     */
    const handleShowSecret = useCallback((userId: number, deviceId: number) => {
        setScreen({ name: 'secret', userId, deviceId });
        setTimeout(() => {
            setScreen({ name: 'home' });
            websocket.connect(userId);
        }, 3000);
    }, []);

    /**
     * Logic for logging out the user.
     * Disconnects the WebSocket, clears server-side session/tokens, and wipes local Signal keys
     * before returning the user to the login screen.
     */
    const handleLogout = useCallback(async () => {
        websocket.disconnect();
        await logout();
        if (screen.name === 'conversations' || screen.name === 'chat' || screen.name === 'secret') {
            await SignalManager.clearAll();
        }
        setScreen({ name: 'login' });
    }, [screen]);

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
            setScreen({ name: 'home' });
        } else {
            goBack();
        }
    }, [screen, goBack]);

    if (showSplash) {
        return (
            <>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <SplashScreen onFinish={() => setShowSplash(false)} />
            </>
        );
    }

    if (screen.name === 'loading' || !fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
                <ActivityIndicator size="large" color="#6c63ff" />
            </View>
        );
    }

    const renderScreen = () => {
        switch (screen.name) {
            case 'permissions':
                return <PermissionScreen onFinished={() => setScreen({ name: 'phone' })} />;
            case 'login':
                // Renders the Login screen with essential navigation callbacks
                return (
                    <LoginScreen
                        // handleLoginSuccess handles standard routing to home screen
                        onLoginSuccess={() => setScreen({ name: 'home' })}
                        // onShowSecret handles new-identity key recovery phase (Signal protection)
                        onShowSecret={handleShowSecret}
                        // Provides a link to the profile screen (usually for app testing or previews)
                        onGoToProfile={handleGoToProfile}
                        // Move to permissions check
                        onContinue={() => setScreen({ name: 'permissions' })}
                    />
                );
            case 'phone':
                return (
                    <PhoneScreen
                        onBack={goBack}
                        onNext={(num: string) => navigateTo({ name: 'verify', phoneNumber: num })}
                    />
                );
            case 'verify':
                return (
                    <VerifyScreen
                        phoneNumber={screen.phoneNumber}
                        onVerify={() => setScreen({ name: 'profile' })}
                        onBack={goBack}
                    />
                );
            case 'create_pin':
                return (
                    <CreatePINScreen
                        onBack={goBack}
                        onContinue={(pin) => navigateTo({ name: 'confirm_pin', createdPin: pin })}
                    />
                );
            case 'confirm_pin':
                return (
                    <ConfirmPINScreen
                        onBack={goBack}
                        onContinue={(pin) => {
                            if (pin === screen.createdPin) {
                                navigateTo({ name: 'home' });
                            } else {
                                console.log('PINs do not match');
                            }
                        }}
                    />
                );
            case 'home':
                return (
                    <HomeScreen
                        onTabPress={(key) => {
                            if (key === 'calls') navigateTo({ name: 'call_menu' });
                        }}
                        onGetStartedItem={(key) => {
                            if (key === 'invite') navigateTo({ name: 'select_contact' });
                            if (key === 'group') navigateTo({ name: 'select_member' });
                        }}
                        onChatPress={async (item) => {
                            const userInfo = await loadUserInfo();
                            navigateTo({
                                name: 'chat',
                                userId: userInfo?.userId ?? 0,
                                deviceId: userInfo?.deviceId ?? 0,
                                conversationId: parseInt(item.id),
                                peerUserId: parseInt(item.id),
                                peerDisplayName: item.name,
                                peerAvatar: null,
                            });
                        }}
                    />
                );
            case 'profile':
                return <ProfileScreen 
                    onGoBack={() => setScreen({ name: 'login' })} 
                    onSave={() => setScreen({ name: 'create_pin' })} 
                    onEditAvatar={handleGoToCharacter} 
                />;
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
                        onAboutUser={(name, avatar) => setScreen({ name: 'about_user', userName: name, userAvatar: avatar })}
                    />
                );
            case 'create_pin':
                return (
                    <CreatePINScreen
                        onBack={goBack}
                        onContinue={(pin) => navigateTo({ name: 'confirm_pin', createdPin: pin })}
                    />
                );
            case 'confirm_pin':
                return (
                    <ConfirmPINScreen
                        onBack={goBack}
                        onContinue={(pin) => {
                            if (pin === screen.createdPin) {
                                handleShowSecret(0, 0); // Trigger secret screen then home
                            } else {
                                console.log('PINs do not match');
                            }
                        }}
                    />
                );
            case 'select_contact':
                return (
                    <ContactPickerScreen
                        title="Select Contact"
                        showActions={true}
                        onBack={goBack}
                        onNewGroup={() => navigateTo({ name: 'select_member' })}
                        navigation={{
                            navigate: (to: string) => {
                                if (to === 'FindByUsername') navigateTo({ name: 'find_by_username' });
                                if (to === 'FindByPhoneNumber') navigateTo({ name: 'find_by_phone' });
                            }
                        }}
                    />
                );
            case 'select_member':
                return (
                    <ContactPickerScreen
                        title="Select Members"
                        multiSelect={true}
                        showActions={true}
                        onBack={goBack}
                        onContinue={(selectedIds) => {
                            console.log('Continue with members:', selectedIds);
                            // navigateTo({ name: 'next_screen' });
                        }}
                        navigation={{
                            navigate: (to: string) => {
                                if (to === 'FindByUsername') navigateTo({ name: 'find_by_username' });
                                if (to === 'FindByPhoneNumber') navigateTo({ name: 'find_by_phone' });
                            }
                        }}
                    />
                );
            case 'find_by_username':
                return (
                    <FindUserScreen
                        mode="username"
                        onBack={goBack}
                        onContinue={(username) => {
                            console.log('Finding username:', username);
                            navigateTo({ name: 'home' });
                        }}
                    />
                );
            case 'find_by_phone':
                return (
                    <FindUserScreen
                        mode="phone"
                        onBack={goBack}
                        onContinue={(phone) => {
                            console.log('Finding phone:', phone);
                            navigateTo({ name: 'home' });
                        }}
                    />
                );
            case 'call_menu':
                return (
                    <CallMenu onTabPress={(key) => {
                        if (key === 'chat') goBack();
                    }} />
                );
            case 'about_user':
                return (
                    <AboutUserScreen
                        user={{
                            name: screen.userName,
                            avatar: screen.userAvatar,
                        }}
                        onBack={goBack}
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
