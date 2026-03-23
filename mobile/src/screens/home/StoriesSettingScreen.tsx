import React, { useState } from 'react';
import {
    View,
    Text,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    Modal,
    Pressable,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import ScreenHeader from '../../components/common/ScreenHeader';
import CustomToggle from '../../components/common/CustomToggle';
import cs, { SETTINGS_BG } from '../../styles/settingsCommon';

interface Props {
    onBack: () => void;
    onMyStoryPress?: () => void;
    onNewCustomStory?: () => void;
}

const StoriesSettingScreen: React.FC<Props> = ({ onBack, onMyStoryPress, onNewCustomStory }) => {
    const [viewReceipts, setViewReceipts] = useState(true);
    const [showTypeModal, setShowTypeModal] = useState(false);

    return (
        <View style={cs.root}>
            <StatusBar barStyle="dark-content" backgroundColor={SETTINGS_BG} />
            <ScreenHeader title="Stories" onBack={onBack} backgroundColor={SETTINGS_BG} />

            <ScrollView style={cs.scroll} showsVerticalScrollIndicator={false}>
                <Text style={s.desc}>
                    Story updates automatically disappear after 24 hours. Choose who can view your story or create new stories with specific viewers or groups.
                </Text>

                {/* ── Stories section ── */}
                <Text style={cs.sectionTitle}>Stories</Text>

                {/* New Story */}
                <TouchableOpacity style={[cs.row, cs.border]} activeOpacity={0.6} onPress={() => setShowTypeModal(true)}>
                    <View style={s.iconCircle}>
                        <Ionicons name="add" size={22} color="#070707" />
                    </View>
                    <Text style={cs.label}>New Story</Text>
                </TouchableOpacity>

                {/* My Story */}
                <TouchableOpacity style={[cs.row, { borderBottomWidth: 0 }]} activeOpacity={0.6} onPress={onMyStoryPress}>
                    <View style={s.avatarCircle}>
                        <Text style={s.avatarText}>SK</Text>
                    </View>
                    <View style={cs.textCol}>
                        <Text style={cs.label}>My Story</Text>
                        <Text style={cs.subtitle}>Tap to choose your viewers</Text>
                    </View>
                </TouchableOpacity>

                {/* View receipts */}
                <View style={[cs.row, cs.border, { marginTop: 12 }]}>
                    <View style={cs.textCol}>
                        <Text style={cs.label}>View receipts</Text>
                        <Text style={cs.subtitle}>
                            See and share when stories are viewed. If disabled, you won't see when others view your story.
                        </Text>
                    </View>
                    <CustomToggle value={viewReceipts} onValueChange={setViewReceipts} />
                </View>

                {/* Turn off stories */}
                <View style={[cs.row, cs.border]}>
                    <View style={cs.textCol}>
                        <Text style={cs.label}>Turn off stories</Text>
                        <Text style={cs.subtitle}>
                            If you opt out of stories you will no longer be able to share or view stories.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>

            {/* ── Choose story type modal ── */}
            <StoryTypeModal visible={showTypeModal} onClose={() => setShowTypeModal(false)} onCustomStory={onNewCustomStory} />
        </View>
    );
};

/* ── Story Type Bottom Sheet ───────────────────────────────────────────────── */
const StoryTypeModal: React.FC<{ visible: boolean; onClose: () => void; onCustomStory?: () => void }> = ({ visible, onClose, onCustomStory }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={m.overlay} onPress={onClose}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={m.sheet}>
                <View style={m.handle} />
                <TouchableOpacity style={m.closeBtn} onPress={onClose} activeOpacity={0.7}>
                    <Ionicons name="close-circle-outline" size={28} color="#8E8E93" />
                </TouchableOpacity>

                <Text style={m.title}>Choose your story type</Text>

                <TouchableOpacity style={[cs.row, cs.border]} activeOpacity={0.6} onPress={() => { onClose(); onCustomStory?.(); }}>
                    <View style={s.modalIcon}>
                        <Ionicons name="shield-outline" size={20} color="#070707" />
                    </View>
                    <View style={cs.textCol}>
                        <Text style={cs.label}>New custom story</Text>
                        <Text style={cs.subtitle}>Visible only to specific</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={cs.row} activeOpacity={0.6} onPress={onClose}>
                    <View style={s.modalIcon}>
                        <Ionicons name="people-outline" size={20} color="#070707" />
                    </View>
                    <View style={cs.textCol}>
                        <Text style={cs.label}>Group story</Text>
                        <Text style={cs.subtitle}>Share to an existing group</Text>
                    </View>
                </TouchableOpacity>
            </Pressable>
        </Pressable>
    </Modal>
);

/* ── Styles ────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
    desc: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 12,
        color: '#8E8E93',
        lineHeight: 18,
        marginTop: 8,
        marginLeft: 4,
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F2F2F3',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    avatarCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#0230F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    avatarText: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    modalIcon: {
        width: 42,
        height: 42,
        borderRadius: 13,
        backgroundColor: '#F2F2F3',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
});

const m = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    handle: { width: 40, height: 4, backgroundColor: '#000', borderRadius: 2, opacity: 0.15, marginTop: 12, marginBottom: 16, alignSelf: 'center' },
    closeBtn: { position: 'absolute', top: 16, right: 20, zIndex: 1 },
    title: { fontFamily: 'Gilroy-Medium', fontSize: 20, color: '#070707', marginBottom: 10, marginTop: 8 },
});

export default StoriesSettingScreen;
