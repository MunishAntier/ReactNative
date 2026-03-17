import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';

const TILE_W = 142;
const TILE_H = 112;

const C = {
    bg: '#EBEBEC',
    white: '#FFFFFF',
    blue: '#0230F9',
    blueBorder: '#8BA0FC',
    dark: '#0E0E0E',
    skipGrey: '#6B6B6B',
    black: '#070707',
};

export const GET_STARTED_ITEMS = [
    { key: 'group', icon: 'people-outline', label: 'New Group' },
    { key: 'invite', icon: 'mail-outline', label: 'Invite Friends' },
    { key: 'profile', icon: 'person-circle-outline', label: 'Profile Photo' },
];

interface NotchedTileProps {
    label: string;
    icon: any;
    onPress?: () => void;
}

const NotchedTile: React.FC<NotchedTileProps> = ({ label, icon, onPress }) => (
    <TouchableOpacity
        style={styles.tileWrapper}
        onPress={onPress}
        activeOpacity={0.75}
    >
        <View style={styles.tileSvgContainer}>
            <Svg width={TILE_W} height={TILE_H} style={StyleSheet.absoluteFill}>
                <Path
                    d={`M 20 0 H ${TILE_W} V ${TILE_H - 20} L ${TILE_W - 20} ${TILE_H} H 0 V 20 L 20 0 Z`}
                    fill={C.bg}
                    stroke={C.blueBorder}
                    strokeWidth={1}
                />
            </Svg>
            <View style={styles.tileInner}>
                <View style={styles.tileIconBox}>
                    <Ionicons name={icon} size={22} color={C.dark} />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
            </View>
        </View>
    </TouchableOpacity>
);

interface Props {
    onItemPress: (key: string) => void;
    onSkip: () => void;
}

const GetStartedSection: React.FC<Props> = ({ onItemPress, onSkip }) => {
    return (
        <View style={styles.getStartedSection}>
            <View style={styles.getStartedHeader}>
                <Text style={styles.getStartedTitle}>Get Started</Text>
                <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tilesScroll}
            >
                {GET_STARTED_ITEMS.map((item) => (
                    <NotchedTile
                        key={item.key}
                        label={item.label}
                        icon={item.icon}
                        onPress={() => onItemPress(item.key)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    getStartedSection: {
        backgroundColor: 'transparent',
        marginTop: 10,
        paddingBottom: 20,
    },
    getStartedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    getStartedTitle: {
        fontFamily: 'Clash Display',
        fontSize: 22,
        fontWeight: '500',
        color: C.blue,
        lineHeight: 44.11,
    },
    skipText: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 14,
        fontWeight: '400',
        color: C.black,
        textDecorationLine: 'underline',
        lineHeight: 14,
        textAlign: 'right',
    },
    tilesScroll: {
        paddingHorizontal: 20,
        gap: 16,
    },
    tileWrapper: { width: TILE_W, height: TILE_H },
    tileSvgContainer: { width: TILE_W, height: TILE_H, position: 'relative' },
    tileInner: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        padding: 12,
        justifyContent: 'space-between',
    },
    tileIconBox: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-end',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    tileLabel: {
        fontFamily: 'Clash Display',
        fontSize: 16,
        fontWeight: '500',
        color: C.black,
        width: '90%',
        lineHeight: 20,
    },
});

export default GetStartedSection;
