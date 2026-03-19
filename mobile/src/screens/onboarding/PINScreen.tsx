import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import HeroSection from '../../Components/common/HeroSection';
import FooterSection from '../../Components/common/FooterSection';
import CustomToggle from '../../Components/common/CustomToggle';

interface Props {
    onBack?: () => void;
    onComplete?: (pin: string, isAlphabet: boolean) => void;
}

type PINStep = 'create' | 'confirm';

const PINScreen: React.FC<Props> = ({ onBack, onComplete }) => {
    const [step, setStep] = useState<PINStep>('create');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isAlphabet, setIsAlphabet] = useState(false);

    const handleContinue = () => {
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
            onComplete?.(pin, isAlphabet);
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

                    {/* Toggle - only show in create step or keep it visible? 
                        Usually, it's chosen in the first step. */}
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
        width: 342,
        height: 57,
        backgroundColor: '#F5F6F8',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#606060',
        paddingTop: 19,
        paddingBottom: 19,
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
        width: 300, // Increased to fit text
        height: 22,
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
        width: 204, // From Figma
        height: 22, // From Figma
        gap: 20, // From Figma
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
