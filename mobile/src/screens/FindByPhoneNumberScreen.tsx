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
import ScreenHeader from '../components/common/ScreenHeader';
import FooterSection from '../components/common/FooterSection';

import CountryPickerModal from '../components/common/CountryPickerModal';

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
    navigation?: any;
    onBack: () => void;
    onContinue: (phone: string) => void;
}

const FindByPhoneNumberScreen: React.FC<Props> = ({ onBack, onContinue }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState<CountryCode>('AU');
    const [callingCode, setCallingCode] = useState('61');
    const [countryFlag, setCountryFlag] = useState<string>('');
    const [isPickerVisible, setIsPickerVisible] = useState(false);

    useEffect(() => {
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
    }, []);

    const onSelect = (country: Country) => {
        setCountryCode(country.cca2);
        setCallingCode(country.callingCode[0]);
        if (country.flag) {
            setCountryFlag(country.flag);
        }
        setIsPickerVisible(false);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.headerWrapper}>
                    <ScreenHeader
                        title="Find by phone number"
                        onBack={onBack}
                    />
                </View>

                <View style={styles.body}>
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

                        <View style={styles.inputWrapper}>
                            <TextInput
                                placeholder="Phone number"
                                placeholderTextColor={C.placeholder}
                                style={styles.input}
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>
                </View>

                <FooterSection
                    buttonTitle="Continue"
                    onButtonPress={() => onContinue(`+${callingCode}${phoneNumber}`)}
                />
            </KeyboardAvoidingView>

            <CountryPickerModal
                visible={isPickerVisible}
                onClose={() => setIsPickerVisible(false)}
                onSelect={onSelect}
                currentCountryCode={countryCode}
            />
        </View>
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
        fontWeight: '400',
        padding: 0,
        lineHeight: 16,
    },
});

export default FindByPhoneNumberScreen;
