import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/common/ScreenHeader';
import FooterSection from '../components/common/FooterSection';

const C = {
    bg: '#EBEBEC',
    white: '#FFFFFF',
    blue: '#2A52E4',
    dark: '#0E0E0E',
    grey: '#6B6B6B',
    border: '#E3E3E3',
    placeholder: '#606060',
    lightBlue: '#EEF1FD',
};

interface Props {
    navigation?: any;
    onBack: () => void;
    onContinue: (username: string) => void;
}

const FindByUsernameScreen: React.FC<Props> = ({ onBack, onContinue }) => {
    const [username, setUsername] = useState('');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.headerWrapper}>
                    <ScreenHeader
                        title="Find by username"
                        onBack={onBack}
                    />
                </View>

                <View style={styles.body}>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            placeholder="Username"
                            placeholderTextColor={C.placeholder}
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <Text style={styles.note}>
                        Enter a username followed by a dot and its set of numbers
                    </Text>

                    <TouchableOpacity style={styles.scanBtn} activeOpacity={0.7}>
                        <Ionicons name="qr-code-outline" size={20} color={C.blue} />
                        <Text style={styles.scanText}>Scan QR Code</Text>
                    </TouchableOpacity>
                </View>

                <FooterSection
                    buttonTitle="Continue"
                    onButtonPress={() => onContinue(username)}
                />
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Header area
    },
    flex: {
        flex: 1,
    },
    headerWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: '#E3E3E3',
    },
    body: {
        flex: 1,
        backgroundColor: C.bg,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    inputWrapper: {
        backgroundColor: C.bg, // Keep it slightly gray to match design intent if needed, or switch to white. Figma looks like #F9F9F9 or similar. Let's try C.bg first.
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E3E3E3',
        height: 57,
        paddingHorizontal: 16,
        justifyContent: 'center',
        marginBottom: 12,
    },
    input: {
        fontSize: 16,
        color: C.dark,
        fontFamily: 'Gilroy-Regular',
        fontWeight: '400',
        padding: 0,
    },
    note: {
        maxWidth: 342,
        fontSize: 16,
        color: '#070707',
        fontFamily: 'Gilroy-Medium',
        fontWeight: '400',
        lineHeight: 16 * 1.4,
        marginBottom: 20,
    },
    scanBtn: {
        width: 179,
        height: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E6EAFE',
        borderRadius: 88,
        borderWidth: 1,
        borderColor: '#B1BFFD',
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 10,
        alignSelf: 'flex-start',
    },
    scanText: {
        fontSize: 16,
        fontWeight: '400',
        color: C.blue,
        fontFamily: 'Gilroy-Medium',
        lineHeight: 16 * 1.4,
    },
});

export default FindByUsernameScreen;
