import React from 'react';
import { View, Text, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/common/ScreenHeader';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

const appVersion = require('../../../app.json').expo.version;

interface Props {
    onBack: () => void;
}

const HelpScreen: React.FC<Props> = ({ onBack }) => (
    <View style={cs.root}>
        <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
        <ScreenHeader title="Help" onBack={onBack} backgroundColor={SETTINGS_BG} />

        <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
            <HelpRow label="Support center" external />
            <HelpRow label="Contact us" />
            <HelpRow label="Version" subtitle={appVersion} />
            <HelpRow label="Debug log" />
            <HelpRow label="Licenses" />
            <HelpRow label="Terms & Privacy Policy" external isLast />

            <Text style={cs.note}>
                Copyright Invest Messenger Licensed under the GNU AGPLv3 Invest is a 501c3 nonprofit
            </Text>
        </ScrollView>
    </View>
);

/* ── Sub-component ─────────────────────────────────────────────────────────── */
const HelpRow: React.FC<{
    label: string;
    subtitle?: string;
    external?: boolean;
    isLast?: boolean;
}> = ({ label, subtitle, external, isLast }) => (
    <TouchableOpacity style={[cs.row, !isLast && cs.border]} activeOpacity={0.6}>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            {subtitle ? <Text style={cs.subtitle}>{subtitle}</Text> : null}
        </View>
        {external && <Ionicons name="open-outline" size={20} color="#070707" />}
    </TouchableOpacity>
);

export default HelpScreen;
