import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import ScreenHeader from '../../components/common/ScreenHeader';
import { SETTINGS_BG } from '../../styles/settingsCommon';

const AVATAR_COLORS = ['#BDE8E0', '#F2E8CF', '#E2D1F9', '#D1E8F2', '#F9D1E2', '#D1F9E2'];

interface ContactItem {
    id: string;
    name: string;
    initial: string;
    color: string;
}

interface Props {
    onBack: () => void;
    onContinue?: (selectedIds: string[]) => void;
}

const ChooseViewersScreen: React.FC<Props> = ({ onBack, onContinue }) => {
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers],
                });
                if (data.length > 0) {
                    const formatted = data
                        .filter((c) => c.name)
                        .map((c, i) => ({
                            id: c.id || String(i),
                            name: c.name!,
                            initial: c.name!.charAt(0).toUpperCase(),
                            color: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        }));
                    setContacts(formatted);
                }
            }
        } catch (e) {
            console.error('Error fetching contacts:', e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(
        () => contacts.filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase())),
        [contacts, searchText],
    );

    const toggle = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const selectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map((c) => c.id));
        }
    };

    const renderItem = ({ item }: { item: ContactItem }) => {
        const selected = selectedIds.includes(item.id);
        return (
            <TouchableOpacity style={s.contactRow} activeOpacity={0.6} onPress={() => toggle(item.id)}>
                <View style={[s.avatar, { backgroundColor: item.color }]}>
                    <Text style={s.avatarText}>{item.initial}</Text>
                </View>
                <Text style={s.contactName}>{item.name}</Text>
                <View style={[s.checkbox, selected && s.checkboxSelected]}>
                    {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="Choose viewers" onBack={onBack} backgroundColor={SETTINGS_BG} />

            {/* Search bar */}
            <View style={s.searchWrap}>
                <View style={s.searchBox}>
                    <Ionicons name="search-outline" size={18} color="#8E8E93" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Name, Username or number"
                        placeholderTextColor="#8E8E93"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    <Ionicons name="grid-outline" size={18} color="#070707" />
                </View>
            </View>

            {/* Contacts header */}
            <View style={s.listHeader}>
                <Text style={s.sectionTitle}>Contacts</Text>
                <TouchableOpacity onPress={selectAll} activeOpacity={0.6}>
                    <Text style={s.selectAll}>Select all</Text>
                </TouchableOpacity>
            </View>

            {/* Contact list */}
            {loading ? (
                <ActivityIndicator size="large" color="#0230F9" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Continue button */}
            <View style={s.footer}>
                <TouchableOpacity
                    style={s.btn}
                    activeOpacity={0.85}
                    onPress={() => onContinue?.(selectedIds)}
                >
                    <Text style={s.btnTxt}>Continue</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#FFFFFF' },
    searchWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: SETTINGS_BG },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#070707',
        marginLeft: 10,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 18,
        color: '#0230F9',
    },
    selectAll: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#070707',
    },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E3E3E3',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    avatarText: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#070707',
    },
    contactName: {
        flex: 1,
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#070707',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#C0C0C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#0230F9',
        borderColor: '#0230F9',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: 34,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E3E3E3',
    },
    btn: {
        backgroundColor: '#070707',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnTxt: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
});

export default ChooseViewersScreen;
