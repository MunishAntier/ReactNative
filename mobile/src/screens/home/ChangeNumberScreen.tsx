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
import FooterSection from '../../components/common/FooterSection';
import CountryPickerModal from '../../components/common/CountryPickerModal';

interface Props {
    onBack: () => void;
    onContinue: (oldNumber: string, newNumber: string) => void;
}

type Field = 'old' | 'new';

const ChangeNumberScreen: React.FC<Props> = ({ onBack, onContinue }) => {
    const [oldCode, setOldCode] = useState('+61');
    const [oldNumber, setOldNumber] = useState('');
    const [newCode, setNewCode] = useState('+61');
    const [newNumber, setNewNumber] = useState('');
    const [pickerField, setPickerField] = useState<Field | null>(null);

    const openPicker = (field: Field) => setPickerField(field);

    const handleCountrySelect = (country: any) => {
        const code = `+${country.callingCode[0]}`;
        if (pickerField === 'old') setOldCode(code);
        else setNewCode(code);
    };

    const canContinue = oldNumber.length >= 4 && newNumber.length >= 4;

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={BG} />
            <ScreenHeader title="Change Number" onBack={onBack} backgroundColor={BG} />

            <View style={s.body}>
                {/* Old number */}
                <PhoneField
                    label="Your old number"
                    code={oldCode}
                    number={oldNumber}
                    onCodePress={() => openPicker('old')}
                    onChangeNumber={setOldNumber}
                />

                {/* New number */}
                <PhoneField
                    label="Your new number"
                    code={newCode}
                    number={newNumber}
                    onCodePress={() => openPicker('new')}
                    onChangeNumber={setNewNumber}
                />
            </View>

            <FooterSection
                buttonTitle="Continue"
                onButtonPress={() => onContinue(`${oldCode}${oldNumber}`, `${newCode}${newNumber}`)}
                disabled={!canContinue}
            />

            <CountryPickerModal
                visible={pickerField !== null}
                onClose={() => setPickerField(null)}
                onSelect={handleCountrySelect}
            />
        </View>
    );
};

/* ── Phone Field ───────────────────────────────────────────────────────────── */
interface PhoneFieldProps {
    label: string;
    code: string;
    number: string;
    onCodePress: () => void;
    onChangeNumber: (val: string) => void;
}

const PhoneField: React.FC<PhoneFieldProps> = ({
    label,
    code,
    number,
    onCodePress,
    onChangeNumber,
}) => (
    <View style={s.fieldGroup}>
        {/* Country dropdown */}
        <TouchableOpacity style={s.dropdown} onPress={onCodePress} activeOpacity={0.7}>
            <Text style={s.dropdownLabel}>{label}</Text>
            <Ionicons name="chevron-down" size={18} color="#8E8E93" />
        </TouchableOpacity>

        {/* Code + Phone input */}
        <View style={s.inputRow}>
            <TouchableOpacity style={s.codeBox} onPress={onCodePress} activeOpacity={0.7}>
                <Text style={s.codeText}>{code}</Text>
                <Ionicons name="chevron-down" size={14} color="#8E8E93" />
            </TouchableOpacity>
            <View style={s.phoneBox}>
                <TextInput
                    style={s.phoneInput}
                    placeholder="Phone number"
                    placeholderTextColor="#ABABAB"
                    value={number}
                    onChangeText={onChangeNumber}
                    keyboardType="phone-pad"
                />
            </View>
        </View>
    </View>
);

/* ── Styles ────────────────────────────────────────────────────────────────── */
const BG = '#EBEBEC';

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },
    body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    fieldGroup: {
        marginBottom: 16,
    },
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
    inputRow: {
        flexDirection: 'row',
        gap: 10,
    },
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
        padding: 0,
    },
});

export default ChangeNumberScreen;
