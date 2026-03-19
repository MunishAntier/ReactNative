import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    StatusBar,
    SafeAreaView,
    ImageBackground,
    ActivityIndicator,
    Animated,
    Easing,
    KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import HeroSection from '../../components/common/HeroSection';
import FooterSection from '../../components/common/FooterSection';

const CODE_LENGTH = 4;

interface Props {
    phoneNumber?: string;
    onBack?: () => void;
    onVerify?: (code: string) => void;
    onResend?: () => void;
}

const VerifyScreen: React.FC<Props> = ({
    phoneNumber = '+61 555 123 4567',
    onBack,
    onVerify,
    onResend,
}) => {
    const insets = useSafeAreaInsets();

    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isAutoDetecting, setIsAutoDetecting] = useState(true);
    const [countdown, setCountdown] = useState(45);
    const [isFocusedIndex, setIsFocusedIndex] = useState<number | null>(0);

    const inputRefs = useRef<(TextInput | null)[]>([]);
    const spinValue = useRef(new Animated.Value(0)).current;

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Auto-detect UI logic: show while countdown is active AND otp is not full
    useEffect(() => {
        const isFull = code.join('').length === CODE_LENGTH;
        if (countdown > 0 && !isFull) {
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
        // Accept only digits
        const digit = text.replace(/[^0-9]/g, '').slice(-1);

        const newCode = [...code];
        newCode[index] = digit;
        setCode(newCode);
        setHasError(false);
        setErrorMessage('');

        // Auto-advance
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

    const handleVerify = () => {
        const fullCode = code.join('');
        if (fullCode.length < CODE_LENGTH) {
            setHasError(true);
            setErrorMessage('Please enter the complete 4-digit code.');
            return;
        }
        onVerify?.(fullCode);
    };

    const handleResend = () => {
        if (countdown > 0) return;
        setCountdown(45);
        setCode(Array(CODE_LENGTH).fill(''));
        setHasError(false);
        setErrorMessage('');
        inputRefs.current[0]?.focus();
        onResend?.();
    };



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
                    {/* Auto-detect SMS pill — only shown when detecting */}
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
                    buttonTitle="Verify"
                    onButtonPress={handleVerify}
                >
                    {/* Resend */}
                    <TouchableOpacity
                        style={styles.resendRow}
                        onPress={handleResend}
                        activeOpacity={countdown > 0 ? 1 : 0.7}
                    >
                        <Text style={styles.resendLabel}>
                            Resend code in{' '}
                            <Text style={styles.resendTimer}>{formatCountdown(countdown)}</Text>
                        </Text>
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

    resendTimer: {
        fontFamily: 'ClashDisplay-Regular',
        color: '#111111',
    },
    homeIndicator: {
        height: 20,
    },
});