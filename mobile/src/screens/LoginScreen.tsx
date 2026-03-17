import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    startAuth,
    verifyOTP,
    loadUserInfo,
    getOrCreateStableDeviceUuid,
} from '../services/auth';
import { generateAndUploadKeys, rotateSignedPreKey } from '../services/keys';
import * as SignalManager from '../crypto/SignalManager';
import { clearSignalStorage, getCurrentSignedPreKeyId } from '../crypto/SignalKeyStore';

interface LoginScreenProps {
    onLoginSuccess: (userId: number, deviceId: number) => void;
    onShowSecret: (userId: number, deviceId: number) => void;
    onGoToProfile: () => void;
}

type Step = 'email' | 'otp';

const BASE_SCREEN_WIDTH = 430;
const BASE_SCREEN_HEIGHT = 932;
const STATUS_BAR_OFFSET = 20; // approximate iOS notch height in Figma base
const FONT_FAMILIES = {
    clashRegular: 'ClashDisplay-Regular',
    clashMedium: 'ClashDisplay-Medium',
    gilroyRegular: 'Gilroy-Regular',
};
const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onShowSecret, onGoToProfile }) => {
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const wScale = screenWidth / BASE_SCREEN_WIDTH;
    const hScale = screenHeight / BASE_SCREEN_HEIGHT;
    const typeScale = Math.min(wScale, hScale);

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const handleSendOtp = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const res = await startAuth(trimmedEmail);
            if (res.dev_otp) {
                setDevOtp(res.dev_otp);
                setOtp(res.dev_otp);
            }
            setStep('otp');
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) {
            Alert.alert('Error', 'Please enter the OTP');
            return;
        }

        setLoading(true);
        try {
            const previousUserInfo = await loadUserInfo();
            const deviceUuid = await getOrCreateStableDeviceUuid(Platform.OS);
            console.log('[DEBUG] Verify OTP:', { email: email.trim(), otp: otp.trim(), deviceUuid, platform: Platform.OS });
            const res = await verifyOTP(email.trim(), otp.trim(), deviceUuid, Platform.OS);

            const sameUserNewDevice =
                previousUserInfo?.userId === res.user_id &&
                previousUserInfo.deviceId !== res.device_id;

            if (sameUserNewDevice) {
                try {
                    await SignalManager.clearAll();
                } catch { }
                try {
                    await clearSignalStorage(res.user_id);
                } catch { }
            }

            try {
                const isNewIdentity = await SignalManager.initialize(res.user_id);
                if (isNewIdentity || sameUserNewDevice) {
                    await generateAndUploadKeys(res.user_id, 100);
                    onShowSecret(res.user_id, res.device_id);
                } else {
                    try {
                        const currentSpkId = await getCurrentSignedPreKeyId(res.user_id);
                        if (currentSpkId === 0) {
                            await rotateSignedPreKey(res.user_id);
                            onShowSecret(res.user_id, res.device_id);
                            return; // Stop here, onShowSecret will handle navigation
                        }
                    } catch { }
                    onLoginSuccess(res.user_id, res.device_id);
                }
            } catch { }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const topOffset = STATUS_BAR_OFFSET * hScale;

    const heroFrameStyle = {
        height: 552 * hScale,
        top: topOffset,
    };

    const heroBandStyle = {
        top: 222 * hScale,
        height: 126 * hScale,
    };

    const upperFrameFadeStyle = {
        top: 9.95 * hScale,
        left: -426.12 * wScale,
        width: 1168.5176 * wScale,
        height: 397.542 * hScale,
    };

    const heroGlowPrimaryStyle = {
        top: 92 * hScale,
        left: -46 * wScale,
        width: 322 * wScale,
        height: 252 * hScale,
    };

    const heroGlowSecondaryStyle = {
        top: 46 * hScale,
        right: -120 * wScale,
        width: 354 * wScale,
        height: 294 * hScale,
    };

    const headerRowStyle = {
        top: 94 * hScale,
        left: 44 * wScale,
        width: 170 * wScale,
        height: 70 * wScale,
    };

    const copyBlockStyle = {
        top: 180 * hScale,
        left: 44 * wScale,
        width: 342 * wScale,
    };

    const lowerPanelStyle = {
        top: 532 * hScale + topOffset,
    };

    const dotsFieldStyle = {
        top: 20 * hScale,
        left: 24 * wScale,
        width: 382 * wScale,
        height: 212 * hScale,
    };

    const illustrationStyle = {
        width: 270.3709 * wScale,
        height: 280.9739 * hScale,
        top: 439.18 * hScale + topOffset,
        left: 79.81 * wScale,
    };

    const ctaGroupStyle = {
        left: 24 * wScale,
        right: 24 * wScale,
        bottom: 40 * hScale,
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {!showForm && (
                    <View style={styles.screenRoot}>
                        <View style={[styles.heroFrame, heroFrameStyle]}>
                            <Image
                                source={require('../assets/images/login_top_frame.png')}
                                style={StyleSheet.absoluteFillObject}
                                resizeMode="cover"
                            />
                        </View>

                        <View style={[styles.lowerPanel, lowerPanelStyle]}>
                            <Image
                                source={require('../assets/images/login_dots.png')}
                                style={[styles.dotsFieldImage, dotsFieldStyle]}
                                resizeMode="stretch"
                            />
                        </View>

                        <Image
                            source={require('../assets/images/login_key.png')}
                            style={[styles.illustration, illustrationStyle]}
                            resizeMode="contain"
                        />

                        <View style={[styles.ctaGroup, ctaGroupStyle]}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => setShowForm(true)}
                                activeOpacity={0.9}>
                                <Text
                                    style={[
                                        styles.primaryButtonText,
                                        {
                                            fontSize: 18 * typeScale,
                                        },
                                    ]}>
                                    Continue
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setShowForm(true)}
                                activeOpacity={0.9}>
                                <Text
                                    style={[
                                        styles.secondaryButtonText,
                                        {
                                            fontSize: 18 * typeScale,
                                        },
                                    ]}>
                                    Restore for transfer
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.profileLink}
                                onPress={onGoToProfile}
                                activeOpacity={0.7}>
                                <Text
                                    style={[
                                        styles.profileLinkText,
                                        {
                                            fontSize: 16 * typeScale,
                                        },
                                    ]}>
                                    Go to Profile
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {showForm && (
                    <View style={styles.authOverlay}>
                        <View style={styles.authHeader}>
                            <TouchableOpacity onPress={() => setShowForm(false)}>
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            {step === 'email' ? (
                                <View style={styles.formContainer}>
                                    <Text style={styles.label}>Email Address</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="you@example.com"
                                        placeholderTextColor="#666"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!loading}
                                    />
                                    <TouchableOpacity
                                        style={[styles.button, loading && styles.buttonDisabled]}
                                        onPress={handleSendOtp}
                                        disabled={loading}>
                                        {loading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.buttonText}>Send OTP</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.formContainer}>
                                    <Text style={styles.label}>Enter OTP</Text>
                                    <Text style={styles.hint}>
                                        We sent a verification code to {email}
                                    </Text>
                                    {devOtp && (
                                        <View style={styles.devOtpBanner}>
                                            <Text style={styles.devOtpText}>DEV OTP: {devOtp}</Text>
                                        </View>
                                    )}
                                    <TextInput
                                        style={styles.input}
                                        placeholder="000000"
                                        placeholderTextColor="#666"
                                        value={otp}
                                        onChangeText={setOtp}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        editable={!loading}
                                    />
                                    <TouchableOpacity
                                        style={[styles.button, loading && styles.buttonDisabled]}
                                        onPress={handleVerifyOtp}
                                        disabled={loading}>
                                        {loading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.buttonText}>Verify & Login</Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.backButton}
                                        onPress={() => {
                                            setStep('email');
                                            setOtp('');
                                            setDevOtp(null);
                                        }}>
                                        <Text style={styles.backButtonText}>← Change Email</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#070707',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#070707',
    },
    screenRoot: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#070707',
    },
    heroFrame: {
        position: 'absolute',
        left: 0,
        right: 0,
        overflow: 'hidden',
    },
    heroBand: {
        position: 'absolute',
        left: -24,
        right: -24,
        transform: [{ rotate: '-7deg' }],
    },
    upperFrameFade: {
        position: 'absolute',
    },
    heroGlow: {
        position: 'absolute',
        borderRadius: 999,
        transform: [{ rotate: '-12deg' }],
    },
    heroGlowSecondary: {
        transform: [{ rotate: '8deg' }],
    },
    headerRow: {
        position: 'absolute',
    },
    headerLogo: {
        width: '100%',
        height: '100%',
    },
    copyBlock: {
        position: 'absolute',
    },
    headline: {
        color: '#FCFDFD',
        fontFamily: FONT_FAMILIES.clashMedium,
        fontWeight: '500',
        letterSpacing: 0,
    },
    bodyCopy: {
        color: '#929292',
        fontFamily: FONT_FAMILIES.gilroyRegular,
        fontWeight: '400',
        letterSpacing: 0,
    },
    lowerPanel: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#FCFDFD',
    },
    dotsFieldImage: {
        position: 'absolute',
    },
    illustration: {
        position: 'absolute',
    },
    ctaGroup: {
        position: 'absolute',
        gap: 10,
    },
    primaryButton: {
        height: 56,
        borderRadius: 12,
        backgroundColor: '#070707',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FCFDFD',
        fontFamily: FONT_FAMILIES.clashRegular,
        fontWeight: '400',
        lineHeight: 18,
        textAlign: 'center',
    },
    secondaryButton: {
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#070707',
        backgroundColor: '#FCFDFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        color: '#070707',
        fontFamily: FONT_FAMILIES.clashRegular,
        fontWeight: '400',
        lineHeight: 18,
        textAlign: 'center',
    },
    authOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#070707',
    },
    authHeader: {
        paddingTop: 56,
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    formContainer: {
        gap: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ccc',
        marginBottom: 4,
    },
    hint: {
        fontSize: 13,
        color: '#888',
        marginBottom: 4,
    },
    input: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#ffffff',
        borderWidth: 1,
        borderColor: '#2a2a3e',
    },
    button: {
        backgroundColor: '#6c63ff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    backButtonText: {
        color: '#6c63ff',
        fontSize: 14,
    },
    devOtpBanner: {
        backgroundColor: '#2d2b55',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    devOtpText: {
        color: '#ffd700',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 3,
    },
    profileLink: {
        marginTop: 8,
        alignItems: 'center',
    },
    profileLinkText: {
        color: '#6c63ff',
        fontFamily: FONT_FAMILIES.clashRegular,
        textDecorationLine: 'underline',
    },
});

export default LoginScreen;
