import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, AppState, AppStateStatus, ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';

import { loadTokens } from '../services/api';
import { logout, loadUserInfo } from '../services/auth';
import { websocket } from '../services/websocket';
import { permissionManager } from '../services/PermissionManager'; // New Service
import * as SignalManager from '../crypto/SignalManager';

// Screens
// import LoginScreen from '../screens/LoginScreen';
// import ConversationsScreen from '../screens/ConversationsScreen';
// import ChatScreen from '../screens/ChatScreen';
import PermissionScreen from '../screens/PermissionScreen'; // New Screen
import VerifyScreen from '../screens/VerifyScreen';
import CreatePINScreen from '../screens/CreatePINScreen';
import ConfirmPINScreen from '../screens/ConfirmPINScreen';
import PhoneScreen from '../screens/PhoneScreen';
import HomeScreen from '../screens/HomeScreen';
import CallMenu from '../screens/CallMenu';
import SelectContactScreen from '../screens/SelectContactScreen';
import SelectMemberScreen from '../screens/SelectMemberScreen';
import FindByUsernameScreen from '../screens/FindByUsernameScreen';
import FindByPhoneNumberScreen from '../screens/FindByPhoneNumberScreen';


type Screen =
    | 'loading'
    | 'permissions'
    | 'verify'
    | 'create_pin'
    | 'confirm_pin'
    | 'home'
    | 'call_menu'
    // | 'login'
    | 'phone'
    | 'success'
    | 'select_contact'
    | 'select_member'
    | 'find_by_username'
    | 'find_by_phone'
    /*
    | { name: 'conversations'; userId: number; deviceId: number }
    | {
        name: 'chat';
        userId: number;
        conversationId: number | null;
        peerUserId: number;
    }
    */;

export type RootStackParamList = {
    // login: undefined;
    permissions: undefined;
    verify: { phoneNumber: string };
    create_pin: undefined;
    confirm_pin: { pin: string };
    phone: undefined;
    home: undefined;
    // conversations: { userId: number; deviceId: number };
    // chat: { userId: number; conversationId: number | null; peerUserId: number };
};

const AppNavigator: React.FC = () => {
    /*
    const [fontsLoaded] = useFonts({
        'ClashDisplay-Regular': require('../assets/fonts/ClashDisplay-Regular.otf'),
        'ClashDisplay-Medium': require('../assets/fonts/ClashDisplay-Medium.otf'),
        'ClashDisplay-Bold': require('../assets/fonts/ClashDisplay-Bold.otf'),
        'Gilroy-Medium': require('../assets/fonts/Gilroy-Medium.otf'),

    });
    */
    const fontsLoaded = true; // Temporary fallback until font files are added


    const [screen, setScreen] = useState<Screen>('permissions');
    const [history, setHistory] = useState<Screen[]>([]);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [createdPin, setCreatedPin] = useState('');

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
            setScreen('home');
        }
    }, [history]);


    const checkAppStatus = useCallback(async () => {
        // 1. Hardware Check (The Gatekeeper)
        const isHardwareReady = await permissionManager.checkAllMandatory();
        if (!isHardwareReady) {
            setScreen('permissions');
            return;
        }

        // transition after permissions to phone screen
        setScreen('phone');
        return;

        /*
        // 2. Auth Check

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

            setScreen({ name: 'conversations', userId, deviceId });
            websocket.connect(userId);
        } else {
            setScreen({ name: 'login' });
        }
        */
    }, []);

    // Initial Bootstrap
    useEffect(() => {
        checkAppStatus();
    }, [checkAppStatus]);

    // Re-check permissions if user returns from System Settings
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextStatus: AppStateStatus) => {
            if (nextStatus === 'active') {
                // Auto-continue disabled: User must manually click "Continue"
                // in the PermissionScreen to proceed.
                // checkAppStatus();
            }
        });
        return () => subscription.remove();
    }, [checkAppStatus]);

    /*
    const handleLoginSuccess = useCallback(async (userId: number, deviceId: number) => {
        setScreen({ name: 'conversations', userId, deviceId });
        websocket.connect(userId);
    }, []);

    const handleLogout = useCallback(async () => {
        websocket.disconnect();
        await logout();
        await SignalManager.clearAll();
        setScreen('login');
    }, []);
    */

    /*
    const handleSelectConversation = useCallback(
        (conversationId: number, peerUserId: number) => {
            if (typeof screen === 'object' && screen.name === 'conversations') {
                setScreen({
                    name: 'chat',
                    userId: screen.userId,
                    conversationId,
                    peerUserId,
                });
            }
        },
        [screen],
    );

    const handleStartNewChat = useCallback(
        (peerUserId: number) => {
            if (typeof screen === 'object' && screen.name === 'conversations') {
                setScreen({
                    name: 'chat',
                    userId: screen.userId,
                    conversationId: null,
                    peerUserId,
                });
            }
        },
        [screen],
    );

    const handleGoBack = useCallback(() => {
        if (typeof screen === 'object' && screen.name === 'chat') {
            setScreen({
                name: 'conversations',
                userId: screen.userId,
                deviceId: 0,
            });
        }
    }, [screen]);
    */

    // While determining initial state or loading fonts, show a clean background
    if (screen === 'loading' || !fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
                <ActivityIndicator size="large" color="#6c63ff" />
            </View>
        );
    }


    return (
        <>
            <StatusBar barStyle="dark-content" backgroundColor="#e9edf1" />

            {screen === 'permissions' && (
                <PermissionScreen onFinished={checkAppStatus} />
            )}

            {screen === 'phone' && (
                <PhoneScreen
                    onBack={goBack}
                    onNext={(num: string) => {
                        setPhoneNumber(num);
                        navigateTo('verify');
                    }}
                />
            )}

            {screen === 'verify' && (
                <VerifyScreen
                    phoneNumber={phoneNumber}
                    onVerify={() => navigateTo('create_pin')}
                    onBack={goBack}
                />
            )}

            {screen === 'create_pin' && (
                <CreatePINScreen
                    onBack={goBack}
                    onContinue={(pin) => {
                        setCreatedPin(pin);
                        navigateTo('confirm_pin');
                    }}
                />
            )}

            {screen === 'confirm_pin' && (
                <ConfirmPINScreen
                    onBack={goBack}
                    onContinue={(pin) => {
                        if (pin === createdPin) {
                            console.log('PIN Onboarding Complete');
                            navigateTo('home');
                        } else {
                            // Handle mismatch (e.g., alert)
                            console.log('PINs do not match');
                        }
                    }}
                />
            )}

            {/* 
            {screen === 'login' && (
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
            )}

            {typeof screen === 'object' && screen.name === 'conversations' && (
                <ConversationsScreen
                    userId={screen.userId}
                    onSelectConversation={handleSelectConversation}
                    onStartNewChat={handleStartNewChat}
                    onLogout={handleLogout}
                />
            )}

            {typeof screen === 'object' && screen.name === 'chat' && (
                <ChatScreen
                    conversationId={screen.conversationId}
                    peerUserId={screen.peerUserId}
                    myUserId={screen.userId}
                    onGoBack={handleGoBack}
                />
            )}
            */}
            {screen === 'home' && (
                <HomeScreen 
                    onTabPress={(key) => {
                        if (key === 'calls') navigateTo('call_menu');
                    }} 
                    onGetStartedItem={(key) => {
                        if (key === 'invite') navigateTo('select_contact');
                        if (key === 'group') navigateTo('select_member');
                    }}
                />
            )}
            {screen === 'select_contact' && (
                <SelectContactScreen 
                    navigation={{ 
                        goBack: goBack,
                        navigate: (to: string) => {
                            if (to === 'FindByUsername') navigateTo('find_by_username');
                            if (to === 'FindByPhoneNumber') navigateTo('find_by_phone');
                        }
                    }} 
                    onNewGroup={() => navigateTo('select_member')}
                />
            )}
            {screen === 'select_member' && (
                <SelectMemberScreen 
                    navigation={{ 
                        goBack: goBack,
                        navigate: (to: string) => {
                            if (to === 'FindByUsername') navigateTo('find_by_username');
                            if (to === 'FindByPhoneNumber') navigateTo('find_by_phone');
                        }
                    }} 
                />
            )}
            {screen === 'find_by_username' && (
                <FindByUsernameScreen 
                    onBack={goBack}
                    onContinue={(username) => {
                        console.log('Finding username:', username);
                        navigateTo('home');
                    }}
                />
            )}
            {screen === 'find_by_phone' && (
                <FindByPhoneNumberScreen 
                    onBack={goBack}
                    onContinue={(phone) => {
                        console.log('Finding phone:', phone);
                        navigateTo('home');
                    }}
                />
            )}
            {screen === 'call_menu' && (
                <CallMenu onTabPress={(key) => {
                    if (key === 'chat') goBack();
                }} />
            )}
        </>
    );
};

export default AppNavigator;
