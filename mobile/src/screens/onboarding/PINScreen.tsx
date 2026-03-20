import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Alert,
} from 'react-native';
import 'react-native-get-random-values';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import HeroSection from '../../components/common/HeroSection';
import FooterSection from '../../components/common/FooterSection';
import CustomToggle from '../../components/common/CustomToggle';
import { deriveKeyFromPin } from '../../crypto/kdf';
import { generateDEK } from '../../crypto/dek';
import { encryptAESGCM } from '../../crypto/aes';
import { toBase64, toUtf8Bytes } from '../../utils/encoding';
import { RootState } from '../../store/rootReducer';
import { setupPinRequest, resetSetupPinState } from '../../store/slices/setupPinSlice';

interface Props {
    onBack?: () => void;
    onComplete?: (pin: string, isAlphabet: boolean) => void;
}

type PINStep = 'create' | 'confirm';

const PINScreen: React.FC<Props> = ({ onBack, onComplete }) => {
    const dispatch = useDispatch();
    const { loading, error, success } = useSelector((state: RootState) => state.setupPin);

    const [step, setStep] = useState<PINStep>('create');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isAlphabet, setIsAlphabet] = useState(false);

    useEffect(() => {
        if (success) {
            console.log("PIN setup successful (Redux)------------");
            onComplete?.(pin, isAlphabet);
            dispatch(resetSetupPinState());
        }
    }, [success, onComplete, pin, isAlphabet, dispatch]);

    useEffect(() => {
        if (error) {
            Alert.alert('Error', error);
            dispatch(resetSetupPinState());
        }
    }, [error, dispatch]);

    const handleContinue = async () => {
        if (step === 'create') {
            if (pin.length < 4) {
                Alert.alert('Invalid PIN', 'PIN must be at least 4 digits');
                return;
            }
            setStep('confirm');
        } else {
            if (confirmPin !== pin) {
                Alert.alert('Mismatch', 'PINs do not match. Please try again.');
                setConfirmPin('');
                return;
            }

            //  SECURE PIN SETUP FLOW
            try {
                console.log("Starting Secure PIN Setup Flow...");

                // 1. Salt
                const salt = global.crypto.getRandomValues(new Uint8Array(16));
                console.log("Step 1: Salt generated");

                // 2. KDF params
                const kdfParams = {
                    iterations: 3,
                    memory: 65536,
                    parallelism: 4,
                    key_length: 32,
                };
                console.log("Step 2: KDF params configured", kdfParams);

                // 3. Master Key (MK)
                const MK = await deriveKeyFromPin(pin, salt, kdfParams);
                console.log("Step 3: Master Key derived");

                // 4. PIN verifier
                const pinVerifier = await deriveKeyFromPin(pin, salt, {
                    ...kdfParams,
                    iterations: 1,
                });
                console.log("Step 4: PIN verifier derived");

                // 5. Generate DEK
                const DEK = generateDEK();
                console.log("Step 5: DEK generated");

                // 6. Data to encrypt (Placeholder profile data)
                const profileData = {
                    setup_completed: true,
                };
                console.log("Step 6: Profile data to encrypt", profileData);

                // 7. Encrypt recovery data
                const encryptedData = await encryptAESGCM(
                    DEK,
                    toUtf8Bytes(JSON.stringify(profileData))
                );
                console.log("Step 7: Recovery data encrypted");

                // 8. Wrap DEK using PIN
                const wrappedDEK = await encryptAESGCM(MK, DEK);
                console.log("Step 8: DEK wrapped using PIN");

                // 9. Build payload
                const payload = {
                    kdf_salt: toBase64(salt),
                    kdf_params: kdfParams,
                    pin_verifier: toBase64(pinVerifier),
                    wrapped_dek_by_pin: toBase64(
                        JSON.stringify(wrappedDEK)
                    ),
                    registration_lock_enabled: true,
                    vault_version: 1,
                    recovery_items: [
                        {
                            item_type: "profile_name",
                            encrypted_blob: toBase64(
                                JSON.stringify(encryptedData)
                            ),
                        },
                    ],
                };
                console.log("Step 9: Final payload built", payload);

                // 10. Dispatch to Redux (will trigger Saga)
                console.log("Step 10: Dispatching setupPinRequest...");
                dispatch(setupPinRequest(payload));
            } catch (error) {
                console.error("Error creating PIN", error);
                Alert.alert('Error', 'Failed to securely set up PIN. Please try again.');
            }
        }
    };

    const handleBack = () => {
        if (step === 'confirm') {
            setStep('create');
            setConfirmPin('');
        } else {
            onBack?.();
        }
    };

    const isCreate = step === 'create';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <HeroSection
                    title={isCreate ? "Create PIN" : "Confirm PIN"}
                    subtitle={isCreate
                        ? "PINs can help you restore your account and keep your info encrypted with us"
                        : "Re-Enter the PIN you just created"
                    }
                    onBack={handleBack}
                />

                <View style={styles.body}>
                    {/* PIN Input field */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={isCreate ? pin : confirmPin}
                            onChangeText={isCreate ? setPin : setConfirmPin}
                            key={isAlphabet ? 'alphabet' : 'numeric'}
                            placeholder="····"
                            placeholderTextColor="#AAAAAA"
                            secureTextEntry={true}
                            keyboardType={isAlphabet ? 'default' : 'number-pad'}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                        />
                    </View>

                    {/* Info Message */}
                    <View style={styles.infoRow}>
                        <Ionicons name="information-circle-outline" size={18} color="#111111" />
                        <Text style={styles.infoText}>
                            {isAlphabet ? "PIN must be at least 4 digits and alphabets" : "PIN must be at least 4 digits"}
                        </Text>
                    </View>

                    {/* Toggle */}
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>
                            Create Alphabet PIN
                        </Text>
                        <CustomToggle
                            value={isAlphabet}
                            onValueChange={setIsAlphabet}
                        />
                    </View>
                </View>

                <FooterSection
                    buttonTitle={isCreate ? "Continue" : "Confirm"}
                    onButtonPress={handleContinue}
                    disabled={isCreate ? pin.length < 4 : confirmPin.length < 4}
                    loading={loading}
                />
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6F8',
    },
    flex: {
        flex: 1,
    },
    body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
    },
    inputContainer: {
        width: '100%',
        backgroundColor: '#F5F6F8',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#606060',
        paddingVertical: 19,
        paddingHorizontal: 16,
        marginBottom: 12,
        justifyContent: 'center',
    },
    input: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 18,
        color: '#111111',
        padding: 0,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 24,
    },
    infoText: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 14,
        lineHeight: 16 * 1.4,
        color: '#070707',
        letterSpacing: 0,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginTop: 10,
    },
    toggleLabel: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        lineHeight: 22,
        color: '#0230F9',
        letterSpacing: 0,
    },
});

export default PINScreen;
