import React, { useState } from 'react';
import { View, Text, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import ScreenHeader from '../../components/common/ScreenHeader';
import CustomToggle from '../../components/common/CustomToggle';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
}

const PrivacySettingScreen: React.FC<Props> = ({ onBack }) => {
    const [readReceipts, setReadReceipts] = useState(true);
    const [typingIndicators, setTypingIndicators] = useState(true);
    const [defaultTimer, setDefaultTimer] = useState(false);
    const [screenLock, setScreenLock] = useState(false);
    const [screenSecurity, setScreenSecurity] = useState(false);
    const [incognitoKb, setIncognitoKb] = useState(false);
    const [paymentLock, setPaymentLock] = useState(false);

    return (
        <View style={cs.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="Privacy" onBack={onBack} backgroundColor={SETTINGS_BG} />

            <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
                {/* Phone number */}
                <TextRow label="Phone number" subtitle="Choose who can see your phone number and who can contact you on Invest with it." />
                <TextRow label="Blocked" subtitle="0 contacts or groups" isLast />

                {/* Messaging */}
                <Text style={cs.sectionTitle}>Messaging</Text>
                <ToggleRow
                    label="Read receipts"
                    subtitle="If read receipts are disabled, you won't be able to see read receipts from others."
                    value={readReceipts}
                    onValueChange={setReadReceipts}
                />
                <ToggleRow
                    label="Typing indicators"
                    subtitle="If typing indicators are disabled, you won't be able to see typing indicators from others."
                    value={typingIndicators}
                    onValueChange={setTypingIndicators}
                    isLast
                />

                {/* Disappearing messages */}
                <Text style={cs.sectionTitle}>Disappearing messages</Text>
                <ToggleRow
                    label="Default timer for new chats"
                    subtitle="Set a default disappearing message timer for all new chats started by you."
                    value={defaultTimer}
                    onValueChange={setDefaultTimer}
                    isLast
                />

                {/* App security */}
                <Text style={cs.sectionTitle}>App security</Text>
                <ToggleRow label="Screen lock" value={screenLock} onValueChange={setScreenLock} />
                <ToggleRow
                    label="Screen security"
                    subtitle="Block screenshots in the recents list and inside the app"
                    value={screenSecurity}
                    onValueChange={setScreenSecurity}
                />
                <ToggleRow
                    label="Incognito keyboard"
                    subtitle="Request keyboard to disable personalized learning."
                    value={incognitoKb}
                    onValueChange={setIncognitoKb}
                    isLast
                />
                <Text style={cs.note}>
                    This setting is not a guarantee, and your keyboard may ignore it.{' '}
                    <Text style={cs.link}>Learn more....</Text>
                </Text>

                {/* Payments */}
                <Text style={cs.sectionTitle}>Payments</Text>
                <ToggleRow
                    label="Payment lock"
                    subtitle="Require Android screen lock or fingerprint to transfer funds"
                    value={paymentLock}
                    onValueChange={setPaymentLock}
                />
                <TextRow
                    label="Advanced"
                    subtitle="Invest messages and calls, always relay calls, and sealed sender"
                    isLast
                />

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

/* ── Sub-components ────────────────────────────────────────────────────────── */
const ToggleRow: React.FC<{
    label: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    isLast?: boolean;
}> = ({ label, subtitle, value, onValueChange, isLast }) => (
    <View style={[cs.row, !isLast && cs.border]}>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            {subtitle ? <Text style={cs.subtitle}>{subtitle}</Text> : null}
        </View>
        <CustomToggle value={value} onValueChange={onValueChange} />
    </View>
);

const TextRow: React.FC<{
    label: string;
    subtitle: string;
    isLast?: boolean;
}> = ({ label, subtitle, isLast }) => (
    <TouchableOpacity style={[cs.row, !isLast && cs.border]} activeOpacity={0.6}>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            <Text style={cs.subtitle}>{subtitle}</Text>
        </View>
    </TouchableOpacity>
);

export default PrivacySettingScreen;
