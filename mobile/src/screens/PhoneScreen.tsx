import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    Modal,
    ActivityIndicator,
    Image,
    StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
    CountryCode,
    Country,
    getAllCountries,
    Flag,
    FlagType,
} from 'react-native-country-picker-modal';

import HeroSection from '../components/HeroSection';
import FooterSection from '../components/FooterSection';

import CountryPickerModal from '../components/CountryPickerModal';

interface Props {
    onBack?: () => void;
    onNext?: (phoneNumber: string) => void;
}

const PhoneScreen: React.FC<Props> = ({ onBack, onNext }) => {

    const [phoneNumber, setPhoneNumber] = useState('');

    const [countryCode, setCountryCode] = useState<CountryCode>('AU');
    const [countryName, setCountryName] = useState('Australia');
    const [callingCode, setCallingCode] = useState('61');
    const [countryFlag, setCountryFlag] = useState<string>('');

    const [isPickerVisible, setIsPickerVisible] = useState(false);

    useEffect(() => {
        // Just set initial default flag for AU if needed, 
        // or let the modal fetch handle it on first open
        // For consistency with original code, we could fetch once for initial state
        const fetchInitial = async () => {
            try {
                const countries = await getAllCountries(FlagType.FLAT);
                const au = countries.find(c => c.cca2 === 'AU');
                if (au && au.flag) {
                    setCountryFlag(au.flag);
                }
            } catch (err) {}
        };
        fetchInitial();
    }, []);

    const onSelect = (country: Country) => {
        setCountryCode(country.cca2);
        setCountryName(country.name as string);
        setCallingCode(country.callingCode[0]);
        if (country.flag) {
            setCountryFlag(country.flag);
        }
        setIsPickerVisible(false);
    };

    const handleNext = () => {
        if (phoneNumber.length < 10) return;
        onNext?.(`+${callingCode}${phoneNumber}`);
    };

    return (

        <View style={styles.container}>

            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >

                <HeroSection
                    title="Your phone"
                    subtitle="Please confirm your country code and enter your phone number."
                    onBack={onBack}
                />

                <View style={styles.body}>

                    <TouchableOpacity
                        style={styles.pickerTrigger}
                        onPress={() => setIsPickerVisible(true)}
                    >

                        <View style={styles.triggerLeft}>

                            {countryFlag ? (
                                <Image
                                    source={{ uri: countryFlag }}
                                    style={{ width: 24, height: 24, borderRadius: 12 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={{ width: 24, height: 24 }} />
                            )}

                            <Text style={styles.triggerText}>{countryName}</Text>

                        </View>

                        <Ionicons name="chevron-down" size={20} color="#111" />

                    </TouchableOpacity>

                    <View style={styles.inputRow}>

                        <TouchableOpacity
                            style={styles.codePicker}
                            onPress={() => setIsPickerVisible(true)}
                        >

                            <Text style={styles.triggerText}>+{callingCode}</Text>

                            <Ionicons name="chevron-down" size={16} color="#111" />

                        </TouchableOpacity>

                        <View style={styles.phoneInputContainer}>

                            <TextInput
                                style={styles.input}
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                placeholder="Phone Number"
                                placeholderTextColor="#AAAAAA"
                                keyboardType="phone-pad"
                            />

                        </View>

                    </View>

                    {phoneNumber.length > 0 && phoneNumber.length < 10 && (

                        <View style={styles.errorRow}>

                            <Ionicons
                                name="information-circle-outline"
                                size={18}
                                color="#FF3B30"
                            />

                            <Text style={styles.errorText}>
                                Please enter a valid 10-digit number
                            </Text>

                        </View>

                    )}

                </View>

                <View style={styles.footerWrapper}>

                    <Text style={styles.disclosureText}>
                        We use your number only to verify your identity.
                    </Text>

                    <FooterSection
                        buttonTitle="Next"
                        onButtonPress={handleNext}
                    />

                </View>

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
        backgroundColor: '#F5F6F8',
    },

    body: {
        paddingTop: 30,
        paddingHorizontal: 20,
        gap: 20,
    },

    pickerTrigger: {
        height: 57,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },

    triggerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    triggerText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#111',
    },

    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },

    codePicker: {
        width: 85,
        height: 57,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },

    phoneInputContainer: {
        flex: 1,
        height: 57,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        paddingHorizontal: 16,
        justifyContent: 'center',
    },

    input: {
        fontSize: 16,
        color: '#111',
        padding: 0,
    },

    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    errorText: {
        fontSize: 14,
        color: '#FF3B30',
    },

    footerWrapper: {
        marginTop: 'auto',
    },

    disclosureText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },

});

export default PhoneScreen;