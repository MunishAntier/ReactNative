import React from 'react';
import { View, Text, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import ScreenHeader from '../../components/common/ScreenHeader';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
}

const DataStorageScreen: React.FC<Props> = ({ onBack }) => (
    <View style={cs.root}>
        <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
        <ScreenHeader title="Data and storage" onBack={onBack} backgroundColor={SETTINGS_BG} />

        <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
            <TextRow label="Manage storage" subtitle="488 KB" isLast />

            <Text style={cs.sectionTitle}>Media auto-download</Text>
            <TextRow label="When using mobile data" subtitle="Images, Audio" />
            <TextRow label="When using Wi-Fi" subtitle="Images, Documents, Audio, Video" />
            <TextRow label="When roaming" isLast />

            <Text style={cs.sectionTitle}>Media quality</Text>
            <TextRow label="Sent media quality" subtitle="Standard" isLast />
            <Text style={cs.note}>Sending high quality media will use more data.</Text>

            <Text style={cs.sectionTitle}>Calls</Text>
            <TextRow label="Use less data for calls" subtitle="Never" isLast />
            <Text style={cs.note}>Using less data may improve calls on bad networks</Text>

            <Text style={cs.sectionTitle}>Proxy</Text>
            <TextRow label="Use proxy" subtitle="Off" isLast />

            <View style={{ height: 50 }} />
        </ScrollView>
    </View>
);

/* ── Sub-component ─────────────────────────────────────────────────────────── */
const TextRow: React.FC<{
    label: string;
    subtitle?: string;
    isLast?: boolean;
}> = ({ label, subtitle, isLast }) => (
    <TouchableOpacity style={[cs.row, !isLast && cs.border]} activeOpacity={0.6}>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            {subtitle ? <Text style={cs.subtitle}>{subtitle}</Text> : null}
        </View>
    </TouchableOpacity>
);

export default DataStorageScreen;
