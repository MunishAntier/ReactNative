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
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { loginRequest } from '../../store/slices/authSlice';
import { RootState } from '../../store/rootReducer';
import BackArrow from '../../components/common/BackArrow';

interface WelcomeScreenProps {
    onLoginSuccess: (userId: number, deviceId: number) => void;
    onShowSecret: (userId: number, deviceId: number) => void;
    onGoToProfile: () => void;
    onContinue?: () => void;
}

type Step = 'email' | 'otp';

const BASE_SCREEN_WIDTH = 430;
const BASE_SCREEN_HEIGHT = 932;
const STATUS_BAR_OFFSET = 20;

const FONT_FAMILIES = {
    clashRegular: 'ClashDisplay-Regular',
    clashMedium: 'ClashDisplay-Medium',
    clashBold: 'ClashDisplay-Bold',
    gilroyRegular: 'Gilroy-Regular',
    gilroyMedium: 'Gilroy-Medium',
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({onContinue }) => {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const wScale = screenWidth / BASE_SCREEN_WIDTH;
    const hScale = screenHeight / BASE_SCREEN_HEIGHT;
    const typeScale = Math.min(wScale, hScale);

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const dispatch = useDispatch();
    const { loading: authLoading, error: authError } = useSelector((state: RootState) => state.auth);

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

        // Mock Step skip
        setStep('otp');
        setDevOtp('123456');
        setOtp('123456');
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) {
            Alert.alert('Error', 'Please enter the OTP');
            return;
        }

        dispatch(loginRequest({ identifier: email.trim() }));
    };

    const heroFrameStyle = {
        height: 504 * hScale,
        top: (insets.top - 80) * hScale,
    };

    const lowerPanelStyle = {
        top: 430 * hScale,
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
        top: 380 * hScale,
        left: 79.81 * wScale,
    };

    const ctaGroupStyle = {
        left: 24 * wScale,
        right: 24 * wScale,
        bottom: 40 * hScale,
        gap: 10,
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor="#070707" />
                {!showForm && (
                    <View style={styles.screenRoot}>
                        <View style={[styles.heroFrame, heroFrameStyle]}>
                            <Image
                                source={require('../../assets/images/login_top_frame.png')}
                                style={StyleSheet.absoluteFillObject}
                                resizeMode="cover"
                            />
                        </View>

                        <View style={[styles.lowerPanel, lowerPanelStyle]}>
                            <Image
                                source={require('../../assets/images/login_dots.png')}
                                style={[styles.dotsFieldImage, dotsFieldStyle]}
                                resizeMode="stretch"
                            />
                        </View>

                        <Image
                            source={require('../../assets/images/login_key.png')}
                            style={[styles.illustration, illustrationStyle]}
                            resizeMode="contain"
                        />

                        <View style={[styles.ctaGroup, ctaGroupStyle]}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => {
                                    if (onContinue) {
                                        onContinue();
                                    } else {
                                        setShowForm(true);
                                    }
                                }}
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
                                onPress={() => {}}
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
                        </View>
                    </View>
                )}

                {showForm && (
                    <View style={styles.authOverlay}>
                        <View style={[styles.authHeader, { paddingTop: Math.max(insets.top, STATUS_BAR_OFFSET) }]}>
                            <TouchableOpacity onPress={() => setShowForm(false)}>
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            {step === 'email' ? (
                                <View style={styles.formContainer}>
                                    <View style={styles.logoContainer}>
                                        <Text style={styles.title}>Welcome Back</Text>
                                        <Text style={styles.subtitle}>Log in to your account</Text>
                                    </View>
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
                                        editable={!authLoading}
                                    />
                                    <TouchableOpacity
                                        style={[styles.button, authLoading && styles.buttonDisabled]}
                                        onPress={handleSendOtp}
                                        disabled={authLoading}>
                                        {authLoading ? (
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
                                        editable={!authLoading}
                                    />
                                    <TouchableOpacity
                                        style={[styles.button, authLoading && styles.buttonDisabled]}
                                        onPress={handleVerifyOtp}
                                        disabled={authLoading}>
                                        {authLoading ? (
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
                                        <View style={styles.backButtonContent}>
                                            <BackArrow size={16} color="#6c63ff" />
                                            <Text style={styles.backButtonText}>Change Email</Text>
                                        </View>
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
        zIndex: 5,
    },
    ctaGroup: {
        position: 'absolute',
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
        lineHeight: 18,
        textAlign: 'center',
    },
    authOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#070707',
    },
    authHeader: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontFamily: FONT_FAMILIES.clashMedium,
        fontSize: 28,
        color: '#ffffff',
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: FONT_FAMILIES.clashRegular,
        fontSize: 14,
        color: '#888',
    },
    formContainer: {
        gap: 12,
    },
    label: {
        fontFamily: FONT_FAMILIES.clashMedium,
        fontSize: 14,
        color: '#ccc',
        marginBottom: 4,
    },
    hint: {
        fontFamily: FONT_FAMILIES.clashRegular,
        fontSize: 13,
        color: '#888',
        marginBottom: 4,
    },
    input: {
        fontFamily: FONT_FAMILIES.clashRegular,
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
        fontFamily: FONT_FAMILIES.clashRegular,
        fontWeight: '700',
        color: '#ffffff',
        fontSize: 16,
    },
    backButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    backButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
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

export default WelcomeScreen;