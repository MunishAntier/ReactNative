import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/common/ScreenHeader';
import CountryPickerModal from '../../components/common/CountryPickerModal';

interface Props {
    onBack: () => void;
    onDelete?: (phone: string) => void;
}

const DeleteAccountScreen: React.FC<Props> = ({ onBack, onDelete }) => {
    const [code, setCode] = useState('+61');
    const [phone, setPhone] = useState('');
    const [showPicker, setShowPicker] = useState(false);

    const handleCountrySelect = (country: any) => {
        setCode(`+${country.callingCode[0]}`);
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={BG} />
            <ScreenHeader title="Delete Account" onBack={onBack} backgroundColor={BG} />

            <View style={s.body}>
                {/* Country dropdown */}
                <TouchableOpacity style={s.dropdown} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                    <Text style={s.dropdownLabel}>Select your country</Text>
                    <Ionicons name="chevron-down" size={18} color="#8E8E93" />
                </TouchableOpacity>

                {/* Code + Phone input */}
                <View style={s.inputRow}>
                    <TouchableOpacity style={s.codeBox} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                        <Text style={s.codeText}>{code}</Text>
                        <Ionicons name="chevron-down" size={14} color="#8E8E93" />
                    </TouchableOpacity>
                    <View style={s.phoneBox}>
                        <TextInput
                            style={s.phoneInput}
                            placeholder="Phone number"
                            placeholderTextColor="#ABABAB"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>
            </View>

            {/* Delete button */}
            <View style={s.footer}>
                <TouchableOpacity
                    style={[s.deleteBtn, !phone && s.deleteBtnDisabled]}
                    activeOpacity={0.85}
                    onPress={() => onDelete?.(`${code}${phone}`)}
                    disabled={!phone}
                >
                    <Text style={s.deleteTxt}>Delete Account</Text>
                </TouchableOpacity>
            </View>

            <CountryPickerModal
                visible={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={handleCountrySelect}
            />
        </View>
    );
};

const BG = '#EBEBEC';

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },
    body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#C8C8C8',
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 10,
    },
    dropdownLabel: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#8E8E93',
    },
    inputRow: { flexDirection: 'row', gap: 10 },
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#C8C8C8',
        paddingHorizontal: 14,
        backgroundColor: '#FFFFFF',
    },
    codeText: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#070707',
    },
    phoneBox: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#C8C8C8',
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
    },
    phoneInput: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#070707',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    deleteBtn: {
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtnDisabled: { opacity: 0.5 },
    deleteTxt: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
});

export default DeleteAccountScreen;
