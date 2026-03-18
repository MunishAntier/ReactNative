import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Switch,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HeroSection from '../components/common/HeroSection';
import FooterSection from '../components/common/FooterSection';
import CustomToggle from '../components/common/CustomToggle';

interface Props {
    onBack?: () => void;
    onContinue?: (pin: string, isAlphabet: boolean) => void;
}

const CreatePINScreen: React.FC<Props> = ({ onBack, onContinue }) => {
    const [pin, setPin] = useState('');
    const [isAlphabet, setIsAlphabet] = useState(false);

    const handleContinue = () => {
        if (pin.length < 4) return;
        onContinue?.(pin, isAlphabet);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <HeroSection
                    title="Create PIN"
                    subtitle="PINs can help you restore your account and keep your info encrypted with us"
                    onBack={onBack}
                />

                <View style={styles.body}>
                    {/* PIN Input field */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={pin}
                            onChangeText={setPin}
                            placeholder="····"
                            placeholderTextColor="#AAAAAA"
                            secureTextEntry={true}
                            keyboardType={isAlphabet ? 'default' : 'number-pad'}
                            autoFocus
                        />
                    </View>

                    {/* Info Message */}
                    <View style={styles.infoRow}>
                        <Ionicons name="information-circle-outline" size={18} color="#111111" />
                        <Text style={styles.infoText}>PIN Must be at least 4 digits</Text>
                    </View>

                    {/* Toggle */}
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Create Alphabet PIN</Text>
                        <CustomToggle
                            value={isAlphabet}
                            onValueChange={setIsAlphabet}
                        />
                    </View>
                </View>

                <FooterSection
                    buttonTitle="Continue"
                    onButtonPress={handleContinue}
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
        fontFamily: 'ClashDisplay-Medium',
        fontSize: 18,
        color: '#111111',
        padding: 0,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 205,
        height: 22,
        gap: 6,
        marginBottom: 24,
    },
    infoText: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        lineHeight: 16 * 1.4,
        color: '#070707',
        letterSpacing: 0,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 204,
        height: 22,
        borderRadius: 88,
        gap: 20,
    },
    toggleLabel: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        lineHeight: 16 * 1.4,
        color: '#0230F9',
        width: 152,
        height: 22,
        letterSpacing: 0,
    },
});

export default CreatePINScreen;
