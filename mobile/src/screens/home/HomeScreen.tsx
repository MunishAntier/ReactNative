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
    Image,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';
import BottomNavBar, { TabKey } from '../../Components/common/BottomNavBar';
import GetStartedSection from '../../Components/common/GetStartedSection';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATAR = require('../../Assets/images/avatar.png');
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const MOCK_CHATS = [
    { id: '1', name: 'Elena Rodriguez', msg: 'The final Q3 reports...', time: '10:42 AM', unread: 2, isGroup: false },
    { id: '2', name: 'Michael Chang', msg: 'Let\'s review the...', time: 'Yesterday', unread: 0, isGroup: false },
    { id: '3', name: 'Sarah Jenkins', msg: 'Sounds good, I\'ll send...', time: 'Mon', unread: 0, isGroup: false },
    { id: '4', name: 'Internal Talks', msg: 'Michael accepted the invitation...', time: 'Sun', unread: 0, isGroup: true },
    { id: '5', name: 'Discussion Group', msg: 'You accepted the invitation...', time: 'Sun', unread: 0, isGroup: true },
];

const C = {
    bg: '#EBEBEC',
    white: '#FFFFFF',
    blue: '#2A52E4',
    bluePale: '#EEF1FD',
    blueBorder: '#C5CEFA',
    dark: '#0E0E0E',
    subtitleBlue: '#2A52E4',
    searchBg: '#FFFFFF',
    searchBorder: '#E3E3E3',
    searchPlaceholder: '#ABABAB',
    skipGrey: '#6B6B6B',
};

// ─── Three Dots Component ────────────────────────────────────────────────────
const ThreeDots: React.FC = () => (
    <View style={dotsStyle.wrap}>
        {[0, 1, 2].map(i => (
            <View key={i} style={dotsStyle.dot} />
        ))}
    </View>
);
const dotsStyle = StyleSheet.create({
    wrap: { gap: 3, alignItems: 'center', justifyContent: 'center', height: 20 },
    dot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#0E0E0E' },
});

// ─── Filter Bar Component ────────────────────────────────────────────────────
interface FilterBarProps {
    active: string;
    onSelect: (val: string) => void;
}
const FILTERS = ['All', 'Chats', 'Group', 'My Folders'];
const FilterBar: React.FC<FilterBarProps> = ({ active, onSelect }) => (
    <View style={filterStyles.container}>
        <View style={filterStyles.inner}>
            {FILTERS.map(f => {
                const isActive = f === active;
                return (
                    <TouchableOpacity
                        key={f}
                        onPress={() => onSelect(f)}
                        style={[filterStyles.item, isActive && filterStyles.itemActive]}
                    >
                        <Text style={[filterStyles.text, isActive && filterStyles.textActive]}>{f}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
);
const filterStyles = StyleSheet.create({
    container: { marginVertical: 15, width: 382, alignSelf: 'center', paddingHorizontal: 0 },
    inner: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
    item: { paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    itemActive: { borderBottomColor: C.dark },
    text: {
        fontFamily: 'Clash Display',
        fontSize: 14,
        color: C.skipGrey,
        lineHeight: 14, // 100%
    },
    textActive: {
        color: C.dark,
    },
});

// ─── Chat Item Component ─────────────────────────────────────────────────────
interface ChatItemProps {
    item: typeof MOCK_CHATS[0];
    onPress?: (item: typeof MOCK_CHATS[0]) => void;
}
const ChatItem: React.FC<ChatItemProps> = ({ item, onPress }) => (
    <TouchableOpacity style={chatStyles.row} activeOpacity={0.7} onPress={() => onPress?.(item)}>
        <View style={chatStyles.avatarWrap}>
            {item.isGroup ? (
                <View style={chatStyles.groupAvatarBox}>
                    <Ionicons name="people-outline" size={24} color="#E0C38C" />
                </View>
            ) : (
                <View style={chatStyles.avatarCircle}>
                    <Image source={AVATAR} style={chatStyles.avatarImg} />
                    {item.unread > 0 && item.id === '1' && (
                        <View style={chatStyles.lockBadge}>
                            <Ionicons name="lock-closed" size={10} color={C.white} />
                        </View>
                    )}
                </View>
            )}
        </View>
        <View style={chatStyles.content}>
            <View style={chatStyles.topRow}>
                <Text style={chatStyles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={item.unread > 0 ? chatStyles.time : chatStyles.timeGrey}>{item.time}</Text>
            </View>
            <View style={chatStyles.bottomRow}>
                <View style={chatStyles.msgContainer}>
                    {item.id === '2' && <Ionicons name="checkmark-done" size={16} color="#4ADE80" style={{ marginRight: 4 }} />}
                    {item.id === '3' && <Ionicons name="checkmark-outline" size={16} color="#999" style={{ marginRight: 4 }} />}
                    <Text style={chatStyles.msg} numberOfLines={1}>{item.msg}</Text>
                </View>
                {item.unread > 0 && (
                    <View style={chatStyles.unreadBadge}>
                        <Text style={chatStyles.unreadText}>{item.unread}</Text>
                    </View>
                )}
            </View>
        </View>
    </TouchableOpacity>
);
const chatStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        paddingHorizontal: 0,
        paddingBottom: 16,
        height: 68,
        width: 380.8,
        alignSelf: 'center',
        borderBottomWidth: 1,
        borderBottomColor: C.skipGrey,
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    avatarWrap: { marginRight: 12 },
    avatarCircle: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#F0F0F0', overflow: 'hidden' },
    groupAvatarBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#F5F2E8', alignItems: 'center', justifyContent: 'center' },
    avatarImg: { width: '100%', height: '100%' },
    lockBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 18, height: 18, borderRadius: 6, backgroundColor: C.blue,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: C.white,
    },
    content: { flex: 1, justifyContent: 'center', paddingBottom: 8 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    name: { fontFamily: 'Gilroy-Regular', fontSize: 16, color: C.dark },
    time: { fontSize: 12, color: C.blue },
    timeGrey: { fontSize: 13, color: '#999' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    msgContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    msg: { fontSize: 14, color: '#666', flex: 1, marginRight: 8 },
    unreadBadge: {
        backgroundColor: C.blue, width: 20, height: 20,
        borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    },
    unreadText: { color: C.white, fontSize: 11 },
});

// ─── Main HomeScreen Component ───────────────────────────────────────────────
interface Props {
    userName?: string;
    userSubtitle?: string;
    onSearch?: (text: string) => void;
    onShield?: () => void;
    onMore?: () => void;
    onFab?: () => void;
    onSkip?: () => void;
    onTabPress?: (key: string) => void;
    onGetStartedItem?: (key: string) => void;
    onChatPress?: (item: typeof MOCK_CHATS[0]) => void;
    onAvatarPress?: () => void;
}

const HomeScreen: React.FC<Props> = ({
    userName = 'Good Morning!',
    userSubtitle = 'InvestChat',
    onSearch,
    onShield,
    onMore,
    onFab,
    onSkip,
    onTabPress,
    onGetStartedItem,
    onChatPress,
    onAvatarPress,
}) => {
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState<TabKey>('chat');
    const [hasChats, setHasChats] = useState(false); // Default to true for testing active view
    const [activeFilter, setActiveFilter] = useState('All');

    const handleTabPress = (key: TabKey) => {
        setActiveTab(key);
        onTabPress?.(key);
    };

    const handleSkip = () => {
        setHasChats(true);
        onSkip?.();
    };

    return (
        <View style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

            <View style={styles.root}>
                {/* ── TOP NAV ── */}
                <View style={styles.topNav}>
                    <View style={styles.greetRow}>
                        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
                            <Image source={AVATAR} style={styles.avatar} />
                        </TouchableOpacity>
                        <View style={styles.greetText}>
                            <Text style={styles.greetName}>{userName}</Text>
                            <Text style={styles.greetSub}>{userSubtitle}</Text>
                        </View>
                    </View>

                    <View style={styles.navActions}>
                        <TouchableOpacity style={styles.navIconBtn} onPress={onShield} activeOpacity={0.7}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={C.dark} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navIconBtn} onPress={onMore} activeOpacity={0.7}>
                            <ThreeDots />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── SCROLLABLE BODY ── */}
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {!hasChats && (
                        <Text style={styles.headline}>
                            Secure Messages, Stay{'\n'}Private
                        </Text>
                    )}
                    <View style={styles.searchWrapper}>
                        <Ionicons name="search-outline" size={16} color="#0230F9" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search secure.."
                            placeholderTextColor={C.searchPlaceholder}
                            value={searchText}
                            onChangeText={text => {
                                setSearchText(text);
                                onSearch?.(text);
                            }}
                            returnKeyType="search"
                        />
                    </View>

                    {hasChats ? (
                        <>
                            <FilterBar active={activeFilter} onSelect={setActiveFilter} />
                            {MOCK_CHATS.map(chat => (
                                <ChatItem key={chat.id} item={chat} onPress={onChatPress} />
                            ))}
                            <View style={{ height: 120 }} />
                        </>
                    ) : (
                        <View style={styles.emptyArea} />
                    )}
                </ScrollView>

                {/* ── BOTTOM STICKY UI ── */}
                <View style={styles.bottomContainer}>
                    {/* FAB positioned relative to this stack */}
                    <TouchableOpacity
                        style={[styles.fab, !hasChats && { bottom: 300 }]}
                        onPress={onFab}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="people-outline" size={22} color={C.white} />
                    </TouchableOpacity>

                    {/* Get Started Section - Conditional */}
                    {!hasChats && (
                        <GetStartedSection
                            onItemPress={(key: string) => onGetStartedItem?.(key)}
                            onSkip={handleSkip}
                        />
                    )}

                    {/* Navbar */}
                    <BottomNavBar activeTab={activeTab} onTabPress={handleTabPress} />
                </View>
            </View>
        </View>
    );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    root: { flex: 1, backgroundColor: C.bg },
    topNav: {
        width: '100%',
        height: 50,
        marginTop: 60, // Consistent with ChatScreen refinement
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24, // Consistent with ChatScreen refinement
        backgroundColor: C.bg,
    },
    greetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#D0D0D0' },
    greetText: { gap: 1 },
    greetName: { fontSize: 16, color: C.dark, fontFamily: 'Gilroy-Medium' },
    greetSub: { fontSize: 13, color: C.subtitleBlue, fontFamily: 'ClashDisplay-Regular' },
    navActions: { flexDirection: 'row', gap: 13.42 }, // Consistent with ChatScreen refinement
    navIconBtn: {
        width: 40, height: 40, borderRadius: 14, backgroundColor: C.white, // Consistent with ChatScreen refinement
        alignItems: 'center', justifyContent: 'center',
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
    headline: { fontSize: 28, color: C.dark, lineHeight: 36, marginBottom: 20 },
    searchWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: C.searchBg,
        borderRadius: 9, borderWidth: 1, borderColor: C.searchBorder,
        width: 382, height: 42,
        paddingTop: 11, paddingBottom: 11,
        paddingLeft: 16, paddingRight: 16,
        gap: 8,
        alignSelf: 'center',
    },
    searchIcon: { marginTop: 1 },
    searchInput: { flex: 1, fontSize: 14, color: C.dark, padding: 0 },
    emptyArea: { height: 280 }, // Large enough to scroll past the fixed footer

    bottomContainer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: 'transparent',
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 125, // Increased bottom distance to separate from Navbar
        width: 56, height: 56, borderRadius: 18, backgroundColor: C.blue,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.blue, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
        zIndex: 100,
    },
    tilesScroll: {
        paddingHorizontal: 20,
        gap: 16,
    },
});

export default HomeScreen;
