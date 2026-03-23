import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    StatusBar,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import HeroSection from '../../components/common/HeroSection';
import FooterSection from '../../components/common/FooterSection';

const PIN_LENGTH = 6;

interface Props {
    mode: 'create' | 'confirm';
    onBack: () => void;
    onContinue: (pin: string) => void;
}

const ChangePinScreen: React.FC<Props> = ({ mode, onBack, onContinue }) => {
    const [pin, setPin] = useState('');
    const inputRef = useRef<TextInput>(null);

    const isCreate = mode === 'create';

    const handleChange = (text: string) => {
        const digits = text.replace(/[^0-9]/g, '');
        if (digits.length <= PIN_LENGTH) setPin(digits);
    };

    const handleContinue = () => {
        if (pin.length < PIN_LENGTH) {
            Alert.alert('Invalid PIN', `PIN must be at least ${PIN_LENGTH} digits`);
            return;
        }
        onContinue(pin);
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" />
            <KeyboardAvoidingView
                style={s.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <HeroSection
                    title={isCreate ? 'Create your PIN' : 'Confirm your PIN'}
                    subtitle={
                        isCreate
                            ? 'PINs can help your account and keep your info encrypted with Invest. Learn more...'
                            : 'Re-enter the PIN you just created'
                    }
                    onBack={onBack}
                />

                <View style={s.body}>
                    {/* Hidden input */}
                    <TextInput
                        ref={inputRef}
                        style={s.hiddenInput}
                        value={pin}
                        onChangeText={handleChange}
                        keyboardType="number-pad"
                        maxLength={PIN_LENGTH}
                        autoFocus
                        caretHidden
                    />

                    {/* Dot boxes */}
                    <View style={s.dotsRow}>
                        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                            <View
                                key={i}
                                style={[s.dotBox, i < pin.length && s.dotBoxFilled]}
                                onTouchEnd={() => inputRef.current?.focus()}
                            >
                                <View style={[s.dot, i < pin.length && s.dotFilled]} />
                            </View>
                        ))}
                    </View>

                    <Text style={s.hint}>PIN must be at least {PIN_LENGTH} digits</Text>
                </View>

                <FooterSection
                    buttonTitle="Continue"
                    onButtonPress={handleContinue}
                    disabled={pin.length < PIN_LENGTH}
                />
            </KeyboardAvoidingView>
        </View>
    );
};

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#EBEBEC' },
    flex: { flex: 1 },
    body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    hiddenInput: {
        position: 'absolute',
        opacity: 0,
        height: 0,
        width: 0,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    dotBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C0C0C0',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotBoxFilled: {
        borderColor: '#070707',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#C0C0C0',
    },
    dotFilled: {
        backgroundColor: '#070707',
    },
    hint: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 13,
        color: '#8E8E93',
    },
});

export default ChangePinScreen;
