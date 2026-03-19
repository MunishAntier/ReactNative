import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ICONS } from '../../assets/icons/navIcons';

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
    white: '#FFFFFF',
    blue: '#2A52E4',
    dark: '#070707',
    tabIcon: '#929292',
};

export type TabKey = 'chat' | 'calls' | 'stories' | 'settings';

interface TabItem {
    key: TabKey;
    label: string;
}

const TABS: TabItem[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'calls', label: 'Call' },
    { key: 'stories', label: 'Stories' },
    { key: 'settings', label: 'Settings' },
];

interface Props {
    activeTab: TabKey;
    onTabPress: (key: TabKey) => void;
}

const BottomNavBar: React.FC<Props> = ({ activeTab, onTabPress }) => {

    const getIcon = (key: TabKey, isActive: boolean): string => {
        if (!isActive) return ICONS[key];
        const activeKey = `${key}Active` as keyof typeof ICONS;
        return ICONS[activeKey] ?? ICONS[key];
    };

    return (
        <View style={styles.container}>
            <View style={styles.navBar}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[
                                styles.tabItem,
                                isActive ? styles.tabItemActive : styles.tabItemInactive,
                            ]}
                            onPress={() => onTabPress(tab.key)}
                            activeOpacity={0.8}
                        >
                            {isActive ? (
                                // ── Active pill ──────────────────────────────
                                <View style={styles.activePill}>
                                    <SvgXml xml={getIcon(tab.key, true)} width={30} height={30} />
                                    <Text style={styles.activePillLabel}>{tab.label}</Text>
                                </View>
                            ) : (
                                // ── Inactive icon ────────────────────────────
                                <View style={styles.inactiveIconWrapper}>
                                    <SvgXml xml={getIcon(tab.key, false)} width={30} height={30} />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
// All values are pixel-perfect from the Figma spec.

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 20,
    },

    // Outer pill bar  →  w:382  h:81  br:75
    navBar: {
        width: 382,
        height: 81,
        backgroundColor: C.dark,
        borderRadius: 75,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        overflow: 'hidden',
        // Shadow
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },

    // Base tab touch-target
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Active tab  →  w:104  h:80
    tabItemActive: {
        width: 104,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Inactive tab  →  w:81  h:81
    tabItemInactive: {
        width: 81,
        height: 81,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Inactive icon wrapper — centred inside the 81×81 touch zone
    inactiveIconWrapper: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Blue pill  →  fills the active tab area with attributes from spec
    // w:104 h:50 pt:10 pr:20 pb:10 pl:20 gap:6 br:44
    activePill: {
        width: 104,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.blue,
        borderRadius: 44,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 20,
        paddingRight: 20,
        gap: 6,
    },

    activePillLabel: {
        fontFamily: 'Clash Display',
        fontSize: 12,
        lineHeight: 12,
        letterSpacing: 0.1,
        color: C.white,
        includeFontPadding: false,
    },
});

export default BottomNavBar;