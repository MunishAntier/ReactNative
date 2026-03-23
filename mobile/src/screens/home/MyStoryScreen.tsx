import React, { useState } from 'react';
import {
    View,
    Text,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import ScreenHeader from '../../components/common/ScreenHeader';
import CustomToggle from '../../components/common/CustomToggle';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
    onChooseViewers?: () => void;
}

type Visibility = 'all' | 'except' | 'only';

const MyStoryScreen: React.FC<Props> = ({ onBack, onChooseViewers }) => {
    const [visibility, setVisibility] = useState<Visibility>('all');
    const [allowReplies, setAllowReplies] = useState(true);

    return (
        <View style={cs.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="My Story" onBack={onBack} backgroundColor={SETTINGS_BG} />

            <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
                {/* ── Who can view ── */}
                <Text style={cs.sectionTitle}>Who can view this story</Text>

                <RadioRow
                    label="All Signal connections"
                    subtitle="8 viewers"
                    selected={visibility === 'all'}
                    onPress={() => setVisibility('all')}
                    trailing={<Text style={s.viewLink}>View</Text>}
                />
                <RadioRow
                    label="All except..."
                    subtitle="Hide your story from specific people"
                    selected={visibility === 'except'}
                    onPress={() => { setVisibility('except'); onChooseViewers?.(); }}
                />
                <RadioRow
                    label="Only share with..."
                    subtitle="Only share with selected people"
                    selected={visibility === 'only'}
                    onPress={() => { setVisibility('only'); onChooseViewers?.(); }}
                    isLast
                />

                <Text style={cs.note}>
                    Choose who can view your story. Changes won't affect stories you've already sent.{' '}
                    <Text style={cs.link}>Learn more....</Text>
                </Text>

                {/* ── Replies & reactions ── */}
                <Text style={cs.sectionTitle}>Replies & reactions</Text>
                <View style={[cs.row, cs.border]}>
                    <View style={cs.textCol}>
                        <Text style={cs.label}>Allow replies & reactions</Text>
                        <Text style={cs.subtitle}>Let people who can view your story react and reply</Text>
                    </View>
                    <CustomToggle value={allowReplies} onValueChange={setAllowReplies} />
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

/* ── Radio Row ─────────────────────────────────────────────────────────────── */
const RadioRow: React.FC<{
    label: string;
    subtitle: string;
    selected: boolean;
    onPress: () => void;
    trailing?: React.ReactNode;
    isLast?: boolean;
}> = ({ label, subtitle, selected, onPress, trailing, isLast }) => (
    <TouchableOpacity style={[cs.row, !isLast && cs.border]} activeOpacity={0.6} onPress={onPress}>
        <View style={[s.radio, selected && s.radioSelected]}>
            {selected && <View style={s.radioDot} />}
        </View>
        <View style={cs.textCol}>
            <Text style={cs.label}>{label}</Text>
            <Text style={cs.subtitle}>{subtitle}</Text>
        </View>
        {trailing}
    </TouchableOpacity>
);

/* ── Styles ────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#C0C0C0',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    radioSelected: { borderColor: '#0230F9' },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0230F9' },
    viewLink: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 14,
        color: '#0230F9',
    },
});

export default MyStoryScreen;
