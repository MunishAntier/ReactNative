import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/common/ScreenHeader';
import { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
}

const DEVICES = [
    { name: 'Mac OS', status: 'Active now', icon: 'desktop-outline', active: true },
    { name: 'Windows', status: 'Last active today at 10:24 AM', icon: 'laptop-outline', active: false },
];

const LinkedDevicesScreen: React.FC<Props> = ({ onBack }) => (
    <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
        <ScreenHeader title="Linked devices" onBack={onBack} backgroundColor={SETTINGS_BG} />

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {/* ── Hero card ── */}
            <View style={s.card}>
                <View style={s.iconBox}>
                    <Ionicons name="git-compare-outline" size={28} color="#FFFFFF" />
                </View>
                <Text style={s.cardTitle}>Use on other devices</Text>
                <Text style={s.cardDesc}>Use this invest account on desktop or ipad.</Text>
                <TouchableOpacity activeOpacity={0.6}>
                    <Text style={s.link}>Learn more....</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkBtn} activeOpacity={0.85}>
                    <Text style={s.linkBtnTxt}>Link a Device</Text>
                </TouchableOpacity>
            </View>

            {/* ── My linked devices ── */}
            <Text style={s.sectionTitle}>My linked devices</Text>
            {DEVICES.map((device, i) => (
                <View key={device.name} style={[s.deviceRow, i < DEVICES.length - 1 && s.border]}>
                    <View style={s.deviceIcon}>
                        <Ionicons name={device.icon as any} size={22} color="#070707" />
                    </View>
                    <View style={s.deviceInfo}>
                        <Text style={s.deviceName}>{device.name}</Text>
                        <View style={s.statusRow}>
                            <View style={[s.dot, device.active && s.dotActive]} />
                            <Text style={s.deviceStatus}>{device.status}</Text>
                        </View>
                    </View>
                    <TouchableOpacity activeOpacity={0.6}>
                        <Ionicons name="ellipsis-vertical" size={20} color="#070707" />
                    </TouchableOpacity>
                </View>
            ))}

            <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Save button ── */}
        <View style={s.footer}>
            <TouchableOpacity style={s.saveBtn} activeOpacity={0.85}>
                <Text style={s.saveTxt}>Save</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: SETTINGS_BG },
    scroll: { flex: 1, paddingHorizontal: 16 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingHorizontal: 24,
        paddingVertical: 24,
        alignItems: 'center',
        marginTop: 12,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 16,
        backgroundColor: '#0230F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 20,
        color: '#070707',
        marginBottom: 8,
    },
    cardDesc: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
    },
    link: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 14,
        color: '#0230F9',
        marginTop: 4,
        marginBottom: 20,
    },
    linkBtn: {
        width: '100%',
        height: 52,
        borderRadius: 14,
        backgroundColor: '#070707',
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkBtnTxt: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    sectionTitle: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 18,
        color: '#0230F9',
        marginTop: 20,
        marginBottom: 10,
        marginLeft: 4,
    },
    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    border: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D4D4D4',
    },
    deviceIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F2F2F3',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    deviceInfo: { flex: 1 },
    deviceName: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#070707',
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#8E8E93',
        marginRight: 6,
    },
    dotActive: { backgroundColor: '#34C759' },
    deviceStatus: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 12,
        color: '#8E8E93',
    },
    footer: {
        paddingHorizontal: 16,
        paddingBottom: 34,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#D4D4D4',
    },
    saveBtn: {
        height: 56,
        borderRadius: 16,
        backgroundColor: '#070707',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveTxt: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
});

export default LinkedDevicesScreen;
