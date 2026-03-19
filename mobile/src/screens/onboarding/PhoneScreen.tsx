import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
    StatusBar,
    Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import {
    CountryCode,
    Country,
    getAllCountries,
    FlagType,
} from 'react-native-country-picker-modal';
import { parsePhoneNumberFromString, CountryCode as PhoneCountryCode } from 'libphonenumber-js';
import uuid from 'react-native-uuid';
import DeviceInfo from 'react-native-device-info';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/rootReducer';
import { registerRequest, registerReset } from '../../store/slices/registerSlice';
import { saveSessionItem } from '../../hooks/api';

import HeroSection from '../../components/common/HeroSection';
import FooterSection from '../../components/common/FooterSection';
import CountryPickerModal from '../../components/common/CountryPickerModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    onBack?: () => void;
    onNext?: (phoneNumber: string) => void;
}

const PhoneScreen: React.FC<Props> = ({ onBack, onNext }) => {
    // ─── Local State ──────────────────────────────────────────────────────────

    const [phoneNumber, setPhoneNumber] = useState('');

    const [countryCode, setCountryCode] = useState<CountryCode>('AU');
    const [countryName, setCountryName] = useState('Australia');
    const [callingCode, setCallingCode] = useState('61');
    const [countryFlag, setCountryFlag] = useState<string>('');

    const [isPickerVisible, setIsPickerVisible] = useState(false);

    // Validation state
    const [isValid, setIsValid] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Debounce ref
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Redux ────────────────────────────────────────────────────────────────

    const dispatch = useDispatch();
    const { loading, error: registerError, response: registerResponse } = useSelector(
        (state: RootState) => state.register,
    );

    // ─── Initial Country Flag ─────────────────────────────────────────────────

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

    // ─── Phone Validation (Debounced) ─────────────────────────────────────────

    const validatePhone = useCallback(
        (rawNumber: string, callingCodeStr: string, countryIso: string) => {
            // Clear previous timer
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            // If field is empty, reset everything
            if (!rawNumber || rawNumber.trim().length === 0) {
                setIsValid(false);
                setValidationError(null);
                return;
            }

            debounceRef.current = setTimeout(() => {
                // Strip any non-digit characters the user may have typed
                const digitsOnly = rawNumber.replace(/\D/g, '');

                if (digitsOnly.length === 0) {
                    setIsValid(false);
                    setValidationError('Please enter a phone number.');
                    return;
                }

                // Minimum sanity check — most phone numbers are at least 4 digits
                if (digitsOnly.length < 4) {
                    setIsValid(false);
                    setValidationError('Phone number is too short.');
                    return;
                }

                // Maximum length guard — no phone number exceeds 15 digits (ITU-T E.164)
                if (digitsOnly.length > 15) {
                    setIsValid(false);
                    setValidationError('Phone number is too long.');
                    return;
                }

                // Build the full E.164 string and validate with libphonenumber-js
                const fullNumber = `+${callingCodeStr}${digitsOnly}`;
                const parsed = parsePhoneNumberFromString(
                    fullNumber,
                    countryIso as PhoneCountryCode,
                );

                if (!parsed) {
                    setIsValid(false);
                    setValidationError('Invalid phone number format.');
                    return;
                }

                if (!parsed.isValid()) {
                    // Provide a more specific message based on what went wrong
                    const nationalNumber = parsed.nationalNumber;
                    if (nationalNumber && nationalNumber.length < 4) {
                        setValidationError('Phone number is too short for the selected country.');
                    } else if (nationalNumber && nationalNumber.length > 12) {
                        setValidationError('Phone number is too long for the selected country.');
                    } else {
                        setValidationError('This phone number is not valid for the selected country.');
                    }
                    setIsValid(false);
                    return;
                }

                // Valid!
                setIsValid(true);
                setValidationError(null);
            }, DEBOUNCE_MS);
        },
        [],
    );

    // Re-validate when phone number or country changes
    useEffect(() => {
        validatePhone(phoneNumber, callingCode, countryCode);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [phoneNumber, callingCode, countryCode, validatePhone]);

    // ─── Handle Registration Success / Failure ────────────────────────────────

    useEffect(() => {
        if (registerResponse) {
            const fullNumber = `+${callingCode}${phoneNumber.replace(/\D/g, '')}`;
            onNext?.(fullNumber);
        }
    }, [registerResponse]);

    useEffect(() => {
        if (registerError) {
            Alert.alert(
                'Registration Failed',
                registerError,
                [{ text: 'OK', onPress: () => dispatch(registerReset()) }],
            );
        }
    }, [registerError]);

    // ─── Country Picker ───────────────────────────────────────────────────────

    const onSelect = (country: Country) => {
        setCountryCode(country.cca2);
        setCountryName(country.name as string);
        setCallingCode(country.callingCode[0]);
        if (country.flag) {
            setCountryFlag(country.flag);
        }
        setIsPickerVisible(false);
    };

    // ─── Handle Phone Input ───────────────────────────────────────────────────

    const handlePhoneChange = (text: string) => {
        // Allow only digits, spaces, dashes, and parentheses for UX
        const sanitized = text.replace(/[^0-9\s\-()]/g, '');
        setPhoneNumber(sanitized);
        if (!hasInteracted) setHasInteracted(true);
    };

    // ─── Handle Next Press ────────────────────────────────────────────────────

    const handleNext = async () => {
        if (!isValid || loading) return;

        try {
            // 1. Generate UUID v4
            const deviceUuid = uuid.v4() as string;

            // 2. Store UUID in keychain
            await saveSessionItem('device_uuid', deviceUuid);
            // console.log('[PhoneScreen] Stored device_uuid in keychain:', deviceUuid);

            // 3. Get device type
            const deviceType = DeviceInfo.getSystemName(); // 'iOS' or 'Android'

            // 4. Build full phone number (E.164)
            const digitsOnly = phoneNumber.replace(/\D/g, '');
            const fullPhoneNumber = `+${callingCode}${digitsOnly}`;

            // 5. Build payload
            const payload = {
                phone_number: fullPhoneNumber,
                device_id: deviceUuid,
                device_type: deviceType,
            };

            // console.log('[PhoneScreen] Registration payload:', JSON.stringify(payload));

            // 6. Dispatch to Redux saga
            dispatch(registerRequest(payload));
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
        }
    };

    // ─── Derived State ────────────────────────────────────────────────────────

    const isButtonDisabled = !isValid || loading;

    // ─── Render ───────────────────────────────────────────────────────────────

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
                    {/* Country Picker Trigger */}
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

                    {/* Phone Input Row */}
                    <View style={styles.inputRow}>
                        <TouchableOpacity
                            style={styles.codePicker}
                            onPress={() => setIsPickerVisible(true)}
                        >
                            <Text style={styles.triggerText}>+{callingCode}</Text>
                            <Ionicons name="chevron-down" size={16} color="#111" />
                        </TouchableOpacity>

                        <View style={[
                            styles.phoneInputContainer,
                            hasInteracted && validationError
                                ? styles.phoneInputError
                                : hasInteracted && isValid
                                    ? styles.phoneInputValid
                                    : null,
                        ]}>
                            <TextInput
                                style={styles.input}
                                value={phoneNumber}
                                onChangeText={handlePhoneChange}
                                placeholder="Phone Number"
                                placeholderTextColor="#AAAAAA"
                                keyboardType="phone-pad"
                                maxLength={20}
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Validation Error */}
                    {hasInteracted && validationError && phoneNumber.length > 0 && (
                        <View style={styles.errorRow}>
                            <Ionicons
                                name="information-circle-outline"
                                size={18}
                                color="#FF3B30"
                            />
                            <Text style={styles.errorText}>{validationError}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.footerWrapper}>
                    <Text style={styles.disclosureText}>
                        We use your number only to verify your identity.
                    </Text>

                    <FooterSection
                        buttonTitle={loading ? '' : 'Next'}
                        onButtonPress={handleNext}
                        disabled={isButtonDisabled}
                    />

                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                    )}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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

    phoneInputError: {
        borderColor: '#FF3B30',
        borderWidth: 1.5,
    },

    phoneInputValid: {
        borderColor: '#34C759',
        borderWidth: 1.5,
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
        position: 'relative',
    },

    disclosureText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },

    loadingOverlay: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
    },
});

export default PhoneScreen;