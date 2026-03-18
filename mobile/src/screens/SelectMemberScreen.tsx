import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Platform,
    StatusBar,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/common/ScreenHeader';
import FooterSection from '../components/common/FooterSection';
import * as Contacts from 'expo-contacts';

// -- Constants --
const C = {
    bg: '#EBEBEC',
    white: '#FFFFFF',
    blue: '#2A52E4',
    dark: '#0E0E0E',
    searchPlaceholder: '#ABABAB',
    border: '#E3E3E3',
    grey: '#6B6B6B',
};

const ACTION_ITEMS = [
    { id: 'username', label: 'Find by username', icon: 'person-outline' },
    { id: 'phone', label: 'Find by phone number', icon: 'phone-portrait-outline' },
];

interface ContactItem {
    id: string;
    name: string;
    initial: string;
    color: string;
}

const AVATAR_COLORS = ['#BDE8E0', '#F2E8CF', '#E2D1F9'];

interface Props {
    navigation?: any;
}

const SelectMemberScreen: React.FC<Props> = ({ navigation }) => {
    const [searchText, setSearchText] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
                });

                if (data.length > 0) {
                    const formatted = data.map((contact: Contacts.ExistingContact, index: number) => ({
                        id: contact.id || String(index),
                        name: contact.name,
                        initial: contact.name ? contact.name.charAt(0).toUpperCase() : '?',
                        color: AVATAR_COLORS[index % AVATAR_COLORS.length],
                    }));
                    setContacts(formatted);
                }
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredContacts = contacts.filter(c =>
        (c.name || '').toLowerCase().includes(searchText.toLowerCase())
    );

    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const renderActionItem = (item: typeof ACTION_ITEMS[0]) => (
        <TouchableOpacity
            key={item.id}
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => {
                if (item.id === 'username') navigation?.navigate('FindByUsername');
                if (item.id === 'phone') navigation?.navigate('FindByPhoneNumber');
            }}
        >
            <View style={styles.actionIconBox}>
                <Ionicons name={item.icon as any} size={22} color={C.dark} />
            </View>
            <Text style={styles.actionLabel}>{item.label}</Text>
            <Ionicons name="arrow-forward-outline" size={20} color={C.grey} />
        </TouchableOpacity>
    );

    const renderContactItem = ({ item }: { item: ContactItem }) => {
        const isSelected = selectedIds.includes(item.id);
        return (
            <TouchableOpacity
                style={styles.contactRow}
                activeOpacity={0.7}
                onPress={() => toggleSelection(item.id)}
            >
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                    <Text style={[styles.avatarText, { color: item.color === '#BDE8E0' ? '#2DAA94' : item.color === '#F2E8CF' ? '#D4A017' : '#9B51E0' }]}>{item.initial}</Text>
                </View>
                <Text style={styles.contactName}>{item.name}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={C.white} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <ScreenHeader
                title="Select Members"
                onBack={() => navigation?.goBack()}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Search Bar */}
                <View style={styles.searchWrapper}>
                    <Ionicons name="search-outline" size={18} color="#0230F9" />
                    <TextInput
                        placeholder="Search secure.."
                        placeholderTextColor={C.searchPlaceholder}
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    <TouchableOpacity>
                        <Ionicons name="keypad-outline" size={20} color={C.dark} />
                    </TouchableOpacity>
                </View>

                {/* Actions */}
                <View style={styles.actionsList}>
                    {ACTION_ITEMS.map(renderActionItem)}
                </View>

                {/* Contacts Section */}
                <View style={styles.contactsSection}>
                    <Text style={styles.sectionTitle}>My Contacts ({contacts.length})</Text>
                    {loading ? (
                        <Text style={styles.loadingText}>Loading contacts...</Text>
                    ) : filteredContacts.length > 0 ? (
                        <FlatList
                            data={filteredContacts}
                            renderItem={renderContactItem}
                            keyExtractor={item => item.id}
                            scrollEnabled={false}
                        />
                    ) : (
                        <Text style={styles.emptyText}>No contacts found</Text>
                    )}
                </View>
            </ScrollView>

            {/* Footer */}
            <FooterSection
                buttonTitle="Continue"
                onButtonPress={() => console.log('Continue with:', selectedIds)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100, // Space for footer
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: C.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: C.dark,
    },
    actionsList: {
        backgroundColor: 'transparent',
        marginBottom: 20,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#D0D0D0',
    },
    actionIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    actionLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: C.dark,
        fontFamily: 'Gilroy-Medium',
    },
    contactsSection: {
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: C.blue,
        marginBottom: 16,
        fontFamily: 'Clash Display',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
    },
    contactName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: C.dark,
        fontFamily: 'Gilroy-Medium',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D0D0D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: C.blue,
        borderColor: C.blue,
    },
    loadingText: {
        fontSize: 14,
        color: C.grey,
        textAlign: 'center',
        marginTop: 20,
    },
    emptyText: {
        fontSize: 14,
        color: C.grey,
        textAlign: 'center',
        marginTop: 20,
    },
});

export default SelectMemberScreen;
