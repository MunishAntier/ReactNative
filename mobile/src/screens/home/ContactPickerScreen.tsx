import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    StatusBar,
    SectionList,
    Share,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useSelector, useDispatch } from 'react-redux';
import ScreenHeader from '../../components/common/ScreenHeader';
import FooterSection from '../../components/common/FooterSection';
import { RootState } from '../../store/rootReducer';
import { syncContactsRequest } from '../../store/slices/contactsSlice';

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
    { id: 'group', label: 'New Group', icon: 'people-outline' },
    { id: 'username', label: 'Find by username', icon: 'person-outline' },
    { id: 'phone', label: 'Find by phone number', icon: 'phone-portrait-outline' },
];

interface FormattedContact {
    id: string;
    name: string;
    initial: string;
    color: string;
    isAppUser: boolean;
    phoneNumber?: string;
}

const AVATAR_COLORS = ['#BDE8E0', '#F2E8CF', '#E2D1F9'];
const GET_COLOR = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];
const GET_TEXT_COLOR = (color: string) => {
    if (color === '#BDE8E0') return '#2DAA94';
    if (color === '#F2E8CF') return '#D4A017';
    return '#9B51E0';
};

interface Props {
    title: string;
    multiSelect?: boolean;
    showActions?: boolean;
    navigation?: any;
    onBack: () => void;
    onContinue?: (selectedIds: string[]) => void;
    onNewGroup?: () => void;
}

const ContactPickerScreen: React.FC<Props> = ({
    title,
    multiSelect = false,
    showActions = false,
    navigation,
    onBack,
    onContinue,
    onNewGroup,
}) => {
    const dispatch = useDispatch();
    const { appUsers, inviteUsers, loading, error } = useSelector((state: RootState) => state.contacts);

    const [searchText, setSearchText] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        dispatch(syncContactsRequest());
    }, [dispatch]);

    const formatContacts = (contacts: Contacts.Contact[], isAppUser: boolean) => {
        return contacts.map((c: any, index) => ({
            id: c.id || `contact-${index}`,
            name: c.name || 'Unknown',
            initial: c.name ? c.name.charAt(0).toUpperCase() : '?',
            color: GET_COLOR(index),
            isAppUser,
            phoneNumber: c.phoneNumbers?.[0]?.number,
        }));
    };

    const formattedSections = useMemo(() => {
        const appData = formatContacts(appUsers, true).filter(c =>
            c.name.toLowerCase().includes(searchText.toLowerCase())
        );
        const inviteData = formatContacts(inviteUsers, false).filter(c =>
            c.name.toLowerCase().includes(searchText.toLowerCase())
        );

        const sections = [];
        if (appData.length > 0) {
            sections.push({ title: 'On App', data: appData });
        }
        if (inviteData.length > 0) {
            sections.push({ title: 'Invite to App', data: inviteData });
        }
        return sections;
    }, [appUsers, inviteUsers, searchText]);

    const totalContacts = appUsers.length + inviteUsers.length;

    const toggleSelection = (id: string) => {
        if (!multiSelect) return;
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleInvite = async (contact: FormattedContact) => {
        try {
            await Share.share({
                message: `Hey ${contact.name}, join me on this secure messaging app! 🚀`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleActionPress = (id: string) => {
        if (id === 'group') onNewGroup?.();
        if (id === 'username') navigation?.navigate('FindByUsername');
        if (id === 'phone') navigation?.navigate('FindByPhoneNumber');
    };

    const renderActionItem = (item: typeof ACTION_ITEMS[0]) => (
        <TouchableOpacity
            key={item.id}
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => handleActionPress(item.id)}
        >
            <View style={styles.actionIconBox}>
                <Ionicons name={item.icon as any} size={22} color={C.dark} />
            </View>
            <Text style={styles.actionLabel}>{item.label}</Text>
            <Ionicons name="arrow-forward-outline" size={20} color={C.grey} />
        </TouchableOpacity>
    );

    const renderContactItem = ({ item }: { item: FormattedContact }) => {
        const isSelected = selectedIds.includes(item.id);
        return (
            <TouchableOpacity
                style={styles.contactRow}
                activeOpacity={0.7}
                onPress={() => toggleSelection(item.id)}
            >
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                    <Text style={[styles.avatarText, { color: GET_TEXT_COLOR(item.color) }]}>
                        {item.initial}
                    </Text>
                </View>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.phoneNumber && <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>}
                </View>
                {!item.isAppUser && (
                    <TouchableOpacity
                        style={styles.inviteButton}
                        onPress={() => handleInvite(item)}
                    >
                        <Text style={styles.inviteText}>Invite</Text>
                    </TouchableOpacity>
                )}
                {multiSelect && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={C.white} />}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section: { title } }: any) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <TouchableOpacity
                onPress={() => dispatch(syncContactsRequest())}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={C.blue} />
                ) : (
                    <Ionicons name="refresh-outline" size={20} color={C.blue} />
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <ScreenHeader
                title={`${title} (${totalContacts})`}
                onBack={onBack}
                rightComponent={
                    !multiSelect ? (
                        <TouchableOpacity style={styles.moreBtn} activeOpacity={0.7}>
                            <View style={styles.moreIconBox}>
                                <Ionicons name="ellipsis-vertical" size={20} color={C.dark} />
                            </View>
                        </TouchableOpacity>
                    ) : null
                }
            />

            <View style={styles.content}>
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
                {showActions && !searchText && (
                    <View style={styles.actionsList}>
                        {ACTION_ITEMS.map(item => {
                            if (item.id === 'group' && !onNewGroup) return null;
                            return renderActionItem(item);
                        })}
                    </View>
                )}

                {/* Error Message */}
                {error && (
                    <View style={styles.errorWrapper}>
                        <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Contacts Section */}
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={C.blue} />
                        <Text style={styles.loadingText}>Syncing contacts...</Text>
                    </View>
                ) : formattedSections.length > 0 ? (
                    <SectionList
                        sections={formattedSections}
                        renderItem={renderContactItem}
                        renderSectionHeader={renderSectionHeader}
                        keyExtractor={item => item.id}
                        stickySectionHeadersEnabled={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContent}
                    />
                ) : (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>No contacts found</Text>
                    </View>
                )}
            </View>

            {multiSelect && (
                <FooterSection
                    buttonTitle="Continue"
                    onButtonPress={() => onContinue?.(selectedIds)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    moreBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    moreIconBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingBottom: 100,
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        marginVertical: 20,
        borderWidth: 1,
        borderColor: C.border,
    },
    errorWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFE5E5',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
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
        color: C.dark,
        fontFamily: 'Gilroy-Regular',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 24,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        color: C.blue,
        fontFamily: 'ClashDisplay-Regular',
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
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        color: C.dark,
        fontFamily: 'Gilroy-Regular',
    },
    phoneNumber: {
        fontSize: 12,
        color: C.grey,
        marginTop: 2,
    },
    inviteButton: {
        backgroundColor: C.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.blue,
    },
    inviteText: {
        color: C.blue,
        fontSize: 14,
        fontWeight: '600',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D0D0D0',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    checkboxSelected: {
        backgroundColor: C.blue,
        borderColor: C.blue,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    loadingText: {
        fontSize: 14,
        color: C.grey,
        marginTop: 12,
    },
    emptyText: {
        fontSize: 14,
        color: C.grey,
    },
});

export default ContactPickerScreen;
