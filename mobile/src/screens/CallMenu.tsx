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
import BottomNavBar, { TabKey } from '../components/BottomNavBar';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATAR = require('../assets/images/avatar.png');
const { width: SCREEN_W } = Dimensions.get('window');

const C = {
    bg: '#EBEBEC',
    white: '#FFFFFF',
    blue: '#2A52E4',
    bluePale: '#EEF1FD',
    dark: '#0E0E0E',
    subtitleBlue: '#2A52E4',
    searchBg: '#FFFFFF',
    searchBorder: '#E3E3E3',
    searchPlaceholder: '#ABABAB',
};

// ─── Call Link Tile Component ────────────────────────────────────────────────
const CallLinkTile: React.FC = () => (
    <View style={callTileStyles.container}>
        <Svg width={382} height={82} style={StyleSheet.absoluteFill}>
            <Path
                d={`M 20 0 H 382 V 62 L 362 82 H 0 V 20 L 20 0 Z`}
                fill={C.bg}
                stroke="#8BA0FC"
                strokeWidth={1}
            />
        </Svg>
        <View style={callTileStyles.inner}>
            <Text style={callTileStyles.text}>Create a call link</Text>
            <View style={callTileStyles.iconBox}>
                <Ionicons name="link-outline" size={20} color={C.dark} />
            </View>
        </View>
    </View>
);

const callTileStyles = StyleSheet.create({
    container: {
        width: 382,
        height: 82,
        alignSelf: 'center',
        marginVertical: 20,
        position: 'relative',
    },
    inner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    text: {
        fontSize: 16,
        fontWeight: '500',
        color: C.dark,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
});

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

// ─── Main CallMenu Component ───────────────────────────────────────────────
interface Props {
    userName?: string;
    userSubtitle?: string;
    onTabPress?: (key: TabKey) => void;
}

const CallMenu: React.FC<Props> = ({
    userName = 'Good Morning!',
    userSubtitle = 'Invest Chat',
    onTabPress,
}) => {
    const [searchText, setSearchText] = useState('');

    return (
        <View style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

            <View style={styles.root}>
                {/* ── TOP NAV ── */}
                <View style={styles.topNav}>
                    <View style={styles.greetRow}>
                        <Image source={AVATAR} style={styles.avatar} />
                        <View style={styles.greetText}>
                            <Text style={styles.greetName}>{userName}</Text>
                            <Text style={styles.greetSub}>{userSubtitle}</Text>
                        </View>
                    </View>

                    <View style={styles.navActions}>
                        <TouchableOpacity style={styles.navIconBtn} activeOpacity={0.7}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={C.dark} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navIconBtn} activeOpacity={0.7}>
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
                    <View style={styles.searchWrapper}>
                        <Ionicons name="search-outline" size={16} color="#0230F9" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search secure.."
                            placeholderTextColor={C.searchPlaceholder}
                            value={searchText}
                            onChangeText={setSearchText}
                            returnKeyType="search"
                        />
                    </View>

                    <CallLinkTile />
                </ScrollView>

                {/* ── BOTTOM STICKY UI ── */}
                <View style={styles.bottomContainer}>
                    <BottomNavBar activeTab="calls" onTabPress={(key) => onTabPress?.(key)} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    root: { flex: 1, backgroundColor: C.bg },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 20) + 20,
        paddingBottom: 12,
    },
    greetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#D0D0D0' },
    greetText: { gap: 1 },
    greetName: { fontSize: 15, fontWeight: '700', color: C.dark },
    greetSub: { fontSize: 12, fontWeight: '500', color: C.subtitleBlue },
    navActions: { flexDirection: 'row', gap: 8 },
    navIconBtn: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: C.white,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
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
    bottomContainer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: 'transparent',
    },
});

export default CallMenu;
