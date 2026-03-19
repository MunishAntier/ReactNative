import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    Text,
} from 'react-native';
import CommonInputScreen from '../../Components/common/CommonInputScreen';

interface Props {
    onBack: () => void;
    onContinue: (firstName: string, lastName: string) => void;
    initialFirstName?: string;
    initialLastName?: string;
}

const NicknameScreen: React.FC<Props> = ({ 
    onBack, 
    onContinue, 
    initialFirstName = '', 
    initialLastName = '' 
}) => {
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);

    const handleContinue = () => {
        onContinue(firstName, lastName);
    };

    return (
        <CommonInputScreen
            title="Nickname"
            onBack={onBack}
            onContinue={handleContinue}
        >
        <View style={styles.inputWrapper}>
            {!firstName && (
                <View style={styles.placeholderOverlay} pointerEvents="none">
                    <Text style={styles.placeholderText}>First Name</Text>
                    <Text style={styles.requiredAsterisk}>*</Text>
                </View>
            )}
            <TextInput
                placeholder=""
                placeholderTextColor="#606060"
                style={styles.textInput}
                value={firstName}
                onChangeText={setFirstName}
                autoFocus
            />
        </View>

            <View style={styles.inputWrapper}>
                <TextInput
                    placeholder="Last Name (Optional)"
                    placeholderTextColor="#606060"
                    style={styles.textInput}
                    value={lastName}
                    onChangeText={setLastName}
                />
            </View>
        </CommonInputScreen>
    );
};

const styles = StyleSheet.create({
    inputWrapper: {
        backgroundColor: '#EBEBEC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        height: 57,
        paddingHorizontal: 16,
        justifyContent: 'center',
        marginBottom: 12,
    },
    placeholderOverlay: {
        position: 'absolute',
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 1,
    },
    placeholderText: {
        fontSize: 16,
        color: '#606060',
        fontFamily: 'Gilroy-Medium',
    },
    requiredAsterisk: {
        color: 'red',
        fontSize: 16,
        marginLeft: 2,
    },
    textInput: {
        fontSize: 16,
        color: '#070707',
        fontFamily: 'Gilroy-Medium',
        padding: 0,
        height: '100%',
        zIndex: 2,
    },
});

export default NicknameScreen;
