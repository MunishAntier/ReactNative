import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, AppState, AppStateStatus, ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/rootReducer';
import { logout } from '../store/slices/authSlice';
import { permissionManager } from '../Services/PermissionManager';
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
import PINScreen from '../screens/onboarding/PINScreen';
import PhoneScreen from '../screens/onboarding/PhoneScreen';
import HomeScreen from '../screens/home/HomeScreen';
import CallMenu from '../screens/home/CallMenu';
import ContactPickerScreen from '../screens/home/ContactPickerScreen';
import FindUserScreen from '../screens/home/FindUserScreen';
import AboutUserScreen from '../screens/home/AboutUserScreen';
import VerifyNumberScreen from '../screens/home/VerifyNumberScreen';
import NicknameScreen from '../screens/home/NicknameScreen';

type Screen =
    | { name: 'loading' }
    | { name: 'permissions' }
    | { name: 'phone' }
    | { name: 'verify'; phoneNumber: string }
    | { name: 'pin_setup' }
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
    }
    | {
        name: 'verify_number';
        userName: string;
    }
    | {
        name: 'nickname';
        firstName: string;
        lastName: string;
    };

const AppNavigator: React.FC = () => {
    const [fontsLoaded] = useFonts({
        'ClashDisplay-Regular': require('../Assets/fonts/ClashDisplay-Regular.otf'),
        'ClashDisplay-Medium': require('../Assets/fonts/ClashDisplay-Medium.otf'),
        'ClashDisplay-Bold': require('../Assets/fonts/ClashDisplay-Bold.otf'),
        'Gilroy-Medium': require('../Assets/fonts/ClashDisplay-Medium.otf'),
        'Gilroy-Regular': require('../Assets/fonts/ClashDisplay-Regular.otf'),
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

    // Removed auto-navigation on permission grant via AppState
    // User must now click "Next" manually in PermissionScreen

    const handleLoginSuccess = useCallback(async (userId: number, deviceId: number) => {
        setScreen({ name: 'home' });
    }, []);

    const handleShowSecret = useCallback((userId: number, deviceId: number) => {
        navigateTo({ name: 'secret', userId, deviceId });
        setTimeout(() => {
            goBack();
        }, 3000);
    }, [navigateTo, goBack]);

    const handleLogout = useCallback(async () => {
        dispatch(logout());
        setHistory([]);
        setScreen({ name: 'login' });
    }, [dispatch]);

    const handleGoToProfile = useCallback(() => {
        navigateTo({ name: 'profile' });
    }, [navigateTo]);

    const handleGoBackFromProfile = useCallback(() => {
        goBack();
    }, [goBack]);

    const handleGoToSecretFromProfile = useCallback(() => {
        navigateTo({ name: 'secret', userId: 0, deviceId: 0 });
    }, [navigateTo]);

    const handleGoToCharacter = useCallback(() => {
        navigateTo({ name: 'character' });
    }, [navigateTo]);

    const handleCloseCharacter = useCallback(() => {
        goBack();
    }, [goBack]);

    const handleSelectConversation = useCallback(
        (conversationId: number, peerUserId: number, peerMeta?: ConversationPeerMeta) => {
            navigateTo({
                name: 'chat',
                userId: 0, // Placeholder, will be fetched in chat screen if needed
                deviceId: 0,
                conversationId,
                peerUserId,
                peerDisplayName: peerMeta?.peerDisplayName,
                peerAvatar: peerMeta?.peerAvatar ?? null,
            });
        },
        [navigateTo],
    );

    const handleStartNewChat = useCallback(
        (peerUserId: number, peerMeta?: ConversationPeerMeta) => {
            navigateTo({
                name: 'chat',
                userId: 0,
                deviceId: 0,
                conversationId: null,
                peerUserId,
                peerDisplayName: peerMeta?.peerDisplayName,
                peerAvatar: peerMeta?.peerAvatar ?? null,
            });
        },
        [navigateTo],
    );

    const handleGoBack = useCallback(() => {
        goBack();
    }, [goBack]);

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
                return (
                    <PermissionScreen
                        onFinished={() => navigateTo({ name: 'phone' })}
                        onBack={() => navigateTo({ name: 'login' })} // Using navigateTo here as requested by previous logic context, but could be goBack if applicable
                    />
                );
            case 'login':
                return (
                    <WelcomeScreen
                        onLoginSuccess={handleLoginSuccess}
                        onShowSecret={handleShowSecret}
                        onGoToProfile={handleGoToProfile}
                        onContinue={() => navigateTo({ name: 'permissions' })}
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
                        onVerify={() => navigateTo({ name: 'profile' })}
                        onBack={goBack}
                    />
                );
            case 'pin_setup':
                return (
                    <PINScreen
                        onBack={goBack}
                        onComplete={(pin, isAlphabet) => {
                            console.log('PIN Setup Complete:', pin, isAlphabet);
                            navigateTo({ name: 'home' });
                        }}
                    />
                );
            case 'home':
                return (
                    <HomeScreen
                        onTabPress={(key) => {
                            if (key === 'calls') navigateTo({ name: 'call_menu' });
                            if (key === 'chats') navigateTo({ name: 'conversations', userId: 0, deviceId: 0 });
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
                    onGoBack={goBack}
                    onSave={() => navigateTo({ name: 'pin_setup' })}
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
                        onAboutUser={(name, avatar) => navigateTo({ name: 'about_user', userName: name, userAvatar: avatar })}
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
                        onVerifyNumber={() => navigateTo({ name: 'verify_number', userName: screen.userName })}
                        onNicknamePress={() => {
                            const [firstName, ...lastNameParts] = screen.userName.split(' ');
                            const lastName = lastNameParts.join(' ');
                            navigateTo({ name: 'nickname', firstName, lastName });
                        }}
                    />
                );
            case 'verify_number':
                return (
                    <VerifyNumberScreen
                        userName={screen.userName}
                        onBack={goBack}
                    />
                );
            case 'nickname':
                return (
                    <NicknameScreen
                        onBack={goBack}
                        initialFirstName={screen.firstName}
                        initialLastName={screen.lastName}
                        onContinue={(fn, ln) => {
                            console.log('New Nickname:', fn, ln);
                            goBack();
                        }}
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
