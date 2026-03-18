import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, AppState, AppStateStatus, ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/rootReducer';
import { logout } from '../store/slices/authSlice';
import { permissionManager } from '../services/PermissionManager';
import * as SignalManager from '../crypto/SignalManager';

// Screens
import SplashScreen from '../screens/onboarding/SplashScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ConversationsScreen from '../screens/home/ConversationsScreen';
import type { ConversationPeerMeta } from '../screens/home/ConversationsScreen';
import ChatScreen from '../screens/home/ChatScreen';
import SecretScreen from '../screens/onboarding/SecretScreen';
import ProfileScreen from '../screens/onboarding/ProfileScreen';
import CharacterScreen from '../screens/onboarding/CharacterScreen';
import PermissionScreen from '../screens/onboarding/PermissionScreen';
import VerifyScreen from '../screens/onboarding/VerifyScreen';
import CreatePINScreen from '../screens/onboarding/CreatePINScreen';
import ConfirmPINScreen from '../screens/onboarding/ConfirmPINScreen';
import PhoneScreen from '../screens/onboarding/PhoneScreen';
import HomeScreen from '../screens/home/HomeScreen';
import CallMenu from '../screens/home/CallMenu';
import ContactPickerScreen from '../screens/home/ContactPickerScreen';
import FindUserScreen from '../screens/home/FindUserScreen';
import AboutUserScreen from '../screens/home/AboutUserScreen';

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
        'ClashDisplay-Medium': require('../assets/fonts/ClashDisplay-Medium.otf'),
        'ClashDisplay-Bold': require('../assets/fonts/ClashDisplay-Bold.otf'),
        'Gilroy-Medium': require('../assets/fonts/ClashDisplay-Medium.otf'),
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

    const dispatch = useDispatch();
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

    const checkAppStatus = useCallback(async () => {
        if (isAuthenticated && user) {
            setScreen({ name: 'home' });
        } else {
            setScreen({ name: 'login' });
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        // Log status for debugging
        console.log('AppNavigator Status:', { fontsLoaded, screen: screen.name, isAuthenticated, user: !!user });
        
        // Ensure we move past loading screen if fonts are loaded OR if we've waited long enough
        if (screen.name === 'loading') {
            const timer = setTimeout(() => {
                checkAppStatus();
            }, 1000); // 1s fallback
            
            if (fontsLoaded) {
                checkAppStatus();
            }
            
            return () => clearTimeout(timer);
        }
    }, [fontsLoaded, screen.name, checkAppStatus, isAuthenticated, user]);

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

    const handleLoginSuccess = useCallback(async (userId: number, deviceId: number) => {
        setScreen({ name: 'home' });
    }, []);

    const handleShowSecret = useCallback((userId: number, deviceId: number) => {
        setScreen({ name: 'secret', userId, deviceId });
        setTimeout(() => {
            setScreen({ name: 'home' });
        }, 3000);
    }, []);

    const handleLogout = useCallback(async () => {
        dispatch(logout());
        setScreen({ name: 'login' });
    }, [dispatch]);

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
            setScreen({
                name: 'chat',
                userId: 0, // Placeholder, will be fetched in chat screen if needed
                deviceId: 0,
                conversationId,
                peerUserId,
                peerDisplayName: peerMeta?.peerDisplayName,
                peerAvatar: peerMeta?.peerAvatar ?? null,
            });
        },
        [],
    );

    const handleStartNewChat = useCallback(
        (peerUserId: number, peerMeta?: ConversationPeerMeta) => {
            setScreen({
                name: 'chat',
                userId: 0,
                deviceId: 0,
                conversationId: null,
                peerUserId,
                peerDisplayName: peerMeta?.peerDisplayName,
                peerAvatar: peerMeta?.peerAvatar ?? null,
            });
        },
        [],
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

    if (screen.name === 'loading') { // Remove fontsLoaded block to prevent hang
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
                return (
                    <WelcomeScreen
                        onLoginSuccess={handleLoginSuccess}
                        onShowSecret={handleShowSecret}
                        onGoToProfile={handleGoToProfile}
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
                            if (key === 'chats') setScreen({ name: 'conversations', userId: 0, deviceId: 0 });
                        }}
                        onGetStartedItem={(key) => {
                            if (key === 'invite') navigateTo({ name: 'select_contact' });
                            if (key === 'group') navigateTo({ name: 'select_member' });
                        }}
                        onChatPress={async (item) => {
                            navigateTo({
                                name: 'chat',
                                userId: user?.id ?? 0,
                                deviceId: 0,
                                conversationId: parseInt(item.id),
                                peerUserId: parseInt(item.id),
                                peerDisplayName: item.name,
                                peerAvatar: null,
                            });
                        }}
                        onAvatarPress={handleGoToProfile}
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
        <SafeAreaProvider>
            <StatusBar
                barStyle={screen.name === 'chat' ? 'dark-content' : 'light-content'}
                backgroundColor={screen.name === 'chat' ? '#D7DBDE' : '#000000'}
            />
            {renderScreen()}
        </SafeAreaProvider>
    );
};

export default AppNavigator;
