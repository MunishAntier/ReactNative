import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Image,
    FlatList,
    StatusBar,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    Country,
    getAllCountries,
    FlagType,
} from 'react-native-country-picker-modal';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: Country) => void;
    currentCountryCode?: string;
}

const CountryPickerModal: React.FC<Props> = ({ 
    visible, 
    onClose, 
    onSelect,
    currentCountryCode 
}) => {
    const [allCountries, setAllCountries] = useState<Country[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const countries = await getAllCountries(FlagType.FLAT);
                const sorted = countries.sort((a, b) =>
                    (a.name as string).localeCompare(b.name as string)
                );
                setAllCountries(sorted);
            } catch (error) {
                console.log('Country fetch error', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (visible) {
            fetchCountries();
        }
    }, [visible]);

    const filteredCountries = useMemo(() => {
        if (!searchQuery) return allCountries;
        const query = searchQuery.toLowerCase();
        return allCountries.filter((c) => {
            const name = (c.name as string).toLowerCase();
            const code = c.callingCode[0]?.toLowerCase() ?? '';
            return name.includes(query) || code.includes(query);
        });
    }, [allCountries, searchQuery]);

    const handleSelect = (country: Country) => {
        onSelect(country);
        onClose();
        setSearchQuery('');
    };

    const renderCountryItem = ({ item }: { item: Country }) => (
        <TouchableOpacity
            style={styles.countryRow}
            onPress={() => handleSelect(item)}
        >
            <View style={styles.countryInfo}>
                <Image
                    source={{ uri: item.flag as string }}
                    style={styles.flagImage}
                    resizeMode="cover"
                />
                <Text style={styles.countryNameText}>
                    {item.name as string} (+{item.callingCode[0]})
                </Text>
            </View>
            {currentCountryCode === item.cca2 && (
                <Ionicons name="checkmark" size={22} color="#34C759" />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <StatusBar barStyle="light-content" />
                <View style={styles.headerContainer}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                onClose();
                                setSearchQuery('');
                            }}
                        >
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Your Country</Text>
                    </View>

                    <View style={styles.searchBarContainer}>
                        <Ionicons name="search-outline" size={20} color="#AAAAAA" />
                        <TextInput
                            style={styles.searchBarInput}
                            placeholder="Search by name or number"
                            placeholderTextColor="#AAAAAA"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                <View style={styles.listContainer}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#0230F9" />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredCountries}
                            keyExtractor={(item) => item.cca2}
                            renderItem={renderCountryItem}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            initialNumToRender={20}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    headerContainer: {
        backgroundColor: '#070707',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 24,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginBottom: 30,
    },
    headerTitle: {
        fontSize: 20,
        color: '#FFF',
        fontFamily: 'Gilroy-Medium',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        height: 57,
        paddingHorizontal: 16,
        gap: 12,
    },
    searchBarInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Gilroy-Regular',
    },
    listContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 90,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    countryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    flagImage: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    countryNameText: {
        fontSize: 22,
        color: '#111',
        fontFamily: 'Gilroy-Medium',
    },
});

export default CountryPickerModal;
