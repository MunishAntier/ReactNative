import React, { useState } from 'react';
import { View, Text, StatusBar, ScrollView } from 'react-native';
import ScreenHeader from '../../components/common/ScreenHeader';
import SettingsMenuItem from '../../components/common/SettingsMenuItem';
import CustomToggle from '../../components/common/CustomToggle';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
}

const ChatsSettingScreen: React.FC<Props> = ({ onBack }) => {
    const [linkPreviews, setLinkPreviews] = useState(true);
    const [addressPhotos, setAddressPhotos] = useState(false);
    const [keepArchived, setKeepArchived] = useState(false);
    const [systemEmoji, setSystemEmoji] = useState(false);
    const [sendWithEnter, setSendWithEnter] = useState(false);

    return (
        <View style={cs.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="Chats" onBack={onBack} backgroundColor={SETTINGS_BG} />

            <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
                {/* ── Toggle settings ── */}
                <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
                    <ToggleRow
                        label="Generate link previews"
                        subtitle="Retrieve link previews directly from websites for messages you send."
                        value={linkPreviews}
                        onValueChange={setLinkPreviews}
                    />
                    <ToggleRow
                        label="Use address book photos"
                        subtitle="Display contact photos from your address book if available"
                        value={addressPhotos}
                        onValueChange={setAddressPhotos}
                    />
                    <ToggleRow
                        label="Keep muted chats archived"
                        subtitle="Muted chats that are archived will remain archived when a new message arrives."
                        value={keepArchived}
                        onValueChange={setKeepArchived}
                        isLast
                    />
                </View>

                {/* ── Chat folders ── */}
                <Text style={cs.sectionTitle}>Chat folders</Text>
                <View style={cs.card}>
                    <SettingsMenuItem icon="add-circle-outline" label="Add a chat folder" isLast />
                </View>

                {/* ── Keyboard ── */}
                <Text style={cs.sectionTitle}>Keyboard</Text>
                <View style={cs.card}>
                    <SettingsMenuItem
                        icon="happy-outline"
                        label="Use system emoji"
                        showArrow={false}
                        rightComponent={<CustomToggle value={systemEmoji} onValueChange={setSystemEmoji} />}
                    />
                    <SettingsMenuItem
                        icon="send-outline"
                        label="Send with enter"
                        showArrow={false}
                        isLast
                        rightComponent={<CustomToggle value={sendWithEnter} onValueChange={setSendWithEnter} />}
                    />
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

/* ── Toggle Row (flat, no icon) ────────────────────────────────────────────── */
const ToggleRow: React.FC<{
    label: string;
    subtitle: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    isLast?: boolean;
}> = ({ label, subtitle, value, onValueChange, isLast }) => (
    <View style={[cs.row, !isLast && cs.border]}>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            <Text style={cs.subtitle}>{subtitle}</Text>
        </View>
        <CustomToggle value={value} onValueChange={onValueChange} />
    </View>
);

export default ChatsSettingScreen;
