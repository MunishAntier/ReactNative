import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    CountryCode,
    Country,
    getAllCountries,
    FlagType,
} from 'react-native-country-picker-modal';
import ScreenHeader from '../../components/common/ScreenHeader';
import FooterSection from '../../components/common/FooterSection';
import CountryPickerModal from '../../components/common/CountryPickerModal';

import CommonInputScreen from '../../components/common/CommonInputScreen';

const C = {
    bg: '#EBEBEC',
    white: '#FFFFFF',
    blue: '#2A52E4',
    dark: '#070707',
    grey: '#6B6B6B',
    border: '#E3E3E3',
    placeholder: '#606060',
};

interface Props {
    mode: 'phone' | 'username';
    navigation?: any;
    onBack: () => void;
    onContinue: (value: string) => void;
}

const FindUserScreen: React.FC<Props> = ({ mode, onBack, onContinue }) => {
    const [inputValue, setInputValue] = useState('');

    // Phone specific state
    const [countryCode, setCountryCode] = useState<CountryCode>('AU');
    const [callingCode, setCallingCode] = useState('61');
    const [countryFlag, setCountryFlag] = useState<string>('');
    const [isPickerVisible, setIsPickerVisible] = useState(false);

    useEffect(() => {
        if (mode === 'phone') {
            const fetchInitial = async () => {
                try {
                    const countries = await getAllCountries(FlagType.FLAT);
                    const au = countries.find(c => c.cca2 === 'AU');
                    if (au && au.flag) {
                        setCountryFlag(au.flag);
                    }
                } catch (err) { }
            };
            fetchInitial();
        }
    }, [mode]);

    const onSelectCountry = (country: Country) => {
        setCountryCode(country.cca2);
        setCallingCode(country.callingCode[0]);
        if (country.flag) {
            setCountryFlag(country.flag);
        }
        setIsPickerVisible(false);
    };

    const handleContinue = () => {
        if (mode === 'phone') {
            onContinue(`+${callingCode}${inputValue}`);
        } else {
            onContinue(inputValue);
        }
    };

    return (
        <>
            <CommonInputScreen
                title={mode === 'phone' ? "Find by phone number" : "Find by username"}
                onBack={onBack}
                onContinue={handleContinue}
            >
                {mode === 'phone' ? (
                    <View style={styles.phoneInputRow}>
                        <TouchableOpacity
                            style={styles.countryPicker}
                            activeOpacity={0.7}
                            onPress={() => setIsPickerVisible(true)}
                        >
                            {countryFlag ? (
                                <Image
                                    source={{ uri: countryFlag }}
                                    style={styles.selectedFlag}
                                    resizeMode="cover"
                                />
                            ) : null}
                            <Text style={styles.countryCode}>+{callingCode}</Text>
                            <Ionicons name="chevron-down" size={16} color={C.grey} />
                        </TouchableOpacity>

                        <View style={styles.phoneInputWrapper}>
                            <TextInput
                                placeholder="Phone number"
                                placeholderTextColor={C.placeholder}
                                style={styles.input}
                                value={inputValue}
                                onChangeText={setInputValue}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                placeholder="Username"
                                placeholderTextColor={C.placeholder}
                                style={styles.input}
                                value={inputValue}
                                onChangeText={setInputValue}
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
                    </>
                )}
            </CommonInputScreen>

            {mode === 'phone' && (
                <CountryPickerModal
                    visible={isPickerVisible}
                    onClose={() => setIsPickerVisible(false)}
                    onSelect={onSelectCountry}
                    currentCountryCode={countryCode}
                />
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
        paddingTop: 32,
    },
    phoneInputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    countryPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        paddingHorizontal: 16,
        height: 57,
        gap: 10,
    },
    selectedFlag: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    countryCode: {
        fontSize: 16,
        color: C.dark,
        fontFamily: 'Gilroy-Medium',
    },
    inputWrapper: {
        backgroundColor: C.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        height: 57,
        paddingHorizontal: 16,
        justifyContent: 'center',
        marginBottom: 12,
    },
    phoneInputWrapper: {
        flex: 1,
        backgroundColor: C.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        height: 57,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    input: {
        fontSize: 16,
        color: '#070707',
        fontFamily: 'Gilroy-Medium',
        padding: 0,
        lineHeight: 16,
    },
    note: {
        maxWidth: 342,
        fontSize: 16,
        color: '#070707',
        fontFamily: 'Gilroy-Medium',
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
        color: C.blue,
        fontFamily: 'Gilroy-Medium',
        lineHeight: 16 * 1.4,
    },
});

export default FindUserScreen;
