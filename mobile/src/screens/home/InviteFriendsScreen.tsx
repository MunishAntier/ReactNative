import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/common/ScreenHeader';
import { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
}

const INVITE_URL = 'https://signal.org/install';

const InviteFriendsScreen: React.FC<Props> = ({ onBack }) => {
    const handleShare = async () => {
        try {
            await Share.share({ message: `Let's switch to invest\n${INVITE_URL}` });
        } catch (e) {
            console.error('Share error:', e);
        }
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="Invite friends" onBack={onBack} backgroundColor={SETTINGS_BG} />

            <View style={s.body}>
                {/* ── Invite card ── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>Let's switch to invest</Text>
                    <Text style={s.cardUrl}>{INVITE_URL}</Text>
                </View>

                {/* ── Share row ── */}
                <TouchableOpacity style={s.shareRow} activeOpacity={0.6} onPress={handleShare}>
                    <Text style={s.shareLabel}>Share</Text>
                    <Ionicons name="share-social-outline" size={20} color="#070707" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: SETTINGS_BG },
    body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingVertical: 20,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    cardTitle: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 18,
        color: '#070707',
        marginBottom: 6,
    },
    cardUrl: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 13,
        color: '#8E8E93',
    },
    shareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D4D4D4',
        marginTop: 8,
    },
    shareLabel: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#070707',
    },
});

export default InviteFriendsScreen;
