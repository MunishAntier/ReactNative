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
} from 'react-native';
import { startAuth, verifyOTP } from '../services/auth';
import { generateAndUploadKeys } from '../services/keys';
import * as SignalManager from '../crypto/SignalManager';

interface LoginScreenProps {
    onLoginSuccess: (userId: number, deviceId: number) => void;
}

type Step = 'email' | 'otp';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }
        setLoading(true);
        try {
            const res = await startAuth(email.trim());
            if (res.dev_otp) {
                setDevOtp(res.dev_otp);
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
            // Use a STABLE device UUID so we reuse the same server-side device
            // record across logins.  Creating a new device on every login caused
            // "bundle not found" and decryption failures.
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            let deviceUuid = await AsyncStorage.getItem('device_uuid');
            if (!deviceUuid) {
                deviceUuid = `${Platform.OS}-${Date.now()}`;
                await AsyncStorage.setItem('device_uuid', deviceUuid);
                console.log('[Login] Generated new device UUID:', deviceUuid);
            } else {
                console.log('[Login] Reusing device UUID:', deviceUuid);
            }
            const res = await verifyOTP(email.trim(), otp.trim(), deviceUuid, Platform.OS);

            // Initialize Signal — only upload keys if this is a brand new identity.
            // Uploading keys every login overwrites local pre-keys, making pending
            // messages undecryptable (SignalError 6).
            try {
                const isNewIdentity = await SignalManager.initialize(res.user_id);
                if (isNewIdentity) {
                    await generateAndUploadKeys(res.user_id, 100);
                    console.log('[Login] NEW identity — keys generated and uploaded');
                } else {
                    console.log('[Login] Existing identity loaded — skipping key upload');
                }
            } catch (keyErr: any) {
                console.warn('[Login] Signal init/key upload failed:', keyErr.message);
            }

            onLoginSuccess(res.user_id, res.device_id);
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.content}>
                {/* Logo area */}
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoIcon}>🔒</Text>
                    </View>
                    <Text style={styles.title}>SecureMsg</Text>
                    <Text style={styles.subtitle}>End-to-End Encrypted Messaging</Text>
                </View>

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
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
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
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#6c63ff',
    },
    logoIcon: {
        fontSize: 36,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
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
});

export default LoginScreen;
