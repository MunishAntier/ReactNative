import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    StatusBar,
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DeviceInfo from 'react-native-device-info';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/rootReducer';
import { registerReset } from '../../store/slices/registerSlice';
import { sendOtpRequest, sendOtpReset } from '../../store/slices/sendOtpSlice';
import { verifyOtpRequest, verifyOtpReset } from '../../store/slices/verifyOtpSlice';
import { getSessionItem } from '../../hooks/api';

import HeroSection from '../../components/common/HeroSection';
import FooterSection from '../../components/common/FooterSection';

const CODE_LENGTH = 4;
const RESEND_COOLDOWN = 59;
const DEVICE_TOKEN = 'for_FCM_token_later';

interface Props {
    phoneNumber?: string;
    onBack?: () => void;
    onVerify?: (code: string) => void;
}

const VerifyScreen: React.FC<Props> = ({
    phoneNumber = '+61 555 123 4567',
    onBack,
    onVerify,
}) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();

    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isAutoDetecting, setIsAutoDetecting] = useState(true);
    const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
    const [isFocusedIndex, setIsFocusedIndex] = useState<number | null>(0);
    const [isResending, setIsResending] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);
    const spinValue = useRef(new Animated.Value(0)).current;

    // ─── Redux ────────────────────────────────────────────────────────────────

    const { response: registerResponse } = useSelector(
        (state: RootState) => state.register,
    );

    useEffect(() => {
        if (registerResponse) {
            console.log('Register Response in VerifyScreen:', registerResponse);
        }
    }, [registerResponse]);

    const { loading: otpLoading, error: sendOtpError, response: sendOtpResponse } = useSelector(
        (state: RootState) => state.sendOtp,
    );
    const { loading: verifyLoading, error: verifyError, response: verifyResponse } = useSelector(
        (state: RootState) => state.verifyOtp,
    );

    // ─── Countdown timer ──────────────────────────────────────────────────────

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Auto-detect UI logic: show while countdown is active AND no digit entered
    useEffect(() => {
        const hasAnyDigit = code.some(c => c !== '');
        if (countdown > 0 && !hasAnyDigit) {
            setIsAutoDetecting(true);
        } else {
            setIsAutoDetecting(false);
        }
    }, [countdown, code]);

    // Spinner animation for auto-detect
    useEffect(() => {
        if (!isAutoDetecting) return;

        const spin = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1200,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spin.start();
        return () => spin.stop();
    }, [isAutoDetecting]);

    // ─── Send OTP Response Handling (Resend) ──────────────────────────────────

    useEffect(() => {
        if (sendOtpResponse) {
            setIsResending(false);
            setCountdown(RESEND_COOLDOWN);
            setCode(Array(CODE_LENGTH).fill(''));
            setHasError(false);
            setErrorMessage('');
            inputRefs.current[0]?.focus();
            dispatch(sendOtpReset());
        }
    }, [sendOtpResponse]);

    useEffect(() => {
        if (sendOtpError) {
            setIsResending(false);
            Alert.alert(
                'Resend Failed',
                sendOtpError,
                [{ text: 'OK', onPress: () => dispatch(sendOtpReset()) }],
            );
        }
    }, [sendOtpError]);

    // ─── Verify OTP Response Handling ─────────────────────────────────────────

    useEffect(() => {
        if (verifyResponse) {
            dispatch(verifyOtpReset());
            // dispatch(registerReset());
            onVerify?.(code.join(''));
        }
    }, [verifyResponse]);

    useEffect(() => {
        if (verifyError) {
            Alert.alert(
                'Verification Failed',
                verifyError,
                [{ text: 'OK', onPress: () => dispatch(verifyOtpReset()) }],
            );
        }
    }, [verifyError]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            dispatch(sendOtpReset());
            dispatch(verifyOtpReset());
        };
    }, []);

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const spinInterpolate = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const formatCountdown = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleChangeText = (text: string, index: number) => {
        const digit = text.replace(/[^0-9]/g, '').slice(-1);

        const newCode = [...code];
        newCode[index] = digit;
        setCode(newCode);
        setHasError(false);
        setErrorMessage('');

        if (digit && index < CODE_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace') {
            if (code[index] === '' && index > 0) {
                const newCode = [...code];
                newCode[index - 1] = '';
                setCode(newCode);
                inputRefs.current[index - 1]?.focus();
            } else {
                const newCode = [...code];
                newCode[index] = '';
                setCode(newCode);
            }
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length < CODE_LENGTH) {
            setHasError(true);
            setErrorMessage('Please enter the complete 4-digit code.');
            return;
        }

        try {
            // Get device data from keychain
            const deviceId = await getSessionItem('device_uuid');
            const deviceType = DeviceInfo.getSystemName();

            // Get phone_number and uid from register state
            const phone = registerResponse?.phone_number
                ? (registerResponse.phone_number.startsWith('+')
                    ? registerResponse.phone_number
                    : `+${registerResponse.phone_number}`)
                : phoneNumber;

            const registrationId = registerResponse?.uid || '';

            dispatch(verifyOtpRequest({
                phone_number: phone || '',
                verification_code: fullCode,
                device_id: deviceId || '',
                device_type: deviceType,
                device_token: DEVICE_TOKEN,
                registration_id: registrationId,
            }));
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Something went wrong.');
        }
    };

    const handleResend = async () => {
        if (countdown > 0 || otpLoading) return;

        try {
            setIsResending(true);

            const deviceId = await getSessionItem('device_uuid');
            const deviceType = DeviceInfo.getSystemName();

            const phone = phoneNumber?.startsWith('+')
                ? phoneNumber
                : `+${phoneNumber}`;

            dispatch(sendOtpRequest({
                phone_number: phone,
                device_id: deviceId || '',
                device_type: deviceType,
            }));
        } catch (err: any) {
            setIsResending(false);
            Alert.alert('Error', err.message || 'Something went wrong.');
        }
    };

    // ─── Derived ──────────────────────────────────────────────────────────────

    const isCodeComplete = code.join('').length === CODE_LENGTH;
    const isVerifyDisabled = !isCodeComplete || verifyLoading || isResending;
    const isResendEnabled = countdown <= 0 && !otpLoading && !isResending;

    return (
        <View style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <HeroSection
                    title="Verify number"
                    subtitle={
                        <>
                            We sent a 4-digit secure code to{'\n'}
                            <Text style={styles.heroPhone}>{phoneNumber}</Text>
                        </>
                    }
                    onBack={onBack}
                />

                {/* ── BODY ── */}
                <View style={styles.body}>
                    {/* Auto-detect SMS pill — hidden once user starts typing */}
                    {isAutoDetecting && (
                        <View style={styles.autoDetectPill}>
                            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                                <MaterialCommunityIcons name="loading" size={18} color="#0230F9" />
                            </Animated.View>
                            <Text style={styles.autoDetectText}>Waiting to auto-detect SMS...</Text>
                        </View>
                    )}

                    {/* OTP boxes */}
                    <View style={styles.otpRow}>
                        {Array(CODE_LENGTH).fill(0).map((_, i) => {
                            const isFilled = code[i] !== '';
                            const isActive = isFocusedIndex === i;
                            return (
                                <TextInput
                                    key={i}
                                    ref={ref => { inputRefs.current[i] = ref; }}
                                    value={code[i]}
                                    onChangeText={text => handleChangeText(text, i)}
                                    onKeyPress={e => handleKeyPress(e, i)}
                                    onFocus={() => setIsFocusedIndex(i)}
                                    onBlur={() => setIsFocusedIndex(null)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    textAlign="center"
                                    selectTextOnFocus
                                    caretHidden
                                    autoFocus={i === 0}
                                    placeholder="·"
                                    placeholderTextColor={hasError ? '#E03737' : '#AAAAAA'}
                                    editable={!verifyLoading}
                                    style={[
                                        styles.otpBox,
                                        hasError && styles.otpBoxError,
                                        isActive && !hasError && styles.otpBoxActive,
                                        hasError && isFilled && styles.otpTextError,
                                    ]}
                                />
                            );
                        })}
                    </View>

                    {/* Error message */}
                    {hasError && errorMessage !== '' && (
                        <View style={styles.errorRow}>
                            <Ionicons name="alert-circle-outline" size={15} color="#E03737" />
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                    )}
                </View>

                <FooterSection
                    buttonTitle={verifyLoading ? 'Verifying...' : 'Verify'}
                    onButtonPress={handleVerify}
                    disabled={isVerifyDisabled}
                >
                    {/* Resend */}
                    <TouchableOpacity
                        style={styles.resendRow}
                        onPress={handleResend}
                        activeOpacity={isResendEnabled ? 0.7 : 1}
                        disabled={!isResendEnabled}
                    >
                        {countdown > 0 ? (
                            <Text style={styles.resendLabel}>
                                Resend code in{' '}
                                <Text style={styles.resendTimer}>{formatCountdown(countdown)}</Text>
                            </Text>
                        ) : (
                            <Text style={[styles.resendLabel, styles.resendActive]}>
                                Resend code
                            </Text>
                        )}
                    </TouchableOpacity>
                </FooterSection>
            </KeyboardAvoidingView>
        </View>
    );
};

export default VerifyScreen;

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0a0f1e',
    },
    flex: {
        flex: 1,
    },

    heroPhone: {
        fontFamily: 'ClashDisplay-Regular',
        color: '#FFFFFF',
    },

    // ── Body ──
    body: {
        flex: 1,
        backgroundColor: '#F5F6F8',
        paddingHorizontal: 24,
        paddingTop: 24,
    },

    // Auto-detect pill
    autoDetectPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#F5F7FF',
        borderRadius: 88,
        borderWidth: 1,
        borderColor: '#0230F9',
        width: 265,
        height: 42,
        paddingHorizontal: 10,
        marginBottom: 20,
        gap: 6,
    },
    autoDetectText: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 16,
        color: '#0230F9',
        lineHeight: 16 * 1.4,
        letterSpacing: 0,
    },

    // OTP row
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    otpBox: {
        width: 44.46,
        height: 57,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E6EE',
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 22,
        color: '#111111',
        textAlign: 'center',
    },
    otpBoxActive: {
        borderColor: '#9AA3C8',
        borderWidth: 1.5,
    },
    otpBoxError: {
        borderColor: '#E03737',
        borderWidth: 1.5,
        color: '#E03737',
    },
    otpTextError: {
        color: '#E03737',
    },

    // Error message
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 10,
    },
    errorText: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 13,
        color: '#E03737',
    },

    resendRow: {
        alignItems: 'center',
        marginBottom: 16,
    },
    resendLabel: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 14,
        color: '#555555',
    },
    resendActive: {
        color: '#0230F9',
        fontFamily: 'ClashDisplay-Medium',
    },
    resendTimer: {
        fontFamily: 'ClashDisplay-Regular',
        color: '#111111',
    },
    homeIndicator: {
        height: 20,
    },
});