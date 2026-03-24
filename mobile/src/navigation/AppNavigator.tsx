import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, AppState, AppStateStatus, ActivityIndicator, View, BackHandler } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/rootReducer';
import { logout, restoreSession } from '../store/slices/authSlice';
import { getSessionItem, API } from '../hooks/api';
import Path from '../constants/endpoint';
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
import PINScreen from '../screens/onboarding/PINScreen';
import PhoneScreen from '../screens/onboarding/PhoneScreen';
import HomeScreen from '../screens/home/HomeScreen';
import CallMenu from '../screens/home/CallMenu';
import ContactPickerScreen from '../screens/home/ContactPickerScreen';
import FindUserScreen from '../screens/home/FindUserScreen';
import AboutUserScreen from '../screens/home/AboutUserScreen';
import VerifyNumberScreen from '../screens/home/VerifyNumberScreen';
import NicknameScreen from '../screens/home/NicknameScreen';
import SettingsScreen from '../screens/home/SettingsScreen';
import AccountScreen from '../screens/home/AccountScreen';
import ChangePinScreen from '../screens/home/ChangePinScreen';
import ChangeNumberScreen from '../screens/home/ChangeNumberScreen';
import ChatsSettingScreen from '../screens/home/ChatsSettingScreen';
import NotificationsSettingScreen from '../screens/home/NotificationsSettingScreen';
import HelpScreen from '../screens/home/HelpScreen';
import PrivacySettingScreen from '../screens/home/PrivacySettingScreen';
import DataStorageScreen from '../screens/home/DataStorageScreen';
import StoriesSettingScreen from '../screens/home/StoriesSettingScreen';
import MyStoryScreen from '../screens/home/MyStoryScreen';
import ChooseViewersScreen from '../screens/home/ChooseViewersScreen';
import DeleteAccountScreen from '../screens/home/DeleteAccountScreen';
import LinkedDevicesScreen from '../screens/home/LinkedDevicesScreen';
import InviteFriendsScreen from '../screens/home/InviteFriendsScreen';

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
    }
    | { name: 'settings' }
    | { name: 'account' }
    | { name: 'change_pin_create' }
    | { name: 'change_pin_confirm'; pin: string }
    | { name: 'change_number' }
    | { name: 'chats_setting' }
    | { name: 'notifications_setting' }
    | { name: 'help' }
    | { name: 'privacy_setting' }
    | { name: 'data_storage' }
    | { name: 'stories_setting' }
    | { name: 'my_story' }
    | { name: 'choose_viewers' }
    | { name: 'delete_account' }
    | { name: 'linked_devices' }
    | { name: 'invite_friends' };

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
    const [selectedAvatar, setSelectedAvatar] = useState<any>(null);

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
        // Already authenticated in Redux — go home
        if (isAuthenticated && user) {
            setScreen({ name: 'home' });
            return;
        }

        // Check Keychain for a persisted session
        try {
            const accessToken = await getSessionItem('access_token');
            if (accessToken) {
                // Validate token by fetching user info
                const userInfo = await API.get()(Path.USER_INFO);
                if (userInfo) {
                    dispatch(restoreSession(userInfo));
                    setScreen({ name: 'home' });
                    return;
                }
            }
        } catch (e) {
            console.log('[AppNavigator] Session restore failed, proceeding to login:', e);
        }

        setScreen({ name: 'login' });
    }, [isAuthenticated, user, dispatch]);

    useEffect(() => {
        const onBackPress = () => {
            if (history.length > 0) {
                goBack();
                return true; // Prevent default behavior (exit app)
            }
            return false; // Default behavior
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [history, goBack]);

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
                        onContinue={async () => {
                            const allGranted = await permissionManager.checkAllMandatory();
                            if (allGranted) {
                                navigateTo({ name: 'phone' });
                            } else {
                                navigateTo({ name: 'permissions' });
                            }
                        }}
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
                        onComplete={() => {
                            console.log('PIN Setup Complete');
                            setHistory([]);
                            setScreen({ name: 'secret', userId: user?.id ?? 0, deviceId: 0 });
                            setTimeout(() => {
                                setScreen({ name: 'home' });
                            }, 3000);
                        }}
                    />
                );
            case 'home':
                return (
                    <HomeScreen
                        onTabPress={(key) => {
                            if (key === 'calls') navigateTo({ name: 'call_menu' });
                            if (key === 'chats') navigateTo({ name: 'conversations', userId: 0, deviceId: 0 });
                            if (key === 'settings') navigateTo({ name: 'settings' });
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
                        onAvatarPress={handleGoToCharacter}
                        avatarSource={selectedAvatar}
                    />
                );
            case 'profile':
                return <ProfileScreen
                    onGoBack={goBack}
                    onSave={() => navigateTo({ name: 'pin_setup' })}
                    onEditAvatar={handleGoToCharacter}
                    selectedAvatar={selectedAvatar}
                />;
            case 'character':
                return <CharacterScreen onClose={handleCloseCharacter} onSaveAvatar={(avatar) => setSelectedAvatar(avatar)} />;
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
            case 'settings':
                return (
                    <SettingsScreen
                        onBack={goBack}
                        onAccountPress={() => navigateTo({ name: 'account' })}
                        onChatsPress={() => navigateTo({ name: 'chats_setting' })}
                        onNotificationsPress={() => navigateTo({ name: 'notifications_setting' })}
                        onHelpPress={() => navigateTo({ name: 'help' })}
                        onPrivacyPress={() => navigateTo({ name: 'privacy_setting' })}
                        onDataStoragePress={() => navigateTo({ name: 'data_storage' })}
                        onStoriesPress={() => navigateTo({ name: 'stories_setting' })}
                        onLinkedDevicesPress={() => navigateTo({ name: 'linked_devices' })}
                        onInviteFriendsPress={() => navigateTo({ name: 'invite_friends' })}
                        onTabPress={(key) => {
                            if (key === 'chat') {
                                setHistory([]);
                                setScreen({ name: 'home' });
                            }
                            if (key === 'calls') {
                                setHistory([{ name: 'home' }]);
                                setScreen({ name: 'call_menu' });
                            }
                        }}
                    />
                );
            case 'account':
                return (
                    <AccountScreen
                        onBack={goBack}
                        onChangePin={() => navigateTo({ name: 'change_pin_create' })}
                        onChangeNumber={() => navigateTo({ name: 'change_number' })}
                        onDeleteAccount={() => navigateTo({ name: 'delete_account' })}
                    />
                );
            case 'change_pin_create':
                return (
                    <ChangePinScreen
                        key="pin-create"
                        mode="create"
                        onBack={goBack}
                        onContinue={(pin) => navigateTo({ name: 'change_pin_confirm', pin })}
                    />
                );
            case 'change_pin_confirm':
                return (
                    <ChangePinScreen
                        key="pin-confirm"
                        mode="confirm"
                        onBack={goBack}
                        onContinue={(confirmPin) => {
                            if (confirmPin === screen.pin) {
                                console.log('PIN changed successfully');
                                Alert.alert('Success', 'PIN changed successfully');
                                setHistory([{ name: 'home' }, { name: 'settings' }]);
                                setScreen({ name: 'account' });
                            } else {
                                Alert.alert('Mismatch', 'PINs do not match. Please try again.');
                            }
                        }}
                    />
                );
            case 'change_number':
                return (
                    <ChangeNumberScreen
                        onBack={goBack}
                        onContinue={(oldNum, newNum) => {
                            console.log('Change number:', oldNum, '->', newNum);
                            goBack();
                        }}
                    />
                );
            case 'chats_setting':
                return <ChatsSettingScreen onBack={goBack} />;
            case 'notifications_setting':
                return <NotificationsSettingScreen onBack={goBack} />;
            case 'help':
                return <HelpScreen onBack={goBack} />;
            case 'privacy_setting':
                return <PrivacySettingScreen onBack={goBack} />;
            case 'data_storage':
                return <DataStorageScreen onBack={goBack} />;
            case 'stories_setting':
                return <StoriesSettingScreen onBack={goBack} onMyStoryPress={() => navigateTo({ name: 'my_story' })} onNewCustomStory={() => navigateTo({ name: 'choose_viewers' })} />;
            case 'my_story':
                return <MyStoryScreen onBack={goBack} onChooseViewers={() => navigateTo({ name: 'choose_viewers' })} />;
            case 'choose_viewers':
                return <ChooseViewersScreen onBack={goBack} onContinue={() => goBack()} />;
            case 'delete_account':
                return <DeleteAccountScreen onBack={goBack} onDelete={(phone) => { console.log('Delete account:', phone); goBack(); }} />;
            case 'linked_devices':
                return <LinkedDevicesScreen onBack={goBack} />;
            case 'invite_friends':
                return <InviteFriendsScreen onBack={goBack} />;
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
