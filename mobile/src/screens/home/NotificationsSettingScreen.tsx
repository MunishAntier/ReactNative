import React, { useState } from 'react';
import { View, Text, StatusBar, ScrollView } from 'react-native';
import ScreenHeader from '../../components/common/ScreenHeader';
import CustomToggle from '../../components/common/CustomToggle';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
}

const NotificationsSettingScreen: React.FC<Props> = ({ onBack }) => {
    const [msgNotif, setMsgNotif] = useState(true);
    const [inChatSounds, setInChatSounds] = useState(true);
    const [callNotif, setCallNotif] = useState(true);
    const [vibrate, setVibrate] = useState(true);
    const [contactJoins, setContactJoins] = useState(false);

    return (
        <View style={cs.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="Notifications" onBack={onBack} backgroundColor={SETTINGS_BG} />

            <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
                {/* ── Messages ── */}
                <Text style={cs.sectionTitle}>Messages</Text>
                <ToggleRow label="Notification" value={msgNotif} onValueChange={setMsgNotif} />
                <TextRow label="Customize" subtitle="Change sound and vibration" />
                <ToggleRow label="In-chat sounds" value={inChatSounds} onValueChange={setInChatSounds} />
                <TextRow label="Repeat alerts" subtitle="Never" />
                <TextRow label="Show" subtitle="Name and message" isLast />

                {/* ── Calls ── */}
                <Text style={cs.sectionTitle}>Calls</Text>
                <ToggleRow label="Notification" value={callNotif} onValueChange={setCallNotif} />
                <TextRow label="Ringtones" subtitle="Default (2866)" />
                <ToggleRow label="Vibrate" value={vibrate} onValueChange={setVibrate} isLast />

                {/* ── Notification profiles ── */}
                <Text style={cs.sectionTitle}>Notification profiles</Text>
                <TextRow
                    label="Profiles"
                    subtitle="Create a profile to receive notifications only from people and groups you choose."
                    isLast
                />

                {/* ── Notify when... ── */}
                <Text style={cs.sectionTitle}>Notify when...</Text>
                <ToggleRow label="Contact joins Signal" value={contactJoins} onValueChange={setContactJoins} isLast />

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

/* ── Sub-components ────────────────────────────────────────────────────────── */
const ToggleRow: React.FC<{
    label: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    isLast?: boolean;
}> = ({ label, value, onValueChange, isLast }) => (
    <View style={[cs.row, !isLast && cs.border]}>
        <Text style={[cs.label, { flex: 1 }]}>{label}</Text>
        <CustomToggle value={value} onValueChange={onValueChange} />
    </View>
);

const TextRow: React.FC<{
    label: string;
    subtitle: string;
    isLast?: boolean;
}> = ({ label, subtitle, isLast }) => (
    <View style={[cs.row, !isLast && cs.border]}>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            <Text style={cs.subtitle}>{subtitle}</Text>
        </View>
    </View>
);

export default NotificationsSettingScreen;
